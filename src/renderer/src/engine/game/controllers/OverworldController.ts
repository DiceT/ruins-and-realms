import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { GameLayout } from '../../ui/GameLayout'
import { MapEngine } from '../../MapEngine'
import { OverworldManager, Plot } from '../../managers/OverworldManager'
import { TableEngine } from '../../tables/TableEngine'
import { TerrainAssetLoader } from '../../map/TerrainAssetLoader'
import { HexLogic } from '../../systems/HexLogic'
import landTable from '../../../data/tables/land-table.json'
import flairOverlay from '../../../assets/images/overland-tiles/flair_empty_0.png'

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
  onHexClicked?: (x: number, y: number) => void
  onHexHover?: (x: number, y: number) => void
  onRollingChange?: (rolling: boolean) => void
  onUnclaimedLogChange?: (plots: Plot[]) => void
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
  private currentTerrainRank: number = 0
  private isTerrainUnique: boolean = false
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
    if (!this.app || !this.layout) return

    this.mapEngine = new MapEngine(this.app, {
      viewport: this.layout.middlePanel,
      gridType: 'hex',
      width: 100,
      height: 100,

      // Callbacks - these use controller methods
      onValidatePlacement: (x, y) => this.validatePlacement(x, y),
      onTownPlaced: (x, y) => this.handleTownPlaced(x, y),
      onTerrainPlaced: (x, y) => this.handleTerrainPlaced(x, y),
      // Forward hex events to GameWindow for UI interaction
      onHexHover: (x, y) => this.callbacks.onHexHover?.(x, y),
      onHexClicked: (x, y) => this.callbacks.onHexClicked?.(x, y),
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

    // 1. Calculate Hex Center
    const { x: cx, y: cy } = this.mapEngine.gridSystem.getPixelCoords(x, y)
    const h = 2 * this.mapEngine.gridSystem.config.size

    // 2. Try Texture
    const texture = TerrainAssetLoader.getRandom('town')

    if (texture) {
      const sprite = new Sprite(texture)
      sprite.anchor.set(0.5)
      sprite.x = cx
      sprite.y = cy

      const scale = h / texture.height
      sprite.scale.set(scale)

      this.mapEngine.layers.live.addChild(sprite)
    } else {
      // Fallback Shape
      const g = new Graphics()
      const r = this.mapEngine.gridSystem.config.size - 5
      const points: number[] = []
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + (i * Math.PI) / 3
        points.push(cx + r * Math.cos(angle))
        points.push(cy + r * Math.sin(angle))
      }
      g.poly(points)
      g.fill({ color: 0x00ffff, alpha: 0.9 })
      g.stroke({ width: 2, color: 0xffffff })
      this.mapEngine.layers.live.addChild(g)
    }

    // 3. Update State via Manager
    this.overworldManager.registerTownPlacement(x, y)
    this.setTownPlaced(true)
    this.setOverworldStep(1)

    this.mapEngine.interactionState.mode = 'idle'
    this.callbacks.onLog?.(`Town placed at ${x}, ${y}.`)

    // 4. Highlight Valid Moves
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

    // 1. Place Visual
    const type = this.currentTerrain || 'fields'
    const texture = TerrainAssetLoader.getRandom(type)
    
    if (texture) {
      const sprite = new Sprite(texture)
      const { x: cx, y: cy } = this.mapEngine.gridSystem.getPixelCoords(x, y)
      const h = 2 * this.mapEngine.gridSystem.config.size

      sprite.anchor.set(0.5)
      sprite.x = cx
      sprite.y = cy

      const scale = h / texture.height
      sprite.scale.set(scale)

      this.mapEngine.layers.live.addChild(sprite)

      // 2. Manager Update
      this.overworldManager.addTileToBatch(x, y, type, this.currentTerrainRank)

      // 3. Update tiles count
      const newTilesCount = this.tilesToPlace - 1
      
      // Check for Area Seed (transition to Roll Count)
      const batchSize = this.overworldManager.currentBatch.size

      if (newTilesCount <= 0) {
        if (!this.isTerrainUnique && batchSize === 1) {
          // First tile of Area placed - transition to Roll Count
          this.callbacks.onLog?.('First tile placed. Rolling for area size...')
          this.setOverworldStep(2)
          this.mapEngine.interactionState.mode = 'idle'
          this.setTilesToPlace(0)
          return
        }

        // Batch Complete
        this.setOverworldStep(1)
        this.overworldManager.finishBatch()

        this.mapEngine.interactionState.mode = 'idle'
        
        // Recalculate global valid moves
        const allValid = this.overworldManager.getValidMoves()
        this.setValidMoves(new Set(allValid.map(m => `${m.x},${m.y}`)))
        this.mapEngine.highlightValidMoves(allValid)
        
        this.callbacks.onLog?.('Batch complete. Ready to explore.')
        this.setTilesToPlace(0)
        return
      }

      // Still have tiles - update Valid Moves (Batch Adjacency)
      const batchMoves = HexLogic.getValidBatchMoves(
        this.overworldManager.currentBatch,
        this.overworldManager.placedTilesMap
      )

      if (batchMoves.length === 0) {
        this.callbacks.onLog?.('No more space! Ending batch early.')
        this.setOverworldStep(1)
        this.mapEngine.interactionState.mode = 'idle'
        this.overworldManager.finishBatch()

        // Revert to global valid
        const allValid = this.overworldManager.getValidMoves()
        this.setValidMoves(new Set(allValid.map(m => `${m.x},${m.y}`)))
        this.mapEngine.highlightValidMoves(allValid)
        this.setTilesToPlace(0)
        return
      }

      this.mapEngine.highlightValidMoves(batchMoves)
      this.setValidMoves(new Set(batchMoves.map(m => `${m.x},${m.y}`)))
      this.setTilesToPlace(newTilesCount)
    }
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

  /**
   * Handle explore tile action - rolls terrain table and places tiles
   */
  public async handleExplore(x: number, y: number): Promise<void> {
    if (!this.mapEngine) return

    this.callbacks.onRollingChange?.(true)
    this.callbacks.onLog?.(`Exploring tile at ${x},${y}...`)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await TableEngine.rollOnTable(landTable as any)
      this.callbacks.onRollingChange?.(false)

      const row = result.row
      const folder = row.folder
      const hasAssets = folder && TerrainAssetLoader.get(folder).length > 0

      if (!folder || !hasAssets) {
        this.callbacks.onLog?.(`Explored '${result.result}' but found no assets. Skipping.`)
        return
      }

      this.callbacks.onLog?.(`Discovered: ${result.result}`)
      this.setCurrentTerrain(folder)

      if (row.type === 'Unique') {
        // Place IMMEDIATELY
        const texture = TerrainAssetLoader.getRandom(folder)
        if (texture) {
          const { x: cx, y: cy } = this.mapEngine.gridSystem.getPixelCoords(x, y)
          const sprite = new Sprite(texture)
          sprite.anchor.set(0.5)
          sprite.x = cx
          sprite.y = cy
          const h = 2 * this.mapEngine.gridSystem.config.size
          sprite.scale.set(h / texture.height)
          this.mapEngine.layers.live.addChild(sprite)

          // Register unique placement
          this.overworldManager.registerUniquePlacement(
            x, y, folder, (row.rank as number) || 0,
            row.tag ? `${row.tag}${this.overworldManager.currentPlots.length + 1}` : undefined
          )

          // Add flair overlay
          const flair = Sprite.from(flairOverlay)
          flair.anchor.set(0.5)
          flair.scale.set((2 * this.mapEngine.gridSystem.config.size) / flair.height)
          flair.x = cx
          flair.y = cy - this.mapEngine.gridSystem.config.size * 0.85 - 15
          this.mapEngine.layers.overlay.addChild(flair)

          // Sync log and valid moves
          this.callbacks.onUnclaimedLogChange?.(this.overworldManager.currentPlots)
          this.callbacks.onLog?.(`Unique terrain placed at ${x},${y}.`)

          const allValid = this.overworldManager.getValidMoves()
          this.setValidMoves(new Set(allValid.map(m => `${m.x},${m.y}`)))
          this.mapEngine.highlightValidMoves(allValid)
        }
      } else {
        // AREA: Place first tile, then prompt for d8
        this.setTerrainConfig(folder, (row.rank as number) || 0, true)

        const texture = TerrainAssetLoader.getRandom(folder)
        if (texture) {
          const { x: cx, y: cy } = this.mapEngine.gridSystem.getPixelCoords(x, y)
          const sprite = new Sprite(texture)
          sprite.anchor.set(0.5)
          sprite.x = cx
          sprite.y = cy
          const h = 2 * this.mapEngine.gridSystem.config.size
          sprite.scale.set(h / texture.height)
          this.mapEngine.layers.live.addChild(sprite)

          // Manager Area Start
          this.overworldManager.createAreaPlot(row.result || 'Area', (row.rank as number) || 0, row.tag as string)
          this.overworldManager.startAreaBatch(row.result || 'Area')
          this.overworldManager.addTileToBatch(x, y, folder, (row.rank as number) || 0)

          // Add flair overlay
          const flair = Sprite.from(flairOverlay)
          flair.anchor.set(0.5)
          flair.scale.set((2 * this.mapEngine.gridSystem.config.size) / flair.height)
          flair.x = cx
          flair.y = cy - this.mapEngine.gridSystem.config.size * 0.85 - 15
          this.mapEngine.layers.overlay.addChild(flair)

          this.callbacks.onUnclaimedLogChange?.(this.overworldManager.currentPlots)
        }

        // Prompt d8
        this.setOverworldStep(2)
      }
    } catch (e) {
      console.error(e)
      this.callbacks.onRollingChange?.(false)
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

  /**
   * Configure terrain for next placement batch
   */
  public setTerrainConfig(terrain: string, rank: number, isUnique: boolean): void {
    this.currentTerrain = terrain
    this.currentTerrainRank = rank
    this.isTerrainUnique = isUnique
    this.callbacks.onTerrainChange?.(terrain)
  }

  /**
   * Start town placement mode
   */
  public startTownPlacement(): void {
    if (!this.mapEngine) return
    this.mapEngine.interactionState.mode = 'placing_town'
    this.callbacks.onLog?.('Click on a hex to place your town.')
  }

  /**
   * Start terrain placement mode
   */
  public startTerrainPlacement(count: number): void {
    if (!this.mapEngine) return
    
    this.setTilesToPlace(count)
    this.setOverworldStep(3)
    this.mapEngine.interactionState.mode = 'placing_terrain'
    
    // Calculate valid batch moves (adjacent to current batch, not on occupied tiles)
    const batchMoves = HexLogic.getValidBatchMoves(
      this.overworldManager.currentBatch,
      this.overworldManager.placedTilesMap
    )
    
    // Highlight and update valid moves
    this.mapEngine.highlightValidMoves(batchMoves)
    this.setValidMoves(new Set(batchMoves.map(m => `${m.x},${m.y}`)))
    
    if (batchMoves.length === 0) {
      this.callbacks.onLog?.('No valid adjacent spots! Ending batch.')
      this.setOverworldStep(1)
      this.mapEngine.interactionState.mode = 'idle'
      this.overworldManager.finishBatch()
      
      // Revert to global valid moves
      const allValid = this.overworldManager.getValidMoves()
      this.setValidMoves(new Set(allValid.map(m => `${m.x},${m.y}`)))
      this.mapEngine.highlightValidMoves(allValid)
      return
    }
    
    this.callbacks.onLog?.(`Placing ${count} ${this.currentTerrain} tiles...`)
  }

  // --- Lifecycle ---
  
  public destroy(): void {
    
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
