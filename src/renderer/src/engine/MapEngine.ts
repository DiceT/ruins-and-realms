import { Application, Container, TickerCallback, Graphics } from 'pixi.js'
import { Camera } from './Camera'
import { BaseGridSystem } from './systems/BaseGridSystem'
import { SquareGridSystem } from './systems/SquareGridSystem'
import { HexGridSystem } from './systems/HexGridSystem'
import { ShaderManager } from './managers/ShaderManager'

export type GridType = 'square' | 'hex'

export interface MapLayers {
  background: Container
  live: Container
  dead: Container
  active: Container
  grid: Container
  room: Container
  wall: Container
  object: Container
  notes: Container
  overlay: Container
  interaction: Container
}

export interface MapEngineOptions {
  gridType: GridType
  viewport?: Container
  width?: number
  height?: number
  onEntrancePlaced?: (x: number, y: number) => void
  onRoomPlaced?: (x: number, y: number, w: number, h: number) => void
  onExitPlaced?: (x: number, y: number) => void
  onExitClicked?: (exitId: string) => void
  onNewRoomPlaced?: (roomId: string, exitId: string) => void
  // Overworld Callbacks
  onTownPlaced?: (x: number, y: number) => void
  onTerrainPlaced?: (x: number, y: number) => void
  onHexClicked?: (x: number, y: number) => void
  onHexHover?: (x: number, y: number, globalX: number, globalY: number) => void
  // Validation Callback
  // Validation Callback
  onValidatePlacement?: (x: number, y: number) => boolean
}

/**
 * MapEngine - The core of the map system.
 * Designed to be a drop-in "cartridge" for any PixiJS container.
 */
export class MapEngine {
  public app: Application
  public camera: Camera
  public layers: MapLayers
  public gridSystem: BaseGridSystem
  public shaderManager: ShaderManager
  private tickerCallback: TickerCallback<MapEngine> | null = null
  public destroyed: boolean = false

  // Interaction State
  public interactionState = {
    mode: 'idle' as
      | 'idle'
      | 'placing_entrance'
      | 'placing_room'
      | 'placing_exit'
      | 'placing_new_room'
      | 'placing_town'
      | 'placing_terrain',
    hoveredTile: { x: Number.NaN, y: Number.NaN },
    hoveredRoomId: null as string | null,
    hoveredFeatureId: null as string | null, // Room or Corridor ID for highlighting
    pendingRoomSize: { w: 0, h: 0 },
    activeRoomId: null as string | null,
    activeExitId: null as string | null
  }
  public options: MapEngineOptions

