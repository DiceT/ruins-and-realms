import { Application, Container } from 'pixi.js'
import { GameLayout } from '../../ui/GameLayout'
import { MapEngine } from '../../MapEngine'
import { OverworldManager } from '../../managers/OverworldManager'
import { TableEngine } from '../../tables/TableEngine'

/**
 * Callbacks for OverworldController to notify GameWindow of state changes
 */
export interface OverworldControllerCallbacks {
  onStepChange?: (step: number) => void
  onTerrainChange?: (terrain: string | null) => void
  onTilesToPlaceChange?: (count: number) => void
  onTownPlacedChange?: (placed: boolean) => void
  onValidMovesChange?: (moves: Set<string>) => void
  onLog?: (message: string) => void
}

/**
 * OverworldController - Manages overworld/hex map generation and interaction
 * 
 * Owns:
 * - MapEngine instance
 * - OverworldManager instance
 * - Overworld state (step, terrain, tiles, etc.)
 * 
 * GameWindow syncs via callbacks for React state updates
 */
export class OverworldController {
  private app: Application | null = null
  private layout: GameLayout | null = null
  private container: Container | null = null
  
  // Core Systems
  private mapEngine: MapEngine | null = null
  private overworldManager: OverworldManager
  private tableEngine: TableEngine | null = null
  
  // State
  private overworldStep: number = 0
  private currentTerrain: string | null = null
  private tilesToPlace: number = 0
  private townPlaced: boolean = false
  private validMoves: Set<string> = new Set()
  
  // Callbacks
  private callbacks: OverworldControllerCallbacks
  
  // Initialization flag
  private initialized: boolean = false

  constructor(callbacks: OverworldControllerCallbacks = {}) {
    this.callbacks = callbacks
    this.overworldManager = new OverworldManager()
    console.log('[OverworldController] Created')
  }

  /**
   * Check if controller is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }

  /**
   * Initialize the controller with PixiJS app and layout
   */
  public init(app: Application, layout: GameLayout): void {
    console.log('[OverworldController] init()')
    
    this.app = app
    this.layout = layout
    
    // Create main container for overworld rendering
    this.container = new Container()
    layout.middlePanel.addChild(this.container)
    
    this.initialized = true
  }

  /**
   * Initialize the MapEngine for hex grid rendering
   */
  public initMapEngine(): void {
    if (!this.app || !this.layout) {
      console.error('[OverworldController] Cannot init MapEngine - not initialized')
      return
    }

    console.log('[OverworldController] initMapEngine()')

    this.mapEngine = new MapEngine(this.app, {
      viewport: this.layout.middlePanel,
      gridType: 'hex',
      width: 100,
      height: 100,

      // Callbacks - these use controller methods
      onValidatePlacement: (x, y) => this.validatePlacement(x, y),
      onTownPlaced: (x, y) => this.handleTownPlaced(x, y),
      onTerrainPlaced: (x, y) => this.handleTerrainPlaced(x, y),
    })

    // Expose to window for debugging
    ;(window as any).__MAP_ENGINE__ = this.mapEngine

    // Initial center position
    setTimeout(() => {
      if (this.mapEngine && !this.mapEngine.destroyed) {
        this.mapEngine.camera.container.scale.set(1.0)
        const { x, y } = this.mapEngine.gridSystem.getPixelCoords(0, 0)
        this.mapEngine.camera.centerAt(x, y)
      }
    }, 100)
  }

  // --- Callback Handlers ---

