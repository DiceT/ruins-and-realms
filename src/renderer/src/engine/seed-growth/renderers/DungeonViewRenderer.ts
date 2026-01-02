/**
 * Dungeon View Renderer
 * 
 * Renders the seed growth output as a proper dungeon visualization.
 * This is separate from the debug/growth visualization in SeedGrowthRenderer.
 * 
 * Usage: When "View as Dungeon" is enabled, this renderer takes over
 * and displays rooms, corridors, and walls in a dungeon style.
 */

import { Container, Graphics, FederatedPointerEvent, Text, TextStyle, DisplacementFilter, Sprite, Texture, Assets, RenderTexture, Matrix, Rectangle } from 'pixi.js'
import { SeedGrowthState, SeedGrowthSettings, Room, Corridor, Connection, DungeonData, DungeonObject, SpineSeedState } from '../types'
import { LightProfile, VisionGrid, VISION_STATE } from '../../data/LightingData'
import { DungeonAnalysis, FurthestRoomResult } from '../../analysis/DungeonAnalysis'
import { ThemeManager } from '../../managers/ThemeManager'
import { RoomLayerConfig } from '../../themes/ThemeTypes'
import { FloorLayer, WallLayer, GridLayer, ObjectLayer, LabelLayer, DebugLayer, VisibilityLayer, SpineDebugLayer } from '../layers'
import { PanZoomController } from '../controllers/PanZoomController'
import { createNoiseTexture } from '../../utils/rendering'

export interface DungeonViewOptions {
  tileSize?: number
  showGrid?: boolean
  showRoomLabels?: boolean
  themeManager?: ThemeManager
  onRoomHover?: (room: Room | null, x: number, y: number) => void
}

export class DungeonViewRenderer {
  private container: Container
  private contentContainer: Container
  private tileSize: number = 8
  
  // Theme Manager
  private themeManager: ThemeManager
  private config: RoomLayerConfig

  // Pan/zoom state
  private panZoomController: PanZoomController
  
  // Layers
  private backgroundLayer: Graphics
  private floorLayer: FloorLayer
  private wallLayer: WallLayer
  private objectLayer: ObjectLayer // New: Objects (Sprites, Decorations)
  private gridLayer: GridLayer  // Separate layer for grid lines (re-rendered on zoom)
  private labelLayer: LabelLayer
  private debugLayer: DebugLayer
  private spineDebugLayer: SpineDebugLayer
  private overlayLayer: Graphics
  
  // --- New Visibility Layers ---
  private visibilityLayer: VisibilityLayer
  
  // FX
  
  // FX
  private noiseSprite: Sprite | null = null
  private displacementFilter: DisplacementFilter | null = null
  
  // View state
  private viewWidth: number = 800
  private viewHeight: number = 600
  private renderedRooms: Room[] = []
  private onRoomHover?: (room: Room | null, x: number, y: number) => void
  private lastHoveredRoom: string | null = null
  
  // Accessible corridor tiles for collision
  private corridorTiles: Set<string> = new Set()

  
  // Debug flags
  
  // Debug flags
  private showFog: boolean = true
  private showLight: boolean = true
  private showSpineDebug: boolean = false
  private cachedSpineState: SpineSeedState | null = null