  constructor(app: Application, options: MapEngineOptions = { gridType: 'square' }) {
    this.app = app

    // 1. Initialize Camera - pass viewport for isolation
    this.camera = new Camera(app)
    this.camera.init(options.viewport)

    // Attach Camera Container to Viewport (if provided) or Stage
    const parent = options.viewport || app.stage
    parent.addChild(this.camera.container)

    // 2. Initialize Layers
    this.layers = {
      background: new Container({ label: 'BackgroundLayer' }),
      live: new Container({ label: 'LiveLayer' }),
      dead: new Container({ label: 'DeadLayer' }),
      active: new Container({ label: 'ActiveLayer' }),
      grid: new Container({ label: 'GridLayer' }),
      room: new Container({ label: 'RoomLayer' }),
      wall: new Container({ label: 'WallLayer' }),
      object: new Container({ label: 'ObjectLayer' }),
      notes: new Container({ label: 'NotesLayer' }),
      overlay: new Container({ label: 'OverlayLayer' }),
      interaction: new Container({ label: 'InteractionLayer' })
    }

    // Add Layers to Camera Container in Render Order (Bottom to Top)
    this.camera.container.addChild(this.layers.background)
    this.camera.container.addChild(this.layers.live)
    this.camera.container.addChild(this.layers.dead)
    this.camera.container.addChild(this.layers.active)
    this.camera.container.addChild(this.layers.grid)
    this.camera.container.addChild(this.layers.room)
    this.camera.container.addChild(this.layers.wall)

    // this.layers.live.addChild(debugSq)
    this.camera.container.addChild(this.layers.object)
    this.camera.container.addChild(this.layers.notes)
    this.camera.container.addChild(this.layers.overlay)
    this.camera.container.addChild(this.layers.interaction)

    // 3. Initialize Grid System
    if (options.gridType === 'hex') {
      this.gridSystem = new HexGridSystem(this)
    } else {
      this.gridSystem = new SquareGridSystem(this)
    }

    // 4. Initialize Shader Manager
    // applying to camera container affects EVERYTHING (grid, rooms, background)
    // applying to background layer only affects background
    this.shaderManager = new ShaderManager()
    this.shaderManager.attach(this.camera.container)

    // 4. Render Loop

    this.tickerCallback = () => {
      if (!this.destroyed) {
        // Track mouse to update tile hover (SAFENED)
        const renderer = this.app.renderer
        const events = (renderer as any).events
        if (events && events.pointer) {
          const mouse = events.pointer.global
          const worldPos = this.camera.toWorld(mouse.x, mouse.y)

          // Use the GridSystem to get accurate coords (Hex or Square)
          const gridCoords = this.gridSystem.getGridCoords(worldPos.x, worldPos.y)

          this.interactionState.hoveredTile = gridCoords

          // Room hover detection removed - dungeon mode now uses SeedGrowthGenerator
          this.interactionState.hoveredRoomId = null
          this.interactionState.hoveredFeatureId = null
        }
        // this.checkCameraMovement()
        
        // Note: shaderManager doesn't have an update method - filters are static

        // LOG INPUT DEBUG
        if (this.app.ticker.lastTime % 60 === 0) {
          /*
         const viewport = this.options.viewport as any
         const hitArea = viewport.hitArea
         const worldPos = this.camera.toWorld(this.app.renderer.events.pointer.global.x, this.app.renderer.events.pointer.global.y)
         console.log('[MapEngine] Input Debug:', {
           screen: { w: this.app.screen.width, h: this.app.screen.height },
           viewport: { x: viewport.x, w: hitArea ? hitArea.width : 'N/A' },
           mouse: { x: this.app.renderer.events.pointer.global.x, y: this.app.renderer.events.pointer.global.y },
           world: { x: worldPos.x, y: worldPos.y },
           hovered: { x: this.interactionState.hoveredTile.x, y: this.interactionState.hoveredTile.y }
         }) 
         */
        }

        this.gridSystem.draw()

        // Debug log once per second
        // if (performance.now() - lastLog > 1000) {
        //   console.log('[MapEngine] Ticker Heartbeat', {
        //     mode: this.interactionState.mode,
        //     hover: this.interactionState.hoveredTile
        //   })
        //   lastLog = performance.now()
        // }
      }
    }
    this.app.ticker.add(this.tickerCallback)

    // 5. Input Handling for Placement
    this.options = options
    const target = options.viewport || this.app.stage
    target.eventMode = 'static'

    this.onPointerMove = (event: any) => {
      // Get global position
      const globalPos = event.global

      // Convert to local (world) coordinates via camera container
      // The camera container holds the world. Its transform handles zoom/pan.
      // We need to inverse transform the global point to get Local World Point.
      const localPos = this.camera.container.toLocal(globalPos)

      // Get Grid Coords
      const gridCoords = this.gridSystem.getGridCoords(localPos.x, localPos.y)

      // Trigger Hover Callback
      this.options.onHexHover?.(gridCoords.x, gridCoords.y, globalPos.x, globalPos.y)

      // Update State
      this.interactionState.hoveredTile = gridCoords

      // Optional: Update hoveredRoomId or other state for specific modes
      if (this.interactionState.mode === 'placing_exit' || this.interactionState.mode === 'idle') {
        // Logic for finding rooms/exits could go here if needed for hover effects
      }
    }
    target.on('pointermove', this.onPointerMove)

    this.onPointerTap = (e: any) => {
      // Calculate coords reuse or strict calculation
      const global = e.global
      const local = this.camera.container.toLocal(global)
      const { x, y } = this.gridSystem.getGridCoords(local.x, local.y)

      console.log('[MapEngine] Click Debug:', { mode: this.interactionState.mode, x, y })

      // Generic Click Callback moved to 'idle' state check below
      // this.options.onHexClicked?.(x, y)

      // Legacy dungeon placement modes - stubbed out (now using SeedGrowthGenerator)
      if (this.interactionState.mode === 'placing_entrance') {
        // Dungeon entrance placement removed - handled by SeedGrowthGenerator
        console.log('[MapEngine] placing_entrance mode is deprecated')
      } else if (this.interactionState.mode === 'placing_room') {
        // Dungeon room placement removed
        console.log('[MapEngine] placing_room mode is deprecated')
      } else if (this.interactionState.mode === 'placing_exit') {
        // Dungeon exit placement removed
        console.log('[MapEngine] placing_exit mode is deprecated')
      } else if (this.interactionState.mode === 'idle') {
        // Generic Click Callback (Only in Idle)
        this.options.onHexClicked?.(x, y)
      } else if (this.interactionState.mode === 'placing_new_room') {
        // Dungeon new room placement removed
        console.log('[MapEngine] placing_new_room mode is deprecated')
      } else if (this.interactionState.mode === 'placing_town') {
        const { x, y } = this.interactionState.hoveredTile
        if (this.options.onTownPlaced) {
          this.options.onTownPlaced(x, y)
        }
        // Mode change is handled by callback/controller
      } else if (this.interactionState.mode === 'placing_terrain') {
        const { x, y } = this.interactionState.hoveredTile
        if (this.options.onTerrainPlaced) {
          this.options.onTerrainPlaced(x, y)
        }
      }
    }
    target.on('pointertap', this.onPointerTap)

    // DEBUG: Expose for DebugToolbar
    ;(window as any).__MAP_ENGINE__ = this
  }