  /**
   * Validate if a hex placement is valid
   */
  private validatePlacement(x: number, y: number): boolean {
    const key = `${x},${y}`

    // If in placing_terrain mode, use validMoves set
    if (this.mapEngine?.interactionState.mode === 'placing_terrain') {
      return this.validMoves.has(key)
    }

    // If map is empty, any placement is valid (First City)
    if (this.overworldManager.placedTilesMap.size === 0) return true

    // Check for adjacency
    const isOdd = y % 2 !== 0
    const neighbors = isOdd
      ? [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]
      : [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]

    let hasNeighbor = false
    for (const [dx, dy] of neighbors) {
      if (this.overworldManager.placedTilesMap.has(`${x + dx},${y + dy}`)) {
        hasNeighbor = true
        break
      }
    }

    if (!hasNeighbor) return false

    // Check overlap
    if (this.overworldManager.placedTilesMap.has(key)) return false

    return true
  }

  /**
   * Handle town placement callback
   */
  private handleTownPlaced(x: number, y: number): void {
    if (!this.mapEngine) return

    // TODO: Move sprite creation logic here
    // For now, this is a stub - the actual logic will be moved from GameWindow

    this.overworldManager.registerTownPlacement(x, y)
    this.setTownPlaced(true)
    this.setOverworldStep(1)

    this.mapEngine.interactionState.mode = 'idle'
    this.callbacks.onLog?.(`Town placed at ${x}, ${y}.`)

    // Update valid moves
    const neighbors = this.overworldManager.getValidMoves()
    this.mapEngine.highlightValidMoves(neighbors)
    this.setValidMoves(new Set(neighbors.map(m => `${m.x},${m.y}`)))
  }

  /**
   * Handle terrain placement callback
   */
  private handleTerrainPlaced(x: number, y: number): void {
    if (!this.mapEngine) return

    // Validate
    const isValid = this.validatePlacement(x, y)
    if (!isValid) {
      this.callbacks.onLog?.('Invalid placement!')
      return
    }

    // TODO: Move sprite creation and batch logic here
    // For now, this is a stub - the actual logic will be moved from GameWindow

    this.callbacks.onLog?.(`Terrain placed at ${x}, ${y}.`)
  }

  /**
   * Set visibility of the overworld container
   */
  public setVisible(visible: boolean): void {
    if (this.container) {
      this.container.visible = visible
    }
    if (this.mapEngine) {
      // MapEngine has its own container
      const mapContainer = this.mapEngine.getContainer?.()
      if (mapContainer) {
        mapContainer.visible = visible
      }
    }
  }

  // --- Getters ---
  
  public getOverworldStep(): number {
    return this.overworldStep
  }
  
  public getCurrentTerrain(): string | null {
    return this.currentTerrain
  }
  
  public getTilesToPlace(): number {
    return this.tilesToPlace
  }
  
  public isTownPlaced(): boolean {
    return this.townPlaced
  }
  
  public getValidMoves(): Set<string> {
    return this.validMoves
  }
  
  public getMapEngine(): MapEngine | null {
    return this.mapEngine
  }
  
  public getOverworldManager(): OverworldManager {
    return this.overworldManager
  }

  // --- State Setters (with callback notification) ---
  
  public setOverworldStep(step: number): void {
    this.overworldStep = step
    this.callbacks.onStepChange?.(step)
  }
  
  public setCurrentTerrain(terrain: string | null): void {
    this.currentTerrain = terrain
    this.callbacks.onTerrainChange?.(terrain)
  }
  
  public setTilesToPlace(count: number): void {
    this.tilesToPlace = count
    this.callbacks.onTilesToPlaceChange?.(count)
  }
  
  public setTownPlaced(placed: boolean): void {
    this.townPlaced = placed
    this.callbacks.onTownPlacedChange?.(placed)
  }
  
  public setValidMoves(moves: Set<string>): void {
    this.validMoves = moves
    this.callbacks.onValidMovesChange?.(moves)
  }

  // --- Lifecycle ---
  
  public destroy(): void {
    console.log('[OverworldController] destroy()')
    
    if (this.mapEngine) {
      this.mapEngine.destroy()
      this.mapEngine = null
    }
    
    if (this.container) {
      this.container.destroy({ children: true })
      this.container = null
    }
    
    this.initialized = false
  }
}