  constructor(parentContainer: Container, options: DungeonViewOptions = {}) {
    this.container = new Container()
    this.container.eventMode = 'static'
    parentContainer.addChild(this.container)
    
    this.contentContainer = new Container()
    this.container.addChild(this.contentContainer)
    
    this.onRoomHover = options.onRoomHover

    // Interaction Handling
    if (this.onRoomHover) {
       this.container.addEventListener('pointermove', (e) => {
           // Convert global to local
           const global = e.global
           const local = this.contentContainer.toLocal(global)
           
           // Convert Local Pixel to Grid Coords
           // Room bounds are in Grid Coords. FloorLayer scales them by tileSize.
           // So check: room.bounds * tileSize vs local pixel
           
           let hovered: Room | null = null
           
           // Inverse iterate to check top-most (though rooms don't overlap much here)
           for (let i = this.renderedRooms.length - 1; i >= 0; i--) {
               const room = this.renderedRooms[i]
               const { x, y, w, h } = room.bounds
               
               const minX = x * this.tileSize
               const minY = y * this.tileSize
               const maxX = (x + w) * this.tileSize
               const maxY = (y + h) * this.tileSize
               
               if (local.x >= minX && local.x < maxX && local.y >= minY && local.y < maxY) {
                   hovered = room
                   break
               }
           }
           
           // Debounce / Trigger
           if (hovered?.id !== this.lastHoveredRoom) {
               this.lastHoveredRoom = hovered ? hovered.id : null
               this.onRoomHover!(hovered, global.x, global.y)
           } else if (!hovered && this.lastHoveredRoom !== null) {
               // Exit
               this.lastHoveredRoom = null
               this.onRoomHover!(null, global.x, global.y)
           }
       })
    }
    
    // Theme Manager
    this.themeManager = options.themeManager || new ThemeManager()
    this.config = this.themeManager.config
    
    // Create layers
    this.backgroundLayer = new Graphics()
    this.floorLayer = new FloorLayer()
    this.wallLayer = new WallLayer()
    this.objectLayer = new ObjectLayer()
    this.gridLayer = new GridLayer()
    this.labelLayer = new LabelLayer()
    this.debugLayer = new DebugLayer()
    this.spineDebugLayer = new SpineDebugLayer()
    this.overlayLayer = new Graphics()
    
    // VISIBILITY INIT
    this.visibilityLayer = new VisibilityLayer()
    
    // LAYER ORDER
    this.contentContainer.addChild(this.backgroundLayer)
    this.contentContainer.addChild(this.floorLayer.container)
    this.contentContainer.addChild(this.wallLayer.shadowContainer)  // Shadows under walls
    this.contentContainer.addChild(this.wallLayer.container)
    
    this.contentContainer.addChild(this.objectLayer.containerNode)
    
    // VISIBILITY STACK
    // Grid Lines should be affected by Fog? User said "Grid layer should adhere to light rules".
    // So Grid Lines -> Fog -> Light -> Entities?
    // If Grid is under Fog, it will get dark. Correct.
    // VISIBILITY STACK
    // Light MUST be below Fog to be occluded by Unexplored areas
    // VISIBILITY STACK
    // Grid must be BEFORE VisibilityLayer so Fog can occlude it
    this.contentContainer.addChild(this.gridLayer.container)
    this.contentContainer.addChild(this.visibilityLayer.containerNode)
    
    
    // Debug Layers
    this.contentContainer.addChild(this.overlayLayer)
    this.contentContainer.addChild(this.debugLayer.containerNode)
    this.contentContainer.addChild(this.spineDebugLayer.containerNode)
    this.contentContainer.addChild(this.labelLayer.containerNode)
    
    if (options.tileSize) {
      this.tileSize = options.tileSize
    }
    
    // Listen for theme changes
    this.themeManager.onThemeChange((name, config) => {
        this.config = config
        this.updateFilters()
    })

    // Initialize Roughness (Displacement)
    this.initRoughness()

    // Apply initial theme config (filters only)
    this.updateFilters()

    // Setup pan/zoom controller
    this.panZoomController = new PanZoomController(this.container, this.contentContainer)
    this.panZoomController.setOnZoomChange((zoom) => {
        this.gridLayer.updateZoom(zoom)
    })
  }

  public setDebugVisibility(fog: boolean, light: boolean) {
      this.showFog = fog
      this.showLight = light
      this.visibilityLayer.setVisibility(fog, light)
  }

  public updateVisibilityState(
      gridWidth: number, 
      gridHeight: number, 
      visionGrid: VisionGrid,
      playerX: number,
      playerY: number,
      lightProfile: LightProfile
  ) {
      this.visibilityLayer.update(
          gridWidth,
          gridHeight,
          visionGrid,
          playerX,
          playerY,
          lightProfile,
          { tileSize: this.tileSize, showFog: this.showFog, showLight: this.showLight }
      )
  }
  
  // NOTE: Switched to Direct Graphics for Fog to avoid RT overhead
  // [REMOVED] updateVisibilityGraphics and generateLightTexture - moved to VisibilityLayer

  private initRoughness() {
    const noiseTexture = createNoiseTexture(64)
    this.noiseSprite = new Sprite(noiseTexture)
    this.noiseSprite.scale.set(20)
    // Access texture source style correctly for PixiJS v8
    this.noiseSprite.texture.source.style.addressMode = 'repeat'
    this.noiseSprite.renderable = false
    this.container.addChild(this.noiseSprite)
  }

