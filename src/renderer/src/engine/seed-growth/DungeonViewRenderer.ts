/**
 * Dungeon View Renderer
 * 
 * Renders the seed growth output as a proper dungeon visualization.
 * This is separate from the debug/growth visualization in SeedGrowthRenderer.
 * 
 * Usage: When "View as Dungeon" is enabled, this renderer takes over
 * and displays rooms, corridors, and walls in a dungeon style.
 */

import { Container, Graphics, FederatedPointerEvent, Text, TextStyle, DisplacementFilter, Sprite, Texture, Assets } from 'pixi.js'
import { SeedGrowthState, SeedGrowthSettings, Room, Corridor, Connection, DungeonData, DungeonObject } from './types'
import { CorridorPathfinder } from './CorridorPathfinder'
import { DungeonDecorator } from './DungeonDecorator'
import { SeededRNG } from '../../utils/SeededRNG'
import { DungeonAnalysis, FurthestRoomResult } from '../analysis/DungeonAnalysis'
import { ThemeManager } from '../managers/ThemeManager'
import { RoomLayerConfig } from '../themes/ThemeTypes'
import { createNoiseTexture } from '../utils/rendering'
import stairsIcon from '../../assets/images/icons/stairs.svg'
import doorIcon from '../../assets/images/icons/door.svg'
import doorSecretIcon from '../../assets/images/icons/door-secret.svg'
import doorArchwayIcon from '../../assets/images/icons/door-archway.svg'
import doorLockedIcon from '../../assets/images/icons/door-locked.svg'
import doorPortcullisIcon from '../../assets/images/icons/door-portcullis.svg'
import doorBarredIcon from '../../assets/images/icons/door-barred.svg'

export interface DungeonViewOptions {
  tileSize?: number
  showGrid?: boolean
  showRoomLabels?: boolean
  themeManager?: ThemeManager
}

export class DungeonViewRenderer {
  private container: Container
  private contentContainer: Container
  private tileSize: number = 8
  
  // Theme Manager
  private themeManager: ThemeManager
  private config: RoomLayerConfig

  // Pan/zoom state
  private isPanning: boolean = false
  private lastPanPos: { x: number; y: number } = { x: 0, y: 0 }
  private zoom: number = 0.25
  private readonly minZoom = 0.05
  private readonly maxZoom = 4.0
  
  // Layers
  private backgroundLayer: Graphics
  private shadowLayer: Graphics // New: Shadows
  private floorLayer: Graphics
  private wallLayer: Graphics
  private objectLayer: Container // New: Objects (Sprites, Decorations)
  private gridLineLayer: Graphics  // Separate layer for grid lines (re-rendered on zoom)
  private overlayLayer: Graphics
  private heatMapLayer: Graphics    // Heat map debug layer
  private walkmapContainer: Container // New: Walkmap overlay
  private labelContainer: Container

  // FX
  private noiseSprite: Sprite | null = null
  private displacementFilter: DisplacementFilter | null = null
  
  // View state
  private viewWidth: number = 800
  private viewHeight: number = 600
  
  // Grid line state (stored for re-rendering on zoom)
  private floorPositions: Set<string> = new Set()
  
