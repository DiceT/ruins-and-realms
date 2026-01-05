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
import { 
  FloorLayer, WallLayer, GridLayer, ObjectLayer, LabelLayer, 
  DebugLayer, VisibilityLayer, SpineDebugLayer,
  toFloorRenderData, toThemeColors, toWallRenderData, toGridRenderData,
  toObjectLayerData, toLabelRenderData, toDebugRenderData, toSpineDebugRenderData,
  roomToRenderData
} from '../../systems/layers'
import { calculateWalls, buildFloorSet } from '../../processors/WallCalculator'
import { PanZoomController } from '../controllers/PanZoomController'
import { createNoiseTexture } from '../../utils/rendering'
import { LayerManager } from '../../systems/LayerManager'

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

  // Managers
  private panZoomController: PanZoomController
  private layerManager: LayerManager
  
  // Layers (References for rendering data updates)
  private backgroundLayer: Graphics
  private floorLayer: FloorLayer
  private wallLayer: WallLayer
  private objectLayer: ObjectLayer 
  private gridLayer: GridLayer  
  private labelLayer: LabelLayer
  private debugLayer: DebugLayer
  private spineDebugLayer: SpineDebugLayer
  private overlayLayer: Graphics
  
  // --- New Visibility Layers ---
  private visibilityLayer: VisibilityLayer
  
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
  
  // Debug state tracking
  private showFog: boolean = false
  private showLight: boolean = false
  private showPlayer: boolean = false
  private showHeatMap: boolean = false
  private showWalkmap: boolean = false
  private showSpineDebug: boolean = false
  private cachedSpineState: SpineSeedState | null = null

  constructor(parentContainer: Container, options: DungeonViewOptions = {}) {
    this.container = new Container()
    this.container.eventMode = 'static'
    parentContainer.addChild(this.container)
    
    this.contentContainer = new Container()
    this.container.addChild(this.contentContainer)
    
    // Initialize Layer Manager
    this.layerManager = new LayerManager(this.contentContainer)
    
    this.onRoomHover = options.onRoomHover

    // Interaction Handling (same as before)
    if (this.onRoomHover) {
       this.container.addEventListener('pointermove', (e) => {
           const global = e.global
           const local = this.contentContainer.toLocal(global)
           
           let hovered: Room | null = null
           
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
           
           if (hovered?.id !== this.lastHoveredRoom) {
               this.lastHoveredRoom = hovered ? hovered.id : null
               this.onRoomHover!(hovered, global.x, global.y)
           } else if (!hovered && this.lastHoveredRoom !== null) {
               this.lastHoveredRoom = null
               this.onRoomHover!(null, global.x, global.y)
           }
       })
    }
    
    // Theme Manager
    this.themeManager = options.themeManager || new ThemeManager()
    this.config = this.themeManager.config
    
    // Init Visual Components
    this.backgroundLayer = new Graphics()
    this.floorLayer = new FloorLayer()
    this.wallLayer = new WallLayer()
    this.objectLayer = new ObjectLayer()
    this.gridLayer = new GridLayer()
    this.labelLayer = new LabelLayer()
    this.debugLayer = new DebugLayer()
    this.spineDebugLayer = new SpineDebugLayer()
    this.overlayLayer = new Graphics()
    this.visibilityLayer = new VisibilityLayer()
    
    // LAYER REGISTRATION (Z-Index Strategy)
    // 0: Background
    this.layerManager.register('background', this.backgroundLayer, { zIndex: 0 })
    // 10: Floor
    this.layerManager.register('floor', this.floorLayer.container, { zIndex: 10 })
    // 15-20: Walls (shadows and walls consolidated in single container)
    this.layerManager.register('wall', this.wallLayer.container, { zIndex: 15 })
    // 30: Objects
    this.layerManager.register('object', this.objectLayer.container, { zIndex: 30 })
    // 40: Grid
    this.layerManager.register('grid', this.gridLayer.container, { zIndex: 40 })
    
    // VISIBILITY STACK
    // 50: Light (Screen blend)
    this.layerManager.register('light', this.visibilityLayer.lightNode, { zIndex: 50, group: 'visibility', visible: false })
    // 52: Darkness (Multiply)
    this.layerManager.register('darkness', this.visibilityLayer.darknessNode, { zIndex: 52, group: 'visibility', visible: false })
    // 55: Fog (Blackness)
    this.layerManager.register('fog', this.visibilityLayer.fogNode, { zIndex: 55, group: 'visibility', visible: false })
    // 60: Entity (Player)
    this.layerManager.register('entity', this.visibilityLayer.entityNode, { zIndex: 60, group: 'visibility', visible: false })
    
    // DEBUG LAYERS
    // 80: Spine Debug
    this.layerManager.register('spineDebug', this.spineDebugLayer.container, { zIndex: 80, group: 'debug', visible: false })
    // 90: General Debug (Heatmap/Walkmap)
    this.layerManager.register('debug', this.debugLayer.container, { zIndex: 90, group: 'debug', visible: false })
    // 95: Overlay
    this.layerManager.register('overlay', this.overlayLayer, { zIndex: 95, group: 'debug', visible: false })
    // 100: Labels
    this.layerManager.register('label', this.labelLayer.container, { zIndex: 100, visible: true })

    
    if (options.tileSize) {
      this.tileSize = options.tileSize
    }
    
    // Listen for theme changes
    this.themeManager.onThemeChange(this.onThemeChange)

    // Initialize Roughness (Displacement)
    this.initRoughness()
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
      
      // Use LayerManager to toggle
      this.layerManager.toggle('fog', fog)
      this.layerManager.toggle('light', light)
      this.layerManager.toggle('darkness', light) // Darkness pairs with light
      
      // Update logic layer: WE DO NOT TOGGLE VISIBILITY HERE ANYMORE.
      // LayerManager handles the container visibility.
      // VisibilityLayer.update() handles the graphics generation.
  }

  public updateVisibilityState(
      gridWidth: number, 
      gridHeight: number, 
      visionGrid: VisionGrid,
      playerX: number,
      playerY: number,
      lightProfile: LightProfile
  ) {
      // Update logic + graphics generation
      this.visibilityLayer.update(
          gridWidth,
          gridHeight,
          visionGrid,
          playerX,
          playerY,
          lightProfile,
          { tileSize: this.tileSize, showFog: this.showFog, showLight: this.showLight, showPlayer: this.showPlayer }
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
      // Calculate center in tiles (horizontal unchanged, vertical at half height)
      const cx = (gridWidth - 1) / 2
      const cy = gridHeight / 2
      this.panZoomController.centerView(cx, cy, this.tileSize)
  }

  public focusOnTile(tx: number, ty: number): void {
      this.panZoomController.centerView(tx, ty, this.tileSize)
  }
  
  /**
   * Render the dungeon view from seed growth state OR DungeonData
   */
  public renderDungeonView(data: SeedGrowthState | DungeonData, settings: SeedGrowthSettings, showRoomNumbers: boolean = true, showWalkmap: boolean = false): void {
    // Clean canvas via LayerManager helper
    this.clear()
    
    this.updateFilters()
    
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize
    
    // 1. Background
    const pad = 2
    this.backgroundLayer.clear()
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
        
        // Data must be pre-assembled by DungeonAssembler
        if ((data as any).corridors && (data as any).corridors.length > 0) {
            corridorTiles = (data as any).corridors[0].tiles.map(t => ({ x: t.x, y: t.y }))
        } else {
            console.error('[DungeonViewRenderer] ERROR: No pre-assembled corridors for organic mode! Call DungeonAssembler.assembleOrganic() first.')
            corridorTiles = []
        }
    }

    // 3. Render floors (rooms + corridors) using FloorLayer with adapters
    const themeColors = toThemeColors(this.config)
    this.floorLayer.render(
      toFloorRenderData(rooms, corridorTiles),
      { tileSize: size, theme: themeColors }
    )
    
    // 4. Pre-compute walls using WallCalculator, then render
    const roomRenderData = rooms.map(roomToRenderData)
    const { wallSet } = calculateWalls({
      rooms: roomRenderData,
      corridorTiles,
      gridWidth: settings.gridWidth,
      gridHeight: settings.gridHeight
    })
    this.wallLayer.render(
      toWallRenderData(wallSet),
      { tileSize: size, theme: themeColors }
    )

    // 5. Store corridor tiles for collision logic
    this.corridorTiles = new Set()
    for (const t of corridorTiles) {
        this.corridorTiles.add(`${t.x},${t.y}`)
    }
    
    // 6. Render grid
    this.gridLayer.render(
      toGridRenderData(rooms, corridorTiles),
      { tileSize: size, theme: themeColors, zoom: this.panZoomController.currentZoom }
    )

    // 7. Render Objects using ObjectLayer
    this.objectLayer.render(
      toObjectLayerData(data.objects || []),
      { tileSize: size }
    )
    
    // 8. Render room labels (only if enabled)
    const furthest = DungeonAnalysis.findFurthestRooms(data)
    const furthestMap = new Map<string, FurthestRoomResult>()
    for (const f of furthest) {
        furthestMap.set(f.roomId, f)
    }

    if (showRoomNumbers) {
      this.labelLayer.render(
        toLabelRenderData(rooms, furthestMap, furthest.length),
        { tileSize: size, showRoomNumbers: true }
      )
    } else {
      this.labelLayer.clear()
    }
    
    // 9. Render debug overlays
    // Get walkmap data from DungeonAnalysis for full debug info
    const analysis = DungeonAnalysis.analyze(data as DungeonData)
    this.debugLayer.render(
      toDebugRenderData(
        rooms, 
        data.heatScores, 
        analysis.walkableTiles,
        analysis.roomCosts,
        analysis.roomTraversals,
        analysis.doorTraversals
      ),
      { tileSize: size, showHeatMap: this.showHeatMap, showWalkmap: showWalkmap }
    )
    
    // NOTE: VisibilityLayer doesn't need explicit render call here, it updates via updateVisibilityState
  }



  
  
  /**
   * Room Floor rendering
   */
  

  
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
   * Get rooms that were rendered (for walkmap building)
   */
  public getRenderedRooms(): Room[] {
    return this.renderedRooms
  }
  
  /**
   * Toggle heat map visibility
   */
  public setShowHeatMap(visible: boolean): void {
      this.showHeatMap = visible
      this.debugLayer.setVisibility(visible, this.showWalkmap)
      // Ensure the parent 'debug' layer is visible if either child is active
      const showDebugGroup = visible || this.showWalkmap
      this.layerManager.toggle('debug', showDebugGroup)
  }

  public setShowWalkmap(visible: boolean): void {
      this.showWalkmap = visible
      this.debugLayer.setVisibility(this.showHeatMap, visible)
      // Ensure the parent 'debug' layer is visible if either child is active
      const showDebugGroup = this.showHeatMap || visible
      this.layerManager.toggle('debug', showDebugGroup)
  }

  /**
   * Toggle spine debug overlay visibility
   */
  public setShowSpineDebug(visible: boolean): void {
      this.showSpineDebug = visible
      this.spineDebugLayer.setVisible(visible)
      // Ensure the parent 'spineDebug' layer is visible
      this.layerManager.toggle('spineDebug', visible)
      
      // Re-render if we have cached state
      if (visible && this.cachedSpineState) {
          const spinePath = (this.cachedSpineState.spineTiles || []).map(t => ({ x: t.x, y: t.y }))
          const ejectedSeeds = (this.cachedSpineState.roomSeeds || []).map(s => ({
            position: { x: s.position.x, y: s.position.y },
            id: s.id || 'seed',
            bounds: s.currentBounds,
            sourceSpineTile: s.sourceSpineTile
          }))
          this.spineDebugLayer.render(
            toSpineDebugRenderData(spinePath, ejectedSeeds),
            { tileSize: this.tileSize }
          )
      }
  }

  /**
   * Set the spine state for debug overlay (call before rendering when in spine mode)
   */
  public setSpineState(state: SpineSeedState | null): void {
      this.cachedSpineState = state
      if (this.showSpineDebug && state) {
          const spinePath = (state.spineTiles || []).map(t => ({ x: t.x, y: t.y }))
          const ejectedSeeds = (state.roomSeeds || []).map(s => ({
            position: { x: s.position.x, y: s.position.y },
            id: s.id || 'seed',
            bounds: s.currentBounds,
            sourceSpineTile: s.sourceSpineTile
          }))
          this.spineDebugLayer.render(
            toSpineDebugRenderData(spinePath, ejectedSeeds),
            { tileSize: this.tileSize }
          )
      }
  }

  public setPlayerVisibility(visible: boolean): void {
      this.showPlayer = visible
      // Toggle the entity layer visibility
      this.layerManager.toggle('entity', visible)
      this.visibilityLayer.setPlayerVisible(visible)
  }
  
  /**
   * Clear all layers
   */
  public clear(): void {
    // Clear Static Content Layers
    this.backgroundLayer.clear()
    this.floorLayer.clear()
    this.wallLayer.clear()
    this.gridLayer.clear()
    this.labelLayer.clear()
    this.objectLayer.clear()
    
    // Clear Debug Layers Internal State
    this.debugLayer.clear()
    this.spineDebugLayer.clear()
    this.overlayLayer.clear()
  }
  private onThemeChange = (name: string, config: RoomLayerConfig) => {
      this.config = config
      this.updateFilters()
  }
  // Heat map calculation moved to HeatMapCalculator.ts
}