  private updateFilters() {
      // Apply displacement filter based on wall roughness
      const wallRough = this.config.walls.roughness
      
      if (wallRough > 0 && this.noiseSprite) {
          if (!this.displacementFilter) {
               this.displacementFilter = new DisplacementFilter({
                  sprite: this.noiseSprite,
                  scale: wallRough * 4 
               })
          } else {
              this.displacementFilter.scale.x = wallRough * 4
              this.displacementFilter.scale.y = wallRough * 4
          }
          this.displacementFilter.padding = (this.config.walls.width || 0) + 20
          
          this.contentContainer.filters = [this.displacementFilter]
      } else {
          this.contentContainer.filters = []
      }
  }
  
  /**
   * Set view dimensions for centering
   */
  public setViewDimensions(width: number, height: number): void {
    this.panZoomController.setViewDimensions(width, height)
    this.viewWidth = width
    this.viewHeight = height
  }
  
  /**
   * Sync position and zoom from another renderer's content container
   */
  public syncTransform(x: number, y: number, scale: number): void {
    this.panZoomController.syncTransform(x, y, scale)
  }
  
  /**
   * Get current transform for syncing to another renderer
   */
  public getTransform(): { x: number; y: number; scale: number } {
    return this.panZoomController.getTransform()
  }
  
  /**
   * Center the view on the dungeon (grid center)
   */
  public centerView(gridWidth: number, gridHeight: number): void {
      // Calculate center in tiles
      const cx = (gridWidth - 1) / 2
      const cy = (gridHeight - 1) / 2
      this.panZoomController.centerView(cx, cy, this.tileSize)
  }

  public focusOnTile(tx: number, ty: number): void {
      this.panZoomController.centerView(tx, ty, this.tileSize)
  }
  
