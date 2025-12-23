import { Application, Container, TickerCallback } from 'pixi.js'
import { Camera } from './Camera'
import { DungeonGenerator } from './map/DungeonGenerator'
import { BaseGridSystem } from './systems/BaseGridSystem'
import { SquareGridSystem } from './systems/SquareGridSystem'
import { HexGridSystem } from './systems/HexGridSystem'

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
  public dungeon: DungeonGenerator
  private tickerCallback: TickerCallback<MapEngine> | null = null
  private destroyed: boolean = false

  // Interaction State
  public interactionState = {
    mode: 'idle' as 'idle' | 'placing_entrance' | 'placing_room' | 'placing_exit' | 'placing_new_room',
    hoveredTile: { x: -1, y: -1 },
    hoveredRoomId: null as string | null,
    pendingRoomSize: { w: 0, h: 0 },
    activeRoomId: null as string | null,
    activeExitId: null as string | null
  }
  public options: MapEngineOptions

  constructor(app: Application, options: MapEngineOptions = { gridType: 'square' }) {
    this.app = app

    // Initialize Dungeon Generator
    // Default to 20x20 if not provided
    const w = options.width || 20
    const h = options.height || 20
    this.dungeon = new DungeonGenerator(w, h)

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
    this.camera.container.addChild(this.layers.object)
    this.camera.container.addChild(this.layers.notes)
    this.camera.container.addChild(this.layers.interaction)

    // 3. Initialize Grid System
    if (options.gridType === 'hex') {
      this.gridSystem = new HexGridSystem(this)
    } else {
      this.gridSystem = new SquareGridSystem(this)
    }

    // 4. Render Loop
    let lastLog = 0
    this.tickerCallback = () => {
      if (!this.destroyed) {
        // Track mouse to update tile hover (SAFENED)
        const renderer = this.app.renderer
        const events = (renderer as any).events
        if (events && events.pointer) {
          const mouse = events.pointer.global
          const worldPos = this.camera.toWorld(mouse.x, mouse.y)
          const tx = Math.floor(worldPos.x / this.gridSystem.config.size)
          const ty = Math.floor(worldPos.y / this.gridSystem.config.size)
          
          this.interactionState.hoveredTile = { x: tx, y: ty }
          
          // Detect hovered room from tile
          const dungeonState = this.dungeon.getState()
          const tile = dungeonState.tiles[ty]?.[tx]
          if (tile && tile.roomId) {
            this.interactionState.hoveredRoomId = tile.roomId
          } else {
            this.interactionState.hoveredRoomId = null
          }
        }

        this.gridSystem.draw()

        // Debug log once per second (DISABLED - too noisy)
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
    
    target.on('pointertap', () => {
      if (this.interactionState.mode === 'placing_entrance') {
        const { x, y } = this.interactionState.hoveredTile
        if (this.dungeon.isValidEntrancePosition(x, y)) {
          this.dungeon.applyEntrance(x, y)
          this.interactionState.mode = 'idle'
          if (this.options.onEntrancePlaced) {
            this.options.onEntrancePlaced(x, y)
          }
        }
      } else if (this.interactionState.mode === 'placing_room') {
        const { x, y } = this.interactionState.hoveredTile
        const { w, h } = this.interactionState.pendingRoomSize
        if (this.dungeon.placeStartingRoom(x, y, w, h)) {
          this.interactionState.mode = 'idle'
          if (this.options.onRoomPlaced) {
            this.options.onRoomPlaced(x, y, w, h)
          }
        }
      } else if (this.interactionState.mode === 'placing_exit') {
        const { x, y } = this.interactionState.hoveredTile
        const roomId = this.interactionState.activeRoomId
        if (roomId && this.dungeon.addExit(x, y, roomId)) {
          // Do NOT reset to idle. Let the UI controller handle it when count matches.
          if (this.options.onExitPlaced) {
            this.options.onExitPlaced(x, y)
          }
        }
      } else if (this.interactionState.mode === 'idle') {
        // Check if clicking an unused exit to initiate new room
        const { x, y } = this.interactionState.hoveredTile
        const dungeonState = this.dungeon.getState()
        
        for (const room of dungeonState.rooms) {
          const exit = room.exits.find((e) => e.x === x && e.y === y)
          if (exit && !exit.connectedRoomId) {
            // Unused exit clicked
            if (this.options.onExitClicked) {
              this.options.onExitClicked(exit.id)
            }
            break
          }
        }
      } else if (this.interactionState.mode === 'placing_new_room') {
        const { x, y } = this.interactionState.hoveredTile
        const { w, h } = this.interactionState.pendingRoomSize
        const exitId = this.interactionState.activeExitId

        if (exitId) {
          const roomId = this.dungeon.placeNewRoom(x, y, w, h, exitId)
          if (roomId) {
            this.interactionState.mode = 'idle'
            this.interactionState.activeExitId = null
            if (this.options.onNewRoomPlaced) {
              this.options.onNewRoomPlaced(roomId, exitId)
            }
          }
        }
      }
    })

    // 6. Initial Center and Fit
    const mapState = this.dungeon.getState()
    const tileSize = this.gridSystem.config.size

    const totalW = mapState.width * tileSize
    const totalH = mapState.height * tileSize

    this.camera.fitToView(totalW, totalH, 50)

    // DEBUG: Expose for DebugToolbar
    ;(window as any).__MAP_ENGINE__ = this
  }

  public destroy(): void {
    // 1. Stop Render Loop
    if (this.tickerCallback) {
      this.app.ticker.remove(this.tickerCallback)
      this.tickerCallback = null
    }

    // 2. Clean up Camera (remove listeners)
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