  public centerCamera(gridWidth: number, gridHeight: number): void {
      console.log('[MapEngine] centerCamera called with grid size:', gridWidth, gridHeight)
      const tileSize = this.gridSystem.config.size
      const worldW = gridWidth * tileSize
      const worldH = gridHeight * tileSize
      console.log('[MapEngine] targeting world center:', worldW / 2, worldH / 2, 'TileSize:', tileSize)
      this.camera.centerAt(worldW / 2, worldH / 2)
  }

  /**
   * Highlights a set of hex coordinates as valid moves.
   * Clears previous interaction highlights first.
   */
  public highlightValidMoves(coords: { x: number; y: number }[]): void {
    const interaction = this.layers.interaction
    interaction.removeChildren() // Clear old highlights

    // Only applicable for HexGrid currently
    if (this.gridSystem instanceof HexGridSystem) {
      const hexSys = this.gridSystem as HexGridSystem
      const r = hexSys.config.size

      const drawR = r - 5 // Match ghost size

      const g = new Graphics()
      interaction.addChild(g)

      coords.forEach(({ x, y }) => {
        const { x: cx, y: cy } = hexSys.getPixelCoords(x, y)

        // Draw faint green glow
        const poly = hexSys.getHexPoly(cx, cy, drawR)
        g.poly(poly)
        g.fill({ color: 0x00ff00, alpha: 0.2 }) // Faint Green
        g.stroke({ width: 2, color: 0x00ff00, alpha: 0.4 })
      })
    }
  }

  // Stored Listeners for Cleanup
  private onPointerMove: ((e: any) => void) | null = null
  private onPointerTap: ((e: any) => void) | null = null

  public destroy(): void {
    this.destroyed = true

    // 1. Stop Render Loop
    if (this.tickerCallback) {
      this.app.ticker.remove(this.tickerCallback)
      this.tickerCallback = null
    }

    // 2. Remove Event Listeners
    const target = this.options.viewport || this.app.stage
    if (this.onPointerMove) {
      target.off('pointermove', this.onPointerMove)
      this.onPointerMove = null
    }
    if (this.onPointerTap) {
      target.off('pointertap', this.onPointerTap)
      this.onPointerTap = null
    }

    // 3. Clean up Camera (remove listeners)
    this.camera.destroy()

    // 3. Remove container from parent only if it still exists
    if (this.camera.container.parent) {
      this.camera.container.parent.removeChild(this.camera.container)
    }

    // Clear window reference
    ;(window as any).__MAP_ENGINE__ = null

    console.log('[MapEngine] Destroyed')
  }
}