  /**
   * Render the dungeon view from seed growth state OR DungeonData
   */
  public renderDungeonView(data: SeedGrowthState | DungeonData, settings: SeedGrowthSettings, showRoomNumbers: boolean = true, showWalkmap: boolean = false): void {
    console.log('[DungeonViewRenderer] renderDungeonView Start', { showWalkmap, rooms: (data as any).rooms?.length })
    this.clear()
    
    // Ensure filters are up to date (in case config changed)
    this.updateFilters()
    
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize
    
    // 1. Background (Expanded by 2 tiles in all directions)
    // Origin at -2, -2
    const pad = 2
    this.backgroundLayer.rect(
        -pad * size, 
        -pad * size, 
        (gridWidth + pad * 2) * size, 
        (gridHeight + pad * 2) * size
    )
    this.backgroundLayer.fill({ color: this.config.background })

    let rooms: Room[] = []
    let corridorTiles: { x: number; y: number }[] = []
    let renderedSpinePath: {x: number, y: number}[] = []
    let tributaryTiles: { x: number; y: number }[] = []
    let spineTiles: any[] = []

    // Check if we have Spine data (DungeonData) or Organic (SeedGrowthState)
    if ('spine' in data) {
        // --- SPINE MODE ---
        rooms = data.rooms
        this.renderedRooms = rooms // Update interaction target list
        spineTiles = (data as any).spine || []
        
        // Data must be pre-assembled by DungeonAssembler
        if (data.corridors && data.corridors.length > 0 && data.corridors[0].tiles.length > 0) {
            corridorTiles = data.corridors[0].tiles.map(t => ({ x: t.x, y: t.y }))
        } else {
            console.error('[DungeonViewRenderer] ERROR: No pre-assembled corridors! Call DungeonAssembler.assembleSpine() first.')
            corridorTiles = []
        }
        
    } else {
        // --- ORGANIC MODE ---
        rooms = (data as any).rooms || []
        this.renderedRooms = rooms // Update interaction target list
        
        // DEBUG: Verify TinyTitan
        const tinyRooms = rooms.filter(r => r.bounds.w === 1 && r.bounds.h === 1)
        console.warn(`[DungeonViewRenderer] Received ${rooms.length} rooms. 1x1 Rooms: ${tinyRooms.length}. TinyTitan Tagged: ${rooms.filter(r => (r.trellis as any)?.includes('#tinytitan')).length}`)
        
        // Data must be pre-assembled by DungeonAssembler
        if ((data as any).corridors && (data as any).corridors.length > 0) {
            corridorTiles = (data as any).corridors[0].tiles.map(t => ({ x: t.x, y: t.y }))
        } else {
            console.error('[DungeonViewRenderer] ERROR: No pre-assembled corridors for organic mode! Call DungeonAssembler.assembleOrganic() first.')
            corridorTiles = []
        }
    }

    // 3. Render floors (rooms + corridors) using FloorLayer
    console.log('[DungeonViewRenderer] Rendering Floors for', rooms.length, 'rooms')
    this.floorLayer.render(
      { rooms, corridorTiles },
      { tileSize: size, theme: this.config }
    )
    
    // 4. Render walls and shadows using WallLayer
    const wallSet = this.wallLayer.render(
      { rooms, corridorTiles, gridWidth: settings.gridWidth, gridHeight: settings.gridHeight },
      { tileSize: size, theme: this.config }
    )

    // 6. Render door markers
    // [REMOVED] Obsolete
    // this.renderDoorMarkers(rooms, corridorTiles, size)
    
    // 7. Render grid lines
    // Store local corridorTiles into class property for collision logic
    this.corridorTiles = new Set()
    // Convert array to Set if it's an array, or if it's already a Set copy it.
    // Wait, the local 'corridorTiles' (line 541) is Array.
    // The previous implementation of 'renderGridLines' likely accepts Array?
    // Let's populate the Set from the Array.
    for (const t of corridorTiles) {
        this.corridorTiles.add(`${t.x},${t.y}`)
    }
    
    this.gridLayer.render(
      { rooms, corridorTiles },
      { tileSize: size, theme: this.config, zoom: this.panZoomController.currentZoom }
    )

    // 8. Render Objects using ObjectLayer
    this.objectLayer.render(
      { objects: data.objects || [] },
      { tileSize: size }
    )
    
    // 8. Render room labels (only if enabled)
    // First, analyze "furthest rooms"
    const furthest = DungeonAnalysis.findFurthestRooms(data)
    
    // Create lookup map
    const furthestMap = new Map<string, FurthestRoomResult>()
    for (const f of furthest) {
        furthestMap.set(f.roomId, f)
    }

    if (showRoomNumbers) {
      this.labelLayer.render(
        { rooms, furthestMap, totalFurthest: furthest.length },
        { tileSize: size, showRoomNumbers: true }
      )
    } else {
      this.labelLayer.clear()
    }
    
    // 9. Render debug overlays (HeatMap, Walkmap)
    const spineTilesForHeat = (data as any).spine ? (data as any).spine : []
    this.debugLayer.render(
      { data, rooms, spineTiles: spineTilesForHeat },
      { tileSize: size, showHeatMap: this.showHeatMap, showWalkmap: showWalkmap }
    )
    
    console.log('[DungeonViewRenderer] Render Complete')
  }



  
  
  /**
   * Room Floor rendering
   */
  
  private renderWalkmap(data: DungeonData, size: number): void {
      const analysis = DungeonAnalysis.analyze(data)
      const { roomCosts, walkableTiles, roomTraversals, doorTraversals } = analysis
      
      const graphics = new Graphics()
      // Light blue with 50% transparency
      graphics.fillStyle = { color: 0xADD8E6, alpha: 0.5 } // light blue
      
      for (const key of walkableTiles) {
          const [x, y] = key.split(',').map(Number)
          graphics.rect(x * size, y * size, size, size)
          graphics.fill()
      }
      
      this.walkmapContainer.addChild(graphics)
      
      // Render Cost Labels
    // User requested: 1/2 square above room number, 1/2 square below for traversals
    const costStyle = {
        fontFamily: 'Arial',
        fontSize: Math.max(10, Math.floor(size / 2.5)),
        fontWeight: 'normal',
        fill: '#000000', // Black
        align: 'center'
    }
    
    for (const room of data.rooms) {
        // Use bounds center for consistency with room numbers
        const cx = room.bounds.x + room.bounds.w / 2
        const cy = room.bounds.y + room.bounds.h / 2
        
        const cost = roomCosts.get(room.id)
        if (cost !== undefined) {
            // Position: Center - 0.5 Y (above)
            const text = new Text({
                text: `(${cost})`,
                style: costStyle
            })
            text.anchor.set(0.5)
            text.x = cx * size
            text.y = (cy - 0.5) * size
            
            this.walkmapContainer.addChild(text)
        }
        
        // Render room/door traversal counts
        // Position: Center + 0.5 Y (below)
        const roomCount = roomTraversals.get(room.id) ?? 0
        const doorCount = doorTraversals.get(room.id) ?? 0
        
        const labelText = `R:${roomCount} D:${doorCount}`
        const traversalLabel = new Text({
            text: labelText,
            style: costStyle // Match font size to movement costs
        })
        traversalLabel.anchor.set(0.5)
        traversalLabel.x = cx * size
        traversalLabel.y = (cy + 0.5) * size
        
        this.walkmapContainer.addChild(traversalLabel)
    }
}
  