  constructor(parentContainer: Container, options: DungeonViewOptions = {}) {
    this.container = new Container()
    this.container.eventMode = 'static'
    parentContainer.addChild(this.container)
    
    this.contentContainer = new Container()
    this.container.addChild(this.contentContainer)
    
    // Theme Manager
    this.themeManager = options.themeManager || new ThemeManager()
    this.config = this.themeManager.config
    
    // Create layers
    this.backgroundLayer = new Graphics()
    this.shadowLayer = new Graphics() // Shadow below floor/walls? Or between?
    // Usually: Floor -> Shadow (on top of floor) -> Walls
    // Or: Shadow (behind everything) -> Floor -> Walls?
    // Let's put Shadow ON TOP of Floor, UNDER Walls.
    
    this.floorLayer = new Graphics()
    this.wallLayer = new Graphics()
    this.objectLayer = new Container()
    this.gridLineLayer = new Graphics()
    this.overlayLayer = new Graphics()
    this.heatMapLayer = new Graphics()
    this.heatMapLayer.visible = false  // Default OFF
    this.heatMapLayer.visible = false  // Default OFF
    this.walkmapContainer = new Container()
    this.labelContainer = new Container()
    
    this.contentContainer.addChild(this.backgroundLayer)
    this.contentContainer.addChild(this.floorLayer)
    this.contentContainer.addChild(this.shadowLayer) // Shadows on top of floor
    this.contentContainer.addChild(this.wallLayer)
    this.contentContainer.addChild(this.objectLayer) // Objects on top of walls (or below?) usually above floors, maybe below high walls? User said "map icons", usually top.
    this.contentContainer.addChild(this.heatMapLayer)  // Above walls
    this.contentContainer.addChild(this.gridLineLayer)
    this.contentContainer.addChild(this.overlayLayer)
    this.contentContainer.addChild(this.overlayLayer)
    this.contentContainer.addChild(this.walkmapContainer)
    this.contentContainer.addChild(this.labelContainer)
    
    if (options.tileSize) {
      this.tileSize = options.tileSize
    }
    
    // Listen for theme changes
    this.themeManager.onThemeChange((name, config) => {
        this.config = config
        // Re-apply filters immediately
        this.updateFilters()
        // If we had data, we would re-render. 
        // For now, next render() call will pick up colors.
        // We can force existing graphics to update color if we stored the data...
        // But DungeonViewRenderer is stateless regarding data storage (passed in render).
        // So this will take effect on next render loop or user interaction.
    })

    // Initialize Roughness (Displacement)
    this.initRoughness()

    // Apply initial theme config (filters only, geometry needs render call)
    this.updateFilters()

    // Setup pan/zoom
    this.setupPanZoom()
  }

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
  
