import { HexLogic } from '../systems/HexLogic'

export interface LandTypeRecord {
  land: string
  rank: number
  coordX: number
  coordY: number
}

export interface Plot {
  plotTag: string
  landType: string
  size: number
  rank: number
  rankModifier: number
  ownerAndDetails: string
  landTypeList: LandTypeRecord[]
}

export class OverworldManager {
  // Game State
  private plots: Plot[] = []
  private _currentBatch: Set<string> = new Set()
  private placedTiles: Map<string, string> = new Map()

  // Current Action State
  private _step: number = 0 // 0=Init, 1=Explore, 2=RollCount, 3=Place
  private _activePlotIndex: number = -1

  constructor() {
    this.plots = []
    this._currentBatch = new Set()
    this.placedTiles = new Map()
  }

  get step(): number {
    return this._step
  }
  get activePlotIndex(): number {
    return this._activePlotIndex
  }
  get currentPlots(): Plot[] {
    return [...this.plots]
  } // Return copy
  get placedTilesMap(): Map<string, string> {
    return this.placedTiles
  }
  get currentBatch(): Set<string> {
    return this._currentBatch
  }

  setStep(step: number): void {
    this._step = step
  }

  // --- Logic Queries ---

  /**
   * Calculates valid moves based on current state (Batch vs Global).
   */
  getValidMoves(): { x: number; y: number }[] {
    // If we are placing a batch (Area), we must be adjacent to existing batch members
    // UNLESS it's the first tile of the batch (currentBatch size 0).
    if (this._step === 3 && this._currentBatch.size > 0) {
      return HexLogic.getValidBatchMoves(this._currentBatch, this.placedTiles)
    }

    // Otherwise (Explore mode, or first tile of batch), valid moves are neighbors of ANY placed tile
    // OR global anywhere if map is empty? (Handled by caller usually, but logic here:)
    if (this.placedTiles.size === 0) {
      // Technically anywhere is valid if empty, caller handles visual 'center' usually
      return []
    }

    return HexLogic.getAllValidMoves(this.placedTiles)
  }

  // --- Actions ---

  registerTownPlacement(x: number, y: number): void {
    this.placedTiles.set(`${x},${y}`, 'Town')

    const newPlot: Plot = {
      plotTag: `TWN${this.plots.length + 1}`,
      landType: 'Town',
      size: 1,
      rank: 0,
      rankModifier: 0,
      ownerAndDetails: 'N/A',
      landTypeList: [
        {
          land: 'Town',
          rank: 0,
          coordX: x,
          coordY: y
        }
      ]
    }
    this.plots.push(newPlot)
    this._step = 1 // Step 1: Explore
  }

  startAreaBatch(_landType: string): void {
    this._currentBatch.clear()
    this._step = 3 // Placing

    // Create the Plot entry immediately?
    // Usually we create it when we start rolling?
    // In GameWindow logic: "setOverworldStep(2)" comes first (Roll Count).
    // Then "setOverworldStep(3)" (Place).
    // The Plot is added to log BEFORE placement starts in GameWindow (line 960).

    // So we should expose method to Create Plot
  }

  createAreaPlot(landType: string, rank: number = 0, tag?: string): void {
    const newPlot: Plot = {
      plotTag: tag ? `${tag}${this.plots.length + 1}` : `P${this.plots.length + 1}`,
      landType: landType,
      size: 0, // Will grow
      rank: rank,
      rankModifier: 0,
      ownerAndDetails: 'Unclaimed',
      landTypeList: []
    }
    this.plots.push(newPlot)
    this._activePlotIndex = this.plots.length - 1
  }

  registerUniquePlacement(
    x: number,
    y: number,
    landType: string,
    rank: number,
    tag?: string
  ): void {
    this.placedTiles.set(`${x},${y}`, landType)

    const newPlot: Plot = {
      plotTag: tag || `UNI${this.plots.length + 1}`,
      landType: landType,
      size: 1,
      rank: rank,
      rankModifier: 0,
      ownerAndDetails: 'N/A',
      landTypeList: [
        {
          land: landType,
          rank: rank,
          coordX: x,
          coordY: y
        }
      ]
    }
    this.plots.push(newPlot)
    // Unique placement implicitly ends any current batch (though there shouldn't be one in Explore mode)
    this._step = 1 // Ensure we represent Explore state
  }

  addTileToBatch(x: number, y: number, landType: string, rank: number): void {
    // 1. Update Map
    this.placedTiles.set(`${x},${y}`, landType)
    this._currentBatch.add(`${x},${y}`)

    // 2. Update Plot
    if (this._activePlotIndex >= 0 && this._activePlotIndex < this.plots.length) {
      const plot = this.plots[this._activePlotIndex]
      plot.landTypeList.push({
        land: landType,
        rank: rank,
        coordX: x,
        coordY: y
      })
      plot.size = plot.landTypeList.length
      // plot.rank might update?
    }
  }

  finishBatch(): void {
    this._currentBatch.clear()
    this._activePlotIndex = -1
    this._step = 1 // Back to Explore
  }
}