  /**
   * Main render method for the dungeon.
   */
  public render(data: SeedGrowthState | DungeonData, settings: SeedGrowthSettings, showRoomNumbers: boolean = true, showWalkmap: boolean = false): void {
    // Clear previous
    this.backgroundLayer.clear()
    this.floorLayer.clear()
    this.wallLayer.clear()
    this.gridLayer.clear()
    this.heatMapLayer.clear()
    this.overlayLayer.clear()
    this.objectLayer.clear()
    this.labelContainer.removeChildren()
    this.walkmapContainer.removeChildren() // Clear Walkmap

    // ... (rest of the render logic would go here)
    // For example:
    // if (showWalkmap && data instanceof DungeonData) {
    //   this.renderWalkmap(data, settings.tileSize)
    // }
    // ...
  }
  
  /**
   * Clear all layers
   */
  public clear(): void {
    this.backgroundLayer.clear()
    this.floorLayer.clear()
    this.wallLayer.clear()
    this.gridLayer.clear()
    this.debugLayer.clear()
    this.overlayLayer.clear()
    this.labelLayer.clear()
    this.objectLayer.clear()
  }
  
  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    this.themeManager.offThemeChange(this.onThemeChange)
    this.container.destroy({ children: true })
  }
  
  /**
   * Get the container
   */
  public getContainer(): Container {
    return this.container
  }
  
  /**
   * Get the content container (for accessing transform)
   */
  public getContentContainer(): Container {
    return this.contentContainer
  }
  
  /**
   * Toggle room number labels visibility
   */
  public setShowRoomNumbers(show: boolean): void {
    this.labelLayer.setVisible(show)
  }

  /**
   * Helper to expose walkable tiles for PlayerController/Visibility
   */
  public getWalkableTiles(): {x: number, y: number}[] {
    const tiles: {x: number, y: number}[] = []
    for (const k of this.corridorTiles) {
      const [x, y] = k.split(',').map(Number)
      tiles.push({x, y})
    }
    return tiles
  }
  
  /**
   * Toggle heat map visibility
   */
  public setShowHeatMap(visible: boolean): void {
      this.showHeatMap = visible
      this.debugLayer.setVisibility(visible, this.showWalkmap)
  }

  public setShowWalkmap(visible: boolean): void {
      this.showWalkmap = visible
      this.debugLayer.setVisibility(this.showHeatMap, visible)
  }

  /**
   * Toggle spine debug overlay visibility
   */
  public setShowSpineDebug(visible: boolean): void {
      this.showSpineDebug = visible
      this.spineDebugLayer.setVisible(visible)
      // Re-render if we have cached state
      if (visible && this.cachedSpineState) {
          this.spineDebugLayer.render(this.cachedSpineState, { tileSize: this.tileSize })
      }
  }

  /**
   * Set the spine state for debug overlay (call before rendering when in spine mode)
   */
  public setSpineState(state: SpineSeedState | null): void {
      this.cachedSpineState = state
      if (this.showSpineDebug && state) {
          this.spineDebugLayer.render(state, { tileSize: this.tileSize })
      }
  }

  public setPlayerVisibility(visible: boolean): void {
      this.entityLayer.visible = visible
  }



  // Bind for cleanup
  private onThemeChange = (name: string, config: RoomLayerConfig) => {
      this.config = config
      this.updateFilters()
  }
  // Heat map calculation moved to HeatMapCalculator.ts
}