  private setupPanZoom(): void {
    // Hit area for events
    this.container.hitArea = { contains: () => true }
    
    // Pan: right mouse or middle mouse drag
    this.container.on('pointerdown', (e: FederatedPointerEvent) => {
      if (e.button === 2 || e.button === 1) {
        this.isPanning = true
        this.lastPanPos = { x: e.globalX, y: e.globalY }
      }
    })
    
    this.container.on('pointermove', (e: FederatedPointerEvent) => {
      if (this.isPanning) {
        const dx = e.globalX - this.lastPanPos.x
        const dy = e.globalY - this.lastPanPos.y
        this.contentContainer.x += dx
        this.contentContainer.y += dy
        this.lastPanPos = { x: e.globalX, y: e.globalY }
      }
    })
    
    this.container.on('pointerup', () => {
      this.isPanning = false
    })
    
    this.container.on('pointerupoutside', () => {
      this.isPanning = false
    })
    
    // Zoom: mouse wheel - zoom towards VIEW CENTER
    this.container.on('wheel', (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * zoomFactor))
      
      if (newZoom !== this.zoom) {
        const centerX = this.viewWidth / 2
        const centerY = this.viewHeight / 2
        
        const beforeZoomX = (centerX - this.contentContainer.x) / this.zoom
        const beforeZoomY = (centerY - this.contentContainer.y) / this.zoom
        
        this.zoom = newZoom
        this.contentContainer.scale.set(this.zoom)
        
        this.contentContainer.x = centerX - beforeZoomX * this.zoom
        this.contentContainer.y = centerY - beforeZoomY * this.zoom
        
        // Re-render grid lines with constant screen-space width
        this.updateGridLines()
      }
    })
  }
  
  /**
   * Set view dimensions for centering
   */
  public setViewDimensions(width: number, height: number): void {
    this.viewWidth = width
    this.viewHeight = height
  }
  
  /**
   * Sync position and zoom from another renderer's content container
   */
  public syncTransform(x: number, y: number, scale: number): void {
    this.contentContainer.x = x
    this.contentContainer.y = y
    this.zoom = scale
    this.contentContainer.scale.set(scale)
  }
  
  /**
   * Get current transform for syncing to another renderer
   */
  public getTransform(): { x: number; y: number; scale: number } {
    return {
      x: this.contentContainer.x,
      y: this.contentContainer.y,
      scale: this.zoom
    }
  }
  
  /**
   * Center the view on the dungeon
   */
  public centerView(gridWidth: number, gridHeight: number): void {
    const contentWidth = gridWidth * this.tileSize * this.zoom
    const contentHeight = gridHeight * this.tileSize * this.zoom
    
    this.contentContainer.x = (this.viewWidth - contentWidth) / 2
    this.contentContainer.y = (this.viewHeight - contentHeight) / 2
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

    // Check if we have Spine data (DungeonData) or Organic (SeedGrowthState)
    if ('spine' in data) {
        // --- SPINE MODE ---
        // Use passed rooms (already pruned)
        rooms = data.rooms
        
        // The spineTiles array only contains CENTER path tiles.
        const spineTiles = (data as any).spine || []
        
        // 0. Calculate Scores
        const heatScores = this.calculateWallHeatScores(rooms, spineTiles)
        
        // --- SPINE PRUNING ---
        // Determine active range of the spine
        let minActiveIndex = 0
        let maxActiveIndex = spineTiles.length - 1
        
        if (spineTiles.length > 0) {
            // Skip early pruning - final cleanup pass after tributaries handles dead-ends
            // Just determine if stairs should be at spine start (affects south trimming)
            const spineWidth = data.spineWidth || 1
            const rng = new SeededRNG(settings.seed)
            let stairsOnSpine = false
            if (spineWidth >= 3) {
                if (Math.floor(rng.next() * 100) < 50) stairsOnSpine = true
            }
            
            // Use full spine range - final cleanup will trim dead ends
            minActiveIndex = 0
            maxActiveIndex = spineTiles.length - 1
        }
        
        // Ensure valid range
        if (minActiveIndex > maxActiveIndex) {
            minActiveIndex = 0
            maxActiveIndex = spineTiles.length - 1
        }
        
        const activeSpineTiles = spineTiles.slice(minActiveIndex, maxActiveIndex + 1)
        
        // Use activeSpineTiles for heat map and generation
        // But 'heatScores' was calculated on FULL spine. That's fine, scores are per-tile.
        // We need to use activeSpineTiles for rendering the corridor.
        
        // 1. Build Blocked Set (Room Floors)
        const blockedSet = new Set<string>()
        for (const room of rooms) {
            for (const tile of room.tiles) {
                blockedSet.add(`${tile.x},${tile.y}`)
            }
        }
        
        const spineWidth = data.spineWidth || 1
        let targetSet = new Set<string>()

        if (spineWidth > 1) {
            // --- MODE A: SPINE CORRIDOR (Width 3, 5, 7) ---
            const effectiveWidth = Math.max(1, spineWidth - 2)
            const radius = Math.floor((effectiveWidth - 1) / 2)
            
            const fullSpineSet = new Set<string>()
            const fullSpineTiles: { x: number, y: number, dir: string }[] = []
            
            for (const t of activeSpineTiles) {
                const key = `${t.x},${t.y}`
                if (!fullSpineSet.has(key)) {
                    fullSpineSet.add(key)
                    fullSpineTiles.push({ x: t.x, y: t.y, dir: t.direction || 'north' })
                }
                if (radius > 0) {
                    const dir = t.direction || 'north'
                    const perps = dir === 'north' || dir === 'south' 
                        ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                        : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                    for (let i = 1; i <= radius; i++) {
                        for (const p of perps) {
                            const px = t.x + p.x * i
                            const py = t.y + p.y * i
                            const pkey = `${px},${py}`
                            if (!fullSpineSet.has(pkey)) {
                                fullSpineSet.add(pkey)
                                fullSpineTiles.push({ x: px, y: py, dir })
                            }
                        }
                    }
                }
            }

            renderedSpinePath = fullSpineTiles.map(t => ({ x: t.x, y: t.y }))
            for (const t of renderedSpinePath) targetSet.add(`${t.x},${t.y}`)

        } else {
            // --- MODE B: NETWORK / ORGANIC SPINE (Width 1) ---
            if (rooms.length > 0) {
                const seedRoom = rooms.reduce((prev, curr) => (prev.id.localeCompare(curr.id) < 0 ? prev : curr))
                for (const tile of seedRoom.tiles) {
                    targetSet.add(`${tile.x},${tile.y}`)
                }
            }
        }

        // 3. Generate Tributary Corridors
        const pathfinder = new CorridorPathfinder(settings.seed)
        tributaryTiles = pathfinder.generateSpineCorridors(
            data.gridWidth, 
            data.gridHeight, 
            rooms, 
            activeSpineTiles, 
            heatScores,
            targetSet,
            blockedSet
        )

        // 4. RANGE-BASED PRUNING: Identify first and last "useful" spine segments
        // A spine segment is "useful" if any part of its width touches a room, tributary, or object.
        {
            const roomTileSet = new Set<string>()
            for (const r of rooms) {
                for (const t of r.tiles) roomTileSet.add(`${t.x},${t.y}`)
            }
            const tributarySet = new Set(tributaryTiles.map(t => `${t.x},${t.y}`))
            const objectSet = new Set((data.objects || []).map(o => `${o.x},${o.y}`))
            
            // Helpful set for collision
            const usefulSet = new Set([...roomTileSet, ...tributarySet, ...objectSet])
            
            const spineWidth = data.spineWidth || 1
            const effectiveWidth = Math.max(1, spineWidth - 2)
            const radius = Math.floor((effectiveWidth - 1) / 2)
            
            const usedIndices: number[] = []
            
            for (let i = 0; i < spineTiles.length; i++) {
                const st = spineTiles[i]
                const sliceKeys = [ `${st.x},${st.y}` ]
                
                if (radius > 0) {
                    const dir = st.direction || 'north'
                    const perps = dir === 'north' || dir === 'south' 
                        ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                        : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                    for (let r = 1; r <= radius; r++) {
                        for (const p of perps) {
                            sliceKeys.push(`${st.x + p.x * r},${st.y + p.y * r}`)
                        }
                    }
                }
                
                // Check for ANY connection in this slice
                const isUsed = sliceKeys.some(key => usefulSet.has(key))
                
                if (isUsed) usedIndices.push(i)
            }
            
            if (usedIndices.length > 0) {
                const first = usedIndices[0]
                const last = usedIndices[usedIndices.length - 1]
                
                // Final range
                const newMin = first
                const newMax = last
                
                // Prune the spine path
                const prunedSpineTiles = spineTiles.slice(newMin, newMax + 1)
                
                // Now we RE-GENERATE the fat corridor from the pruned spine path
                const newFullSpineSet = new Set<string>()
                const newFullSpineTiles: { x: number, y: number }[] = []
                
                for (const t of prunedSpineTiles) {
                    const key = `${t.x},${t.y}`
                    if (!newFullSpineSet.has(key)) {
                        newFullSpineSet.add(key)
                        newFullSpineTiles.push({ x: t.x, y: t.y })
                    }
                    if (radius > 0) {
                        const dir = t.direction || 'north'
                        const perps = dir === 'north' || dir === 'south' 
                            ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                            : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                        for (let r = 1; r <= radius; r++) {
                            for (const p of perps) {
                                const px = t.x + p.x * r
                                const py = t.y + p.y * r
                                const pkey = `${px},${py}`
                                if (!newFullSpineSet.has(pkey)) {
                                    newFullSpineSet.add(pkey)
                                    newFullSpineTiles.push({ x: px, y: py })
                                }
                            }
                        }
                    }
                }
                
                renderedSpinePath = newFullSpineTiles
            }
        }

        // 5. Finalize Data (Keep separate!)
        corridorTiles = [...renderedSpinePath, ...tributaryTiles]
        
        // Update data.spine to be the PHYSICAL spine corridor (for Analysis)
        ;(data as any).spine = renderedSpinePath
        
        this.renderHeatMap(heatScores, size)
        
    } else {
        // --- ORGANIC MODE ---
        // @ts-ignore - Handle legacy state access
        rooms = data.rooms || []
        
        // Generate corridors using pathfinder
        const pathfinder = new CorridorPathfinder(settings.seed)
        // @ts-ignore
        corridorTiles = pathfinder.generate(data, rooms)
        tributaryTiles = corridorTiles // In organic mode, they are the same
    }
    
    // --- DECORATION PHASE ---
    // Update data with generated corridors so Decorator can see them.
    // CRITICAL: Spine Path != Corridor. Decorator only sees tributaries.
    if (!data.corridors) (data as any).corridors = []
    
    ;(data as any).corridors = [{
        id: 'generated_render_corridors',
        tiles: tributaryTiles.map(t => ({ x: t.x, y: t.y }))
    }]

    // Place objects (Stairs, Doors, etc.)
    const decorator = new DungeonDecorator(settings.seed)
    decorator.decorate(data)

    // Inject 'hasFloor' objects into corridorTiles so they get walls & floors
    if (data.objects) {
        for (const obj of data.objects) {
            if (obj.properties?.hasFloor) {
                corridorTiles.push({ x: obj.x, y: obj.y })
            }
        }
    }

    // 3. Render ROOM floors
    console.log('[DungeonViewRenderer] Rendering Floors for', rooms.length, 'rooms')
    for (const room of rooms) {
      this.renderRoomFloor(room, size)
    }
    
    // 4. Render corridor floors
    // Color depends on config - maybe distinct corridor color or same as floor
    // Using theme's floor color for now, unless we want to distinguish
    for (const pos of corridorTiles) {
      this.floorLayer.rect(pos.x * size, pos.y * size, size - 1, size - 1)
      this.floorLayer.fill({ color: this.config.floor.color }) // Use theme floor
    }
    
    // 5. Render walls (around rooms AND corridors)
    const wallSet = this.renderWalls(rooms, settings, size, corridorTiles)
    
    // 5b. Render Shadows
    // Only if wallRoughness > 0 or specific shadow config exists?
    // Theme configs usually have shadows defined if they are 'Dungeon' etc.
    if (this.config.shadow) {
        this.renderShadows(wallSet, size)
    }

    // 6. Render door markers
    // [REMOVED] Obsolete
    // this.renderDoorMarkers(rooms, corridorTiles, size)
    
    // 7. Render grid lines
    this.renderGridLines(rooms, corridorTiles, size)
    
    // 8. Render room labels (only if enabled)
    // First, analyze "furthest rooms"
    const furthest = DungeonAnalysis.findFurthestRooms(data)
    
    // Create lookup map
    const furthestMap = new Map<string, FurthestRoomResult>()
    for (const f of furthest) {
        furthestMap.set(f.roomId, f)
    }

    if (showRoomNumbers) {
      this.renderRoomLabels(rooms, size, furthestMap, furthest.length)
    }
    
    // 9. Render heat map (always renders, visibility controlled by toggle)
    const spineTilesForHeat = (data as any).spine ? (data as any).spine : []
    this.renderHeatMap(rooms, spineTilesForHeat, size)

    // 10. Render Objects
    this.renderObjects(data.objects || [], size)
    
    // 11. Render Walkmap (debug overlay)
    if (showWalkmap) {
        console.log('[DungeonViewRenderer] Rendering Walkmap')
        this.renderWalkmap(data, size)
    }
    console.log('[DungeonViewRenderer] Render Complete')
  }

  private renderObjects(objects: DungeonObject[], size: number): void {
      this.objectLayer.removeChildren()
      
      for (const obj of objects) {
          if (obj.type === 'stairs_up') {
              const sprite = new Sprite()
              sprite.x = obj.x * size
              sprite.y = obj.y * size
              sprite.width = size
              sprite.height = size
              this.objectLayer.addChild(sprite)

              Assets.load(stairsIcon).then((texture) => {
                  sprite.texture = texture
                  // Ensure scaling is maintained
                  sprite.width = size
                  sprite.height = size
              }).catch(err => {
                  console.error('Failed to load stairs icon', err)
              })
          }
          else if (obj.type.startsWith('door')) {
              const sprite = new Sprite()
              // Center anchor for rotation
              sprite.anchor.set(0.5)
              sprite.x = (obj.x + 0.5) * size
              sprite.y = (obj.y + 0.5) * size
              sprite.width = size
              sprite.height = size
              sprite.angle = obj.rotation || 0
              
              this.objectLayer.addChild(sprite)
              
              let iconPath = doorIcon
              switch (obj.type) {
                  case 'door-secret': iconPath = doorSecretIcon; break;
                  case 'door-archway': iconPath = doorArchwayIcon; break;
                  case 'door-locked': iconPath = doorLockedIcon; break;
                  case 'door-portcullis': iconPath = doorPortcullisIcon; break;
                  case 'door-barred': iconPath = doorBarredIcon; break;
              }

              Assets.load(iconPath).then((texture) => {
                  sprite.texture = texture
                  sprite.width = size
                  sprite.height = size
              }).catch(err => {
                  console.error('Failed to load door icon', obj.type, err)
              })
          }
      }
  }

  private renderShadows(wallPositions: Set<string>, size: number) {
      if (!this.config.shadow) return

      const { color, x: offX, y: offY } = this.config.shadow
      
      // Draw shadow rects at offset position
      // Simple drop shadow approach
      this.shadowLayer.clear()
      
      for (const key of wallPositions) {
          const [x, y] = key.split(',').map(Number)
          // Convert grid pos to pixel pos
          // Offset by shadow config (pixels? or units? usually pixels)
          // In ThemeTypes, x:12, y:9 are likely pixels.
          
          this.shadowLayer.rect(
              x * size + offX, 
              y * size + offY, 
              size, 
              size
          )
      }
      this.shadowLayer.fill({ color: color, alpha: 0.5 }) // Opacity?
  }
  
  private renderGridLines(rooms: Room[], corridorTiles: { x: number; y: number }[], size: number): void {
    // Build and store set of all floor positions
    this.floorPositions.clear()
    
    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.floorPositions.add(`${x + dx},${y + dy}`)
        }
      }
    }
    
    for (const pos of corridorTiles) {
      this.floorPositions.add(`${pos.x},${pos.y}`)
    }
    
    // Draw grid lines
    this.updateGridLines()
  }
  
  /**
   * Update grid lines with constant 1-screen-pixel width
   * Called after zoom changes to maintain constant visual weight
   */
  private updateGridLines(): void {
    this.gridLineLayer.clear()
    
    const size = this.tileSize
    // Line width in world space = 1 screen pixel / zoom
    const lineWidth = 1 / this.zoom
    const color = this.config.grid.color
    
    // Draw grid lines ONLY between adjacent floor tiles (not at edges)
    for (const key of this.floorPositions) {
      const [x, y] = key.split(',').map(Number)
      const px = x * size
      const py = y * size
      
      // Right edge - only draw if there's a floor tile to the right
      if (this.floorPositions.has(`${x + 1},${y}`)) {
        this.gridLineLayer.rect(px + size - lineWidth, py, lineWidth, size)
        this.gridLineLayer.fill({ color: color })
      }
      
      // Bottom edge - only draw if there's a floor tile below
      if (this.floorPositions.has(`${x},${y + 1}`)) {
        this.gridLineLayer.rect(px, py + size - lineWidth, size, lineWidth)
        this.gridLineLayer.fill({ color: color })
      }
    }
  }
  
  /**
   * Room Floor rendering
   */
  private renderRoomFloor(room: Room, size: number): void {
    const { x, y, w, h } = room.bounds
    // console.log('[DungeonView] Rendering room:', { id: room.id, x, y, w, h, isCircular: room.isCircular })
    
    if (room.isCircular) {
      // Draw wall-colored bounding box first (corners will show as walls)
      // Draw on floorLayer so it's under the circle but above the background
      this.floorLayer.rect(x * size, y * size, w * size, h * size)
      this.floorLayer.fill({ color: this.config.walls.color })
      
      // Draw circular room on top (same layer, so it covers the center)
      const centerX = (x + w / 2) * size
      const centerY = (y + h / 2) * size
      const radius = (w / 2) * size
      
      this.floorLayer.circle(centerX, centerY, radius)
      this.floorLayer.fill({ color: this.config.floor.color })
    } else {
      // Draw rectangular room (full tiles, grid lines drawn separately)
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.floorLayer.rect((x + dx) * size, (y + dy) * size, size, size)
          this.floorLayer.fill({ color: this.config.floor.color })
        }
      }
    }
  }
  
  private renderWalls(rooms: Room[], settings: SeedGrowthSettings, size: number, corridorTiles: { x: number; y: number }[] = []): Set<string> {
    const { gridWidth, gridHeight } = settings
    
    // Build a set of floor positions from room bounding boxes
    const floorSet = new Set<string>()
    
    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          floorSet.add(`${x + dx},${y + dy}`)
        }
      }
    }
    
    // Add corridor tiles to floor set
    for (const pos of corridorTiles) {
      floorSet.add(`${pos.x},${pos.y}`)
    }
    
    // Find all tiles adjacent to floor that are not floor themselves
    const wallSet = new Set<string>()
    const neighbors = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ]
    
    // Just for shadow calculation - we need "external" wall positions
    for (const key of floorSet) {
      const [x, y] = key.split(',').map(Number)
      
      for (const [dx, dy] of neighbors) {
        const nx = x + dx
        const ny = y + dy
        const neighborKey = `${nx},${ny}`
        
        // Relaxed bounds check for expanded border (padding 2)
        if (nx >= -2 && nx < gridWidth + 2 && ny >= -2 && ny < gridHeight + 2) {
          if (!floorSet.has(neighborKey)) {
            wallSet.add(neighborKey)
          }
        }
      }
    }
    
    // Render walls
    for (const key of wallSet) {
      const [x, y] = key.split(',').map(Number)
      this.wallLayer.rect(x * size, y * size, size, size)
      this.wallLayer.fill({ color: this.config.walls.color })
    }

    return wallSet
  }
  
  /**
   * Render room number labels at center of each room
   */
  private renderRoomLabels(rooms: Room[], size: number, furthestMap: Map<string, FurthestRoomResult>, totalFurthest: number): void {
    // Label Style Options (Plain Object)
    const baseStyle = {
      fontFamily: 'Arial',
      fontSize: Math.max(12, Math.floor(size / 2)),
      fontWeight: 'bold',
      fill: '#000000', // Default black
      stroke: '#ffffff',
      strokeThickness: 2,
      align: 'center'
    }

    this.labelContainer.removeChildren()

    for (const room of rooms) {
      const isFurthest = furthestMap.get(room.id)
      
      // Calculate color
      // Default: Black
      // Furthest: Gradient Red (#FF0000) -> Orange (#FFA500)
      // Rank 0 = Red
      // Rank total-1 = Orange
      
      let fillColor: string | number = '#000000'
      
      if (isFurthest) {
           const rank = isFurthest.rank
           const maxRank = Math.max(1, totalFurthest - 1)
           const t = Math.min(1, rank / maxRank) // 0 to 1
           
           // Interpolate RGB
           // Red: 255, 0, 0
           // Orange: 255, 165, 0
           
           const r1 = 255, g1 = 0, b1 = 0
           const r2 = 255, g2 = 165, b2 = 0
           
           const r = Math.round(r1 + (r2 - r1) * t)
           const g = Math.round(g1 + (g2 - g1) * t)
           const b = Math.round(b1 + (b2 - b1) * t)
           
           fillColor = `rgb(${r}, ${g}, ${b})`
      }

      // Parse ID to number
      let labelText = ''
      try {
          const num = parseInt(room.id.replace('room_', ''))
          labelText = String(num + 1)
      } catch (e) {
          labelText = room.id
      }

      const label = new Text({ 
          text: labelText, 
          style: {
              ...baseStyle,
              fill: fillColor
          }
      })
      
      label.anchor.set(0.5)
      
      // Calculate center of room
      let cx = 0, cy = 0
      
      if (room.centroid) {
        cx = room.centroid.x
        cy = room.centroid.y
      } else {
        // Fallback
        cx = room.bounds.x + room.bounds.w / 2
        cy = room.bounds.y + room.bounds.h / 2
      }
      
      // Adjust to pixel coordinates (center of tile)
      label.x = (cx + 0.5) * size
      label.y = (cy + 0.5) * size
      
      this.labelContainer.addChild(label)
    }
  }

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
      // "right one squares from center... put the movement cost... in parenthesis"
      const style = {
          fontFamily: 'Arial',
          fontSize: Math.max(10, Math.floor(size / 2.5)),
          fontWeight: 'normal',
          fill: '#000000', // Black
          align: 'center'
      }
      
      for (const room of data.rooms) {
          const cost = roomCosts.get(room.id)
          if (cost !== undefined) {
              // Center position
              const cx = room.centroid.x
              const cy = room.centroid.y
              
              // Target: Center + 1 X for cost
              const tx = cx + 1
              const ty = cy
              
              const text = new Text({
                  text: `(${cost})`,
                  style
              })
              text.anchor.set(0.5)
              text.x = (tx + 0.5) * size
              text.y = (ty + 0.5) * size
              
              this.walkmapContainer.addChild(text)
          }
          
          // Render room/door traversal counts one square below center
          const roomCount = roomTraversals.get(room.id) ?? 0
          const doorCount = doorTraversals.get(room.id) ?? 0
          
          const cx = room.centroid.x
          const cy = room.centroid.y
          
          // Position: Center + 1 Y (below)
          const labelText = `R:${roomCount} D:${doorCount}`
          const traversalLabel = new Text({
              text: labelText,
              style: {
                  ...style,
                  fontSize: Math.max(8, Math.floor(size / 3)),
                  fill: '#333333'
              }
          })
          traversalLabel.anchor.set(0.5)
          traversalLabel.x = (cx + 0.5) * size
          traversalLabel.y = (cy + 1.5) * size
          
          this.walkmapContainer.addChild(traversalLabel)
      }
  }
  
  /**
   * Main render method for the dungeon.
   */
  public render(data: SeedGrowthState | DungeonData, settings: SeedGrowthSettings, showRoomNumbers: boolean = true, showWalkmap: boolean = false): void {
    // Clear previous
    this.backgroundLayer.clear()
    this.shadowLayer.clear()
    this.floorLayer.clear()
    this.wallLayer.clear()
    this.gridLineLayer.clear()
    this.heatMapLayer.clear()
    this.overlayLayer.clear()
    this.objectLayer.removeChildren()
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
    this.shadowLayer.clear()
    this.gridLineLayer.clear()
    this.heatMapLayer.clear()
    this.overlayLayer.clear()
    this.labelContainer.removeChildren()
    this.objectLayer.removeChildren()
    this.walkmapContainer.removeChildren()
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
    this.labelContainer.visible = show
  }
  
  /**
   * Toggle heat map visibility
   */
  public setShowHeatMap(visible: boolean): void {
      this.heatMapLayer.visible = visible
  }

  public setShowWalkmap(visible: boolean): void {
      this.walkmapContainer.visible = visible
  }

  /**
   * Calculate heat map scores for all room walls
   */
  public calculateWallHeatScores(rooms: Room[], spineTiles: { x: number; y: number }[]): Map<string, number> {
    const heatScores = new Map<string, number>()
    const spineSet = new Set<string>(spineTiles.map(t => `${t.x},${t.y}`))
    
    // Helper to check spine adjacency
    const checkSpineAdj = (x: number, y: number) => {
        return spineSet.has(`${x},${y-1}`) || 
               spineSet.has(`${x},${y+1}`) || 
               spineSet.has(`${x-1},${y}`) || 
               spineSet.has(`${x+1},${y}`)
    }

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      
      // North wall (y-1)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y - 1
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        // Bonus: -10 Center, -5 Edge, 0 Other
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // South wall (y+h)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y + h
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // West wall (x-1)
      for (let dy = 0; dy < h; dy++) {
        const wx = x - 1, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // East wall (x+w)
      for (let dy = 0; dy < h; dy++) {
        const wx = x + w, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }

      // Diagonal corners = 500
       const corners = [
        { x: x - 1, y: y - 1 },
        { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h },
        { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        const key = `${c.x},${c.y}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + 100)
      }
    }
    return heatScores
  }

  /**
   * Render heat map using pre-calculated scores
   * Scoring: Center wall=10, Far edge=15, Others=20, Diagonals=500, Spine-adjacent=+5
   */
  public renderHeatMap(scores: Map<string, number>, size: number): void {
    this.heatMapLayer.clear()
    
    // Color scale helper for Additive Scores
    const scoreToColor = (s: number): number => {
        if (s <= -20) return 0x00FF00 // Green (Best - Double Shared)
        if (s < -5) return 0x00FFFF // Cyan (Good - Center/Edge)
        if (s < 5) return 0xFFFF00 // Yellow (Neutral)
        if (s < 50) return 0xFF8800 // Orange (Spine Adj)
        return 0xFF0000 // Red (Corner/Blocked)
    }

    for (const [key, score] of scores.entries()) {
        if (typeof key !== 'string') continue
        const [x, y] = key.split(',').map(Number)
        this.heatMapLayer.rect(x * size, y * size, size, size)
        this.heatMapLayer.fill({ color: scoreToColor(score), alpha: 0.5 })
    }
  }

  // Bind for cleanup
  private onThemeChange = (name: string, config: RoomLayerConfig) => {
      this.config = config
      this.updateFilters()
  }
}
