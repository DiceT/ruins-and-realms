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
import { SeedGrowthState, SeedGrowthSettings, Room, Corridor, Connection, DungeonData, DungeonObject } from './types'
import { LightProfile, VisionGrid, VISION_STATE } from '../data/LightingData'
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
  
  // --- New Visibility Layers ---
  private fogLayer: Container // Multiplied Fog (Unexplored=Black, Dim=Gray)
  private darknessLayer: Graphics // Base ambient darkness
  private lightLayer: Sprite // Additive Light field
  private entityLayer: Container // Player/Monsters (Masked)
  
  private labelContainer: Container

  // FX
  private noiseSprite: Sprite | null = null
  private displacementFilter: DisplacementFilter | null = null
  
  // View state
  private viewWidth: number = 800
  private viewHeight: number = 600
  
  // Grid line state (stored for re-rendering on zoom)
  private floorPositions: Set<string> = new Set()
  // Accessible corridor tiles for collision
  private corridorTiles: Set<string> = new Set()

  private fogTexture: RenderTexture | null = null
  private lightTexture: RenderTexture | null = null
  private playerSprite: Graphics | null = null
  
  // Debug flags
  private showFog: boolean = true
  private showLight: boolean = true

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
    this.shadowLayer = new Graphics() 
    
    this.floorLayer = new Graphics()
    this.wallLayer = new Graphics()
    this.objectLayer = new Container()
    this.gridLineLayer = new Graphics()
    this.overlayLayer = new Graphics()
    this.heatMapLayer = new Graphics()
    this.heatMapLayer.visible = false  // Default OFF
    this.walkmapContainer = new Container()
    
    // VISIBILITY INIT
    this.fogLayer = new Container() 
    
    // We will attach the graphics to this container
    // The Container itself needs the blend mode for its children to composite correctly against the world?
    // Or we apply blendMode to the child Graphics. 
    // Usually applying to Container works if children don't override.
    // Let's apply to the Graphics child to be safe, or direct to container.
    // Pixi Container supports blendMode.
    this.fogLayer.blendMode = 'normal'
    
    this.darknessLayer = new Graphics()
    this.darknessLayer.blendMode = 'multiply' // Darkens everything
    
    this.lightLayer = new Sprite(Texture.WHITE)
    this.lightLayer.blendMode = 'screen' // Brightens
    
    this.entityLayer = new Container()
    this.playerSprite = new Graphics()
    this.entityLayer.addChild(this.playerSprite)
    
    this.labelContainer = new Container()
    
    // LAYER ORDER
    this.contentContainer.addChild(this.backgroundLayer)
    this.contentContainer.addChild(this.floorLayer)
    this.contentContainer.addChild(this.shadowLayer)
    this.contentContainer.addChild(this.wallLayer)
    
    this.contentContainer.addChild(this.objectLayer)
    
    // VISIBILITY STACK
    // Grid Lines should be affected by Fog? User said "Grid layer should adhere to light rules".
    // So Grid Lines -> Fog -> Light -> Entities?
    // If Grid is under Fog, it will get dark. Correct.
    // VISIBILITY STACK
    // Light MUST be below Fog to be occluded by Unexplored areas
    this.contentContainer.addChild(this.lightLayer)
    
    this.contentContainer.addChild(this.gridLineLayer)
    this.contentContainer.addChild(this.fogLayer) 
    this.contentContainer.addChild(this.darknessLayer)
    
    this.contentContainer.addChild(this.entityLayer)
    
    // OVERLAYS / DEBUG
    this.contentContainer.addChild(this.heatMapLayer)
    // Grid Line Layer was here (150). Removed.
    this.contentContainer.addChild(this.overlayLayer)
    this.contentContainer.addChild(this.walkmapContainer)
    this.contentContainer.addChild(this.labelContainer)
    
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

    // Setup pan/zoom
    this.setupPanZoom()
  }

  public setDebugVisibility(fog: boolean, light: boolean) {
      this.showFog = fog
      this.showLight = light
      this.fogLayer.visible = fog
      this.darknessLayer.visible = light
      this.lightLayer.visible = light
  }

  public updateVisibilityState(
      gridWidth: number, 
      gridHeight: number, 
      visionGrid: VisionGrid,
      playerX: number,
      playerY: number,
      lightProfile: LightProfile
  ) {
      // 1. Resize RTs if needed
      const viewW = gridWidth * this.tileSize
      const viewH = gridHeight * this.tileSize
      
      if (!this.fogTexture || this.fogTexture.width !== viewW || this.fogTexture.height !== viewH) {
          this.fogTexture?.destroy(true)
          this.lightTexture?.destroy(true)
          this.fogTexture = RenderTexture.create({ width: viewW, height: viewH })
          this.lightTexture = RenderTexture.create({ width: viewW, height: viewH })
          this.fogLayer.texture = this.fogTexture
          this.lightLayer.texture = this.lightTexture
      }

      const tempG = new Graphics()
      
      // 2. Render FOG
      if (this.showFog) {
          tempG.clear()
          // Fill black (unexplored)
          tempG.rect(0, 0, viewW, viewH).fill(0x000000)
          
          for (let y = 0; y < gridHeight; y++) {
              for (let x = 0; x < gridWidth; x++) {
                  const idx = y * gridWidth + x
                  const state = visionGrid[idx]
                  const px = x * this.tileSize
                  const py = y * this.tileSize
                  
                  if (state === VISION_STATE.VISIBLE) {
                      // Fully visible (transparent fog) - cut hole
                      tempG.rect(px, py, this.tileSize, this.tileSize).cut()
                  } else if (state === VISION_STATE.EXPLORED) {
                      // Dim (gray fog)
                      // Actually, we filled black. So we draw a semi-transparent white rect?
                      // Wait, blend mode multiply. 
                      // White = Transparent. Black = Dark.
                      // Explored should be DIM (0.5 visibility). So draw 0x808080
                      tempG.rect(px, py, this.tileSize, this.tileSize).fill({ color: 0xFFFFFF, alpha: 0.5 }) 
                  }
              }
          }
          // The base was black (0x000000). Cut makes it 0 alpha (transparent)? 
          // No, Graphics context..
          // Better approach for FOG MASK:
          // Draw the VISIBLE areas as WHITE.
          // Draw EXPLORED areas as GRAY.
          // Draw UNEXPLORED as BLACK.
          // Then use this texture as a mask or multiply? 
          // Current FogLayer is Multiplied.
          // So: White = No change (Visible). Gray = Darken (Explored). Black = Black (Unexplored).
          
          tempG.clear()
          tempG.rect(0, 0, viewW, viewH).fill(0x000000) // Unexplored
          
          for (let y = 0; y < gridHeight; y++) {
              for (let x = 0; x < gridWidth; x++) {
                  const idx = y * gridWidth + x
                  const state = visionGrid[idx]
                  
                  if (state === VISION_STATE.VISIBLE) {
                      tempG.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize).fill(0xFFFFFF)
                  } else if (state === VISION_STATE.EXPLORED) {
                      // 0.5 brightness
                       tempG.rect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize).fill(0x555555)
                  }
              }
          }
          
          // Render to texture
          // We need a renderer instance.. passed in or global?
          // Pixi v8 handles this via app.renderer... but we don't have app ref here.
          // We can use the container's transform? No, need renderer.
          // Actually, we can just leave the Graphics as a child if performance allows.
          // Optimisation: Render only on change.
          // For now, let's just use the Graphics directly attached to fogLayer? 
          // No, separate RT is cleaner for masks.
          // But without renderer ref, we can't update RT.
          // We can attach the Graphics to the container and toggle visibility?
          // Let's replace the sprite logic with direct Graphics for now to avoid RT complexity without App ref.
      }
  }
  
  // NOTE: Switched to Direct Graphics for Fog to avoid RT overhead
  private fogGraphics: Graphics = new Graphics()
  private lightTextureCache: Map<string, Texture> = new Map()
  
  public updateVisibilityGraphics(
      gridWidth: number, 
      gridHeight: number, 
      visionGrid: VisionGrid,
      playerX: number,
      playerY: number,
      lightProfile: LightProfile
  ) {
      // FOG
      this.fogLayer.removeChildren() // Clear container
      this.fogGraphics.clear()
      
      if (this.showFog) {
           // 1. Draw "Border" Fog (Infinite Blackness outside the grid) to prevent light bleed
           const gloomSize = 10000 
           const totalW = gridWidth * this.tileSize
           const totalH = gridHeight * this.tileSize

           // Top
           this.fogGraphics.rect(-gloomSize, -gloomSize, totalW + gloomSize * 2, gloomSize).fill({ color: 0x000000, alpha: 1.0 })
           // Bottom
           this.fogGraphics.rect(-gloomSize, totalH, totalW + gloomSize * 2, gloomSize).fill({ color: 0x000000, alpha: 1.0 })
           // Left
           this.fogGraphics.rect(-gloomSize, 0, gloomSize, totalH).fill({ color: 0x000000, alpha: 1.0 })
           // Right
           this.fogGraphics.rect(totalW, 0, gloomSize, totalH).fill({ color: 0x000000, alpha: 1.0 })

           // Debug counts
           let visibleCount = 0
           
           for (let y = 0; y < gridHeight; y++) {
              for (let x = 0; x < gridWidth; x++) {
                  const idx = y * gridWidth + x
                  const state = visionGrid[idx]
                  
                  const px = x * this.tileSize
                  const py = y * this.tileSize
                  
                   if (state === VISION_STATE.VISIBLE) {
                      visibleCount++
                      // Draw nothing (transparent)
                  } else if (state === VISION_STATE.EXPLORED) {
                       // Dimmed (Explored)
                       // User requested "Reduce visibility... to 25%". 
                       // 25% Visibility means 75% Opacity.
                       this.fogGraphics.rect(px, py, this.tileSize, this.tileSize).fill({ color: 0x000000, alpha: 0.75 })
                  } else {
                       // Unexplored (Hidden) - Default
                       this.fogGraphics.rect(px, py, this.tileSize, this.tileSize).fill({ color: 0x000000, alpha: 1.0 })
                  }
              }
           }
           console.log(`[DungeonView] Fog Update: ${visibleCount} visible tiles`)
      }
      this.fogLayer.addChild(this.fogGraphics)

      // PLAYER
      if (this.playerSprite) {
          const cx = (playerX + 0.5) * this.tileSize
          const cy = (playerY + 0.5) * this.tileSize
          const r = this.tileSize * 0.4
          this.playerSprite.clear()
          this.playerSprite.circle(cx, cy, r).fill(0xFFA500).stroke({ width: 2, color: 0xFFFFFF }) // Orange circle
      }
      
      // LIGHTING (Gradient Texture)
      if (this.showLight) {
          let tex = this.lightTextureCache.get(lightProfile.type)
          if (!tex) {
              tex = this.generateLightTexture(lightProfile)
              this.lightTextureCache.set(lightProfile.type, tex)
          }
          
          this.lightLayer.texture = tex
          this.lightLayer.anchor.set(0.5)
          this.lightLayer.width = lightProfile.dimRadius * 2 * this.tileSize
          this.lightLayer.height = lightProfile.dimRadius * 2 * this.tileSize
          this.lightLayer.x = (playerX + 0.5) * this.tileSize
          this.lightLayer.y = (playerY + 0.5) * this.tileSize
          this.lightLayer.visible = true
      } else {
          this.lightLayer.visible = false
      }
  }

  private generateLightTexture(profile: LightProfile): Texture {
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      
      if (ctx) {
          const cx = size / 2
          const cy = size / 2
          const r = size / 2
          
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
          const brightRatio = Math.min(1, profile.brightRadius / profile.dimRadius)
          
          // Adjustable Warm Colors
          // Center: Bright
          grad.addColorStop(0, 'rgba(255, 240, 200, 1.0)') 
          // Bright edge: Start fading
          grad.addColorStop(brightRatio, 'rgba(255, 200, 150, 0.6)') 
          // Dim edge: Fade to black
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
          
          ctx.fillStyle = grad
          ctx.fillRect(0, 0, size, size)
      }
      
      return Texture.from(canvas)
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

  public focusOnTile(tx: number, ty: number): void {
      const cx = (tx + 0.5) * this.tileSize * this.zoom
      const cy = (ty + 0.5) * this.tileSize * this.zoom
      
      this.contentContainer.x = (this.viewWidth / 2) - cx
      this.contentContainer.y = (this.viewHeight / 2) - cy
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
        // Use passed rooms (already pruned)
        rooms = data.rooms
        
        // The spineTiles array only contains CENTER path tiles.
        spineTiles = (data as any).spine || []
        
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
            // --- MODE B: WIDTH 1 - NO SPINE CORRIDOR ---
            // When spine width is 1, the spine is just a pathfinding guide.
            // renderedSpinePath stays empty (no spine floor tiles drawn).
            // But we still need to set a targetSet for tributary generation.
            if (rooms.length > 0) {
                const seedRoom = rooms.reduce((prev, curr) => (prev.id.localeCompare(curr.id) < 0 ? prev : curr))
                for (const tile of seedRoom.tiles) {
                    targetSet.add(`${tile.x},${tile.y}`)
                }
            }
        }

        // 3. Generate Tributary Corridors (connecting rooms)
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

        // 4. Combine initial corridors (unpruned)
        // For width 1: renderedSpinePath is empty, only tributaries are used
        // For width > 1: both spine corridor and tributaries are included
        corridorTiles = [...renderedSpinePath, ...tributaryTiles]
        
        // Update data.spine to be the PHYSICAL spine corridor (for Analysis)
        ;(data as any).spine = renderedSpinePath
        
        this.renderHeatMap(heatScores, size)
        
    } else {
        // --- ORGANIC MODE ---
        rooms = (data as any).rooms || []
        const pathfinder = new CorridorPathfinder(settings.seed)
        corridorTiles = pathfinder.generate(data, rooms)
        // Set tributaryTiles for organic mode too so cleanup works
        tributaryTiles = corridorTiles 
    }
    
    // --- DECORATION PHASE ---
    if (!data.corridors) (data as any).corridors = []
    ;(data as any).corridors = [{
        id: 'generated_render_corridors',
        tiles: corridorTiles.map(t => ({ x: t.x, y: t.y }))
    }]

    const decorator = new DungeonDecorator(settings.seed)
    // Clear objects to prevent duplication on re-renders (since data is mutable state)
    // Clear objects to prevent duplication on re-renders (in-place to preserve ref)
    if (data.objects) data.objects.length = 0
    decorator.decorate(data)

    // --- UNIFIED PRUNING PHASE ---
    {
        const roomTileSet = new Set<string>()
        for (const r of rooms) for (const t of r.tiles) roomTileSet.add(`${t.x},${t.y}`)
        
        const objectTileSet = new Set<string>() // ALL objects (protects these tiles)
        const objectFloorSet = new Set<string>() // Objects needing floor rendering
        if (data.objects) {
            for (const obj of data.objects) {
                const k = `${obj.x},${obj.y}`
                objectTileSet.add(k)
                if (obj.properties?.hasFloor) objectFloorSet.add(k)
            }
        }
        
        const tributarySet = new Set(tributaryTiles.map(t => `${t.x},${t.y}`))
        
        // 1. Spine Range Pruning (Critical for Wide Corridors - ONLY for spineWidth > 1)
        const spineWidth = ('spineWidth' in data) ? (data.spineWidth || 1) : 1
        if ('spine' in data && spineTiles.length > 0 && spineWidth > 1) {
            const spineWidth = data.spineWidth || 1
            const effectiveWidth = Math.max(1, spineWidth - 2)
            const radius = Math.floor((effectiveWidth - 1) / 2)
            
            const usedIndices: number[] = []
            for (let i = 0; i < spineTiles.length; i++) {
                const st = spineTiles[i]
                const sliceKeys = [`${st.x},${st.y}`]
                if (radius > 0) {
                    const dir = st.direction || 'north'
                    const perps = dir === 'north' || dir === 'south' 
                        ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                        : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                    for (let r = 1; r <= radius; r++) {
                        for (const p of perps) sliceKeys.push(`${st.x + p.x * r},${st.y + p.y * r}`)
                    }
                }
                
                const isUsed = sliceKeys.some(key => {
                    if (roomTileSet.has(key)) return true
                    if (tributarySet.has(key)) return true
                    if (objectTileSet.has(key)) return true
                    
                    const [x, y] = key.split(',').map(Number)
                    const adj = [`${x+1},${y}`, `${x-1},${y}`, `${x},${y+1}`, `${x},${y-1}`]
                    if (adj.some(k => tributarySet.has(k) || objectTileSet.has(k))) return true
                    return false
                })
                if (isUsed) usedIndices.push(i)
            }
            
            if (usedIndices.length > 0) {
                const first = usedIndices[0]
                const last = usedIndices[usedIndices.length - 1]
                const prunedSpineTiles = spineTiles.slice(first, last + 1)
                
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
                                const px = t.x + p.x * r, py = t.y + p.y * r
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
                corridorTiles = [...renderedSpinePath, ...tributaryTiles]
            }
        }

        // 2. Iterative Dead-end Erosion (Standard for 1-wide)
        // Build floor set from rooms, ALL objects, and corridors
        const allFloor = new Set<string>([...roomTileSet, ...objectTileSet, ...corridorTiles.map(t => `${t.x},${t.y}`)])
        let currCorridorSet = new Set(corridorTiles.map(t => `${t.x},${t.y}`))
        
        let changed = true
        while (changed) {
            changed = false
            const toRemove: string[] = []
            for (const key of currCorridorSet) {
                // If this tile HAS an object (stair, door), it is an anchor. PROTECT.
                if (objectTileSet.has(key)) continue
                
                const [x, y] = key.split(',').map(Number)
                let floorNeighbors = 0
                if (allFloor.has(`${x+1},${y}`)) floorNeighbors++
                if (allFloor.has(`${x-1},${y}`)) floorNeighbors++
                if (allFloor.has(`${x},${y+1}`)) floorNeighbors++
                if (allFloor.has(`${x},${y-1}`)) floorNeighbors++
                
                if (floorNeighbors < 2) toRemove.push(key)
            }
            for (const key of toRemove) {
                currCorridorSet.delete(key)
                allFloor.delete(key)
                changed = true
            }
        }
        
        // Rebuild corridorTiles from pruned set
        corridorTiles = Array.from(currCorridorSet).map(k => {
            const [x, y] = k.split(',').map(Number)
            return { x, y }
        })

        // Finally, add all objects with 'hasFloor' to corridorTiles if they aren't already there
        for (const k of objectFloorSet) {
            if (!currCorridorSet.has(k)) {
                const [x, y] = k.split(',').map(Number)
                corridorTiles.push({ x, y })
            }
        }
        
        // Final Sync to Data
        ;(data as any).corridors = [{
            id: 'generated_render_corridors',
            tiles: corridorTiles.map(t => ({ x: t.x, y: t.y }))
        }]
        
        const prunedSet = new Set(corridorTiles.map(t => `${t.x},${t.y}`))
        renderedSpinePath = renderedSpinePath.filter(t => prunedSet.has(`${t.x},${t.y}`))
        ;(data as any).spine = renderedSpinePath
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
                  if (sprite.destroyed) return
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
                  if (sprite.destroyed) return
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

  public setPlayerVisibility(visible: boolean): void {
      this.entityLayer.visible = visible
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
    // Helper to expose walkable tiles for PlayerController
  public getWalkableTiles(): {x: number, y: number}[] {
      const tiles: {x: number, y: number}[] = []
      
      // 1. Corridors (Already pruned and widened)
      for (const k of this.corridorTiles) {
          const [x, y] = k.split(',').map(Number)
          tiles.push({x, y})
      }
      return tiles
  }

  // Bind for cleanup
  private onThemeChange = (name: string, config: RoomLayerConfig) => {
      this.config = config
      this.updateFilters()
  }
}
