/**
 * Spine-Seed Dungeon Generator
 * 
 * Two-layer generation: spine path drives topology, seeds grow into rectangular rooms.
 * Phase 1: Spine Growth - organic pathfinding creates main corridor network
 * Phase 2: Seed Ejection - seeds dropped along spine at intervals
 * Phase 3: Room Growth - seeds expand into rectangles until collision
 * Phase 4: Wall Generation - walls drawn around final geometry
 */

import { SeededRNG } from '../../../utils/SeededRNG'
import {
  SpineSeedSettings,
  SpineSeedState,
  SpineTile,
  RoomSeed,
  GridTile,
  GridCoord,
  Direction,
  createDefaultSpineSeedSettings
} from '../types'
import { ManualSeedConfig, SeedSide, RangeOrNumber } from '../SeedDefinitions'
import { createVirtualConfig, expandRepeats } from '../ManualSeedSystem'
import { TrellisManager } from '../TrellisManager'
import { TrellisContext } from '../trellises/ITrellis'

// Direction vectors
const DIRECTIONS: { [key in Direction]: GridCoord } = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 }
}

const DIR_KEYS: Direction[] = ['north', 'south', 'east', 'west']

// Opposite directions
const OPPOSITE: { [key in Direction]: Direction } = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
}

// Perpendicular directions
const PERPENDICULAR: { [key in Direction]: Direction[] } = {
  north: ['east', 'west'],
  south: ['east', 'west'],
  east: ['north', 'south'],
  west: ['north', 'south']
}

export class SpineSeedGenerator {
  private settings: SpineSeedSettings
  private rng: SeededRNG
  private state: SpineSeedState
  private localSeedQueue: ManualSeedConfig[] = []

  constructor(settings?: SpineSeedSettings) {
    this.settings = settings ? { ...settings } : createDefaultSpineSeedSettings()
    this.rng = new SeededRNG(this.settings.seed)
    this.localSeedQueue = expandRepeats(this.settings.manualSeedQueue || [])
    this.state = this.createInitialState()
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  public reset(settings: SpineSeedSettings): void {
    this.settings = { ...settings }
    this.rng = new SeededRNG(settings.seed)
    this.localSeedQueue = expandRepeats(this.settings.manualSeedQueue || [])
    this.state = this.createInitialState()
  }

  /** Get current state (for rendering) */
  public getState(): SpineSeedState {
    return this.state
  }

  /** Get current settings */
  public getSettings(): SpineSeedSettings {
    return this.settings
  }

  /** Execute a single step based on current phase. Returns true if progress was made. */
  public step(): boolean {
    if (this.state.isComplete) return false

    switch (this.state.phase) {
      case 'spine':
        return this.stepSpine()
      case 'ejection':
        return this.stepEjection()
      case 'roomGrowth':
        return this.stepRoomGrowth()
      case 'walls':
        return this.stepWalls()
      case 'complete':
        return false
      default:
        return false
    }
  }

  /** Run until completion */
  public runToCompletion(): void {
    while (!this.state.isComplete) {
      this.step()
    }
  }

  /** Run N steps */
  public runSteps(n: number): number {
    let count = 0
    for (let i = 0; i < n && !this.state.isComplete; i++) {
      if (this.step()) count++
    }
    return count
  }

  /** Run current phase to completion, then return */
  public runPhaseToCompletion(): void {
    const startPhase = this.state.phase
    while (this.state.phase === startPhase && !this.state.isComplete) {
      this.step()
    }
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private createInitialState(): SpineSeedState {
    const { gridWidth, gridHeight } = this.settings

    // Create empty grid
    const grid: GridTile[][] = []
    for (let y = 0; y < gridHeight; y++) {
      const row: GridTile[] = []
      for (let x = 0; x < gridWidth; x++) {
        row.push({
          x,
          y,
          state: 'empty',
          regionId: null,
          growthOrder: null
        })
      }
      grid.push(row)
    }

    const state: SpineSeedState = {
      grid,

      phase: 'spine',

      spineTiles: [],
      spineFrontier: new Set(),
      forkCount: 0,
      loopCount: 0,
      spineComplete: false,

      roomSeeds: [],
      ejectionIndex: 0,
      distanceToNextEjection: this.calculateNextEjectionDistance(),
      ejectionComplete: false,

      roomFrontiers: new Map(),
      roomGrowthComplete: false,

      tilesGrown: 0,
      stepCount: 0,
      isComplete: false,
      objects: []
    }

    // Place initial spine tile at center
    this.placeInitialSpineTile(state)

    return state
  }

  private placeInitialSpineTile(state: SpineSeedState): void {
    const { gridWidth, gridHeight, turnOverride } = this.settings
    let startX = Math.floor(gridWidth / 2)
    const startY = gridHeight - 2
    
    // Clear legacy waypoints (we use per-head waypoints now)
    state.waypoints = []
    state.activeHeads = []
    
    let initialWaypoints: {x: number, y: number}[] = []
    let isTrunk = false

    // Handle Overrides
    if (turnOverride === 'F') {
      // F: Start Middle, go Up 20-40%
      // Height * 0.2..0.4
      const trunkH = Math.floor(gridHeight * (0.2 + this.rng.next() * 0.2))
      const forkY = startY - trunkH
      initialWaypoints.push({ x: startX, y: forkY })
      isTrunk = true
    }
    else if (turnOverride === 'S' || turnOverride === 'U') {
      const isLeft = this.rng.next() < 0.5
      startX = Math.floor(gridWidth * (isLeft ? 0.25 : 0.75))
      const crossX = Math.floor(gridWidth * (isLeft ? 0.75 : 0.25))
      
      const crossY = Math.floor(gridHeight * (0.2 + this.rng.next() * 0.6))

      // 1. Move Up to crossY
      initialWaypoints.push({ x: startX, y: crossY })
      // 2. Move Across to crossX
      initialWaypoints.push({ x: crossX, y: crossY })
      // 3. Final leg
      if (turnOverride === 'S') {
        initialWaypoints.push({ x: crossX, y: 2 })
      } else {
        initialWaypoints.push({ x: crossX, y: gridHeight - 2 })
      }
    }

    const spineTile: SpineTile = {
      x: startX,
      y: startY,
      spineOrder: 0,
      direction: 'north',
      isForkPoint: false,
      isLoopPoint: false,
      branchId: 0
    }
    state.spineTiles.push(spineTile)
    const tile = state.grid[startY][startX]
    tile.state = 'floor'
    tile.regionId = -1
    tile.growthOrder = state.tilesGrown++
    tile.isCorridor = true
    
    // Initialize Head
    state.activeHeads.push({
      x: startX, 
      y: startY, 
      dir: 'north',
      waypoints: initialWaypoints,
      isTrunk
    })
  }

  // ===========================================================================
  // Phase 1: Spine Growth (Linear, head-based movement)
  // ===========================================================================

  private stepSpine(): boolean {
    if (this.state.spineComplete) {
      this.state.phase = 'ejection'
      return false
    }
    if (this.state.tilesGrown >= this.settings.tileBudget) {
      this.state.spineComplete = true
      this.state.phase = 'ejection'
      return false
    }
    
    // Check active heads
    if (!this.state.activeHeads || this.state.activeHeads.length === 0) {
       this.state.spineComplete = true
       this.state.phase = 'ejection'
       return false
    }

    let anyGrew = false
    // Loop backwards to safely splice
    for (let i = this.state.activeHeads.length - 1; i >= 0; i--) {
        const head = this.state.activeHeads[i]
        const grew = this.growSpineHead(head)
        if (grew) anyGrew = true
        else {
            // Head finished or blocked. Remove it.
            this.state.activeHeads.splice(i, 1)
        }
    }

    if (this.state.activeHeads.length > 0) {
      this.state.stepCount++
      return true
    } else {
      // All heads stopped
      this.state.spineComplete = true
      this.state.phase = 'ejection'
      return false
    }
  }

  private growSpineHead(head: SpineHead): boolean {
    const headX = head.x
    const headY = head.y

    // Waypoint Logic
    if (head.waypoints.length > 0) {
        const target = head.waypoints[0]
        
        // Check if reached
        if (headX === target.x && headY === target.y) {
           head.waypoints.shift()
           
           // Fork Logic
           if (head.isTrunk && head.waypoints.length === 0) {
               this.spawnForkHeads(head)
               // Trunk is consumed. Return false to remove it from activeHeads.
               return false 
           }

           if (head.waypoints.length === 0) return false // Path complete
           return this.growSpineHead(head) // Continue
        }

        // Determine explicit direction
        let nextDir: Direction = 'north' // default
        if (target.x > headX) nextDir = 'east'
        else if (target.x < headX) nextDir = 'west'
        else if (target.y < headY) nextDir = 'north'
        else if (target.y > headY) nextDir = 'south'
        
        const nextX = headX + DIRECTIONS[nextDir].x
        const nextY = headY + DIRECTIONS[nextDir].y
        
        if (this.validateSpinePlacement({x: nextX, y: nextY})) {
             this.placeSpineTile(nextX, nextY, nextDir)
             head.x = nextX
             head.y = nextY
             head.dir = nextDir
             return true
        } else {
             return false // Blocked
        }
    }

    // Normal Growth (Wiggle/Straight)
    const headDir = head.dir || 'north'
    const { straightBias, turnPenalty, forceStraight } = this.settings

    // Build weighted options: { dir, weight, x, y }
    const options: { dir: Direction; weight: number; x: number; y: number }[] = []

    // 1. Forward (highest preference usually)
    const fwdPos = { x: headX + DIRECTIONS[headDir].x, y: headY + DIRECTIONS[headDir].y }
    if (this.validateSpinePlacement(fwdPos)) {
      options.push({ 
        dir: headDir, 
        weight: 1 + straightBias * 2, // Multiplier for stronger bias
        x: fwdPos.x, 
        y: fwdPos.y 
      })
    }

    // 2. Turns (Left/Right)
    if (!forceStraight) {
      const perps = PERPENDICULAR[headDir]
      const turnWeight = Math.pow(0.85, turnPenalty)

      for (const perpDir of perps) {
        const turnPos = { x: headX + DIRECTIONS[perpDir].x, y: headY + DIRECTIONS[perpDir].y }
        if (this.validateSpinePlacement(turnPos)) {
          options.push({ 
            dir: perpDir, 
            weight: turnWeight,
            x: turnPos.x, 
            y: turnPos.y 
          })
        }
      }
    }

    // No valid moves? blocked.
    if (options.length === 0) {
      return false
    }

    // Weighted random selection
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0)
    let pick = this.rng.next() * totalWeight
    
    let selected = options[options.length - 1]
    for (const opt of options) {
      pick -= opt.weight
      if (pick <= 0) {
        selected = opt
        break
      }
    }

    this.placeSpineTile(selected.x, selected.y, selected.dir)
    head.x = selected.x
    head.y = selected.y
    head.dir = selected.dir
    return true
  }

  private spawnForkHeads(trunk: SpineHead): void {
      const { gridWidth, gridHeight } = this.settings
      const startX = trunk.x
      const startY = trunk.y
      
      const r = this.rng.next()
      let pattern = 'ABC'
      if (r < 0.3) pattern = 'AB'
      else if (r < 0.6) pattern = 'AC'
      else if (r < 0.9) pattern = 'BC'
      
      const newHeads: SpineHead[] = []
      
      if (pattern.includes('A')) {
          newHeads.push({
             x: startX, y: startY, dir: 'north',
             waypoints: [{ x: startX, y: 0 }] 
          })
      }
      if (pattern.includes('B')) {
          // Left Branch: Go to 20-30% W.
          const targetX = Math.floor(gridWidth * (0.2 + this.rng.next() * 0.1))
          newHeads.push({
             x: startX, y: startY, dir: 'west',
             waypoints: [ { x: targetX, y: startY }, { x: targetX, y: 0 } ]
          })
      }
      if (pattern.includes('C')) {
          // Right Branch: Go to 70-80% W.
          const targetX = Math.floor(gridWidth * (0.7 + this.rng.next() * 0.1))
          newHeads.push({
             x: startX, y: startY, dir: 'east',
             waypoints: [ { x: targetX, y: startY }, { x: targetX, y: 0 } ]
          })
      }
      
      // Add to activeHeads (via state)
      // Note: stepSpine is iterating activeHeads backwards. 
      // If we push, they are at the end. Safe.
      this.state.activeHeads.push(...newHeads)
  }

  private placeSpineTile(x: number, y: number, dir: Direction, isFork: boolean = false, overrideWidth?: number): boolean {
    const spineTile: SpineTile = {
      x,
      y,
      spineOrder: this.state.spineTiles.length,
      direction: dir,
      isForkPoint: false,
      isLoopPoint: false,
      branchId: 0
    }

    this.state.spineTiles.push(spineTile)

    // Mark tile in grid
    this.markSpineGrid(x, y, this.state.tilesGrown++)

    // Wide Spine Logic
    const width = overrideWidth || this.settings.spine.spineWidth
    if (width > 1) {
        const radius = Math.floor((width - 1) / 2)
        const perps = PERPENDICULAR[dir]
        for (let i = 1; i <= radius; i++) {
             const isEdge = (i === radius)
             
             // Left
             this.markSpineNeighbor(x, y, perps[0], i, isEdge)
             // Right
             this.markSpineNeighbor(x, y, perps[1], i, isEdge)
        }
    }

    return true
  }

  private markSpineNeighbor(centerX: number, centerY: number, dir: Direction, offset: number, isEdge: boolean) {
      const nx = centerX + DIRECTIONS[dir].x * offset
      const ny = centerY + DIRECTIONS[dir].y * offset
      
      if (!this.inBounds(nx, ny)) return
      
      const tile = this.state.grid[ny][nx]
      if (tile.state === 'empty') {
          this.markSpineGrid(nx, ny, this.state.tilesGrown++, isEdge)
      }
  }

  private markSpineGrid(x: number, y: number, order: number, isWall: boolean = false) {
     const tile = this.state.grid[y][x]

     // Union Logic: Floor > Wall > Empty
     
     // Case 1: Existing Floor. Do not overwrite with Wall.
     if (isWall && tile.regionId === -1 && tile.state === 'floor') {
         return
     }

     tile.state = isWall ? 'wall' : 'floor' // Output 'wall' for edges
     tile.regionId = -1
     tile.growthOrder = order
     tile.isCorridor = true
  }



  private getAlternativeDirections(currentDir: Direction): Direction[] {
    // Try perpendiculars first, then opposite as last resort
    return [...PERPENDICULAR[currentDir], OPPOSITE[currentDir]]
  }

  private getSpineCandidates(): { pos: GridCoord; dir: Direction; weight: number }[] {
    const candidates: { pos: GridCoord; dir: Direction; weight: number }[] = []
    const lastTile = this.state.spineTiles[this.state.spineTiles.length - 1]
    const lastDir = lastTile?.direction || 'north'

    for (const idx of this.state.spineFrontier) {
      const pos = this.indexToCoord(idx)
      
      // Validate placement
      if (!this.validateSpinePlacement(pos)) {
        continue
      }

      // Determine direction this tile represents
      const dir = this.getDirectionFromParent(pos)

      // Calculate weight using growth physics
      let weight = 1.0

      // Straight bias
      if (dir === lastDir) {
        weight *= 1 + this.settings.straightBias
      }

      // Turn penalty
      if (dir !== lastDir && dir !== OPPOSITE[lastDir]) {
        weight *= Math.max(0.1, 1 - this.settings.turnPenalty * 0.2)
      }

      if (weight > 0) {
        candidates.push({ pos, dir, weight })
      }
    }

    return candidates
  }

  private getDirectionFromParent(pos: GridCoord): Direction {
    // Find which direction we came from
    for (const d of DIR_KEYS) {
      const nx = pos.x + DIRECTIONS[d].x
      const ny = pos.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny)) {
        const neighbor = this.state.grid[ny][nx]
        if (neighbor.regionId === -1) { // Part of spine
          return OPPOSITE[d]
        }
      }
    }
    return 'north'
  }

  private validateSpinePlacement(pos: GridCoord): boolean {
    if (!this.inBounds(pos.x, pos.y)) return false
    
    const tile = this.state.grid[pos.y][pos.x]
    
    // Allow overlapping existing spine (needed for wide spine turns where neighbors block the path)
    if (tile.regionId === -1) return true

    if (tile.state !== 'empty') return false

    return true
  }

  private updateSpineFrontier(state: SpineSeedState, pos: GridCoord): void {
    for (const d of DIR_KEYS) {
      const nx = pos.x + DIRECTIONS[d].x
      const ny = pos.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny)) {
        const neighbor = state.grid[ny][nx]
        if (neighbor.state === 'empty') {
          state.spineFrontier.add(this.tileIndex({ x: nx, y: ny }))
        }
      }
    }
  }

  private maybeCreateFork(tile: SpineTile): void {
    if (this.state.forkCount >= this.settings.spine.maxForks) return

    // Random chance to fork based on branch penalty (inverted)
    const forkChance = 1 - this.settings.branchPenalty
    if (this.rng.next() > forkChance * 0.3) return // 30% max fork rate

    // Mark as fork point
    tile.isForkPoint = true
    this.state.forkCount++

    // Add perpendicular tiles to frontier with higher priority
    const perps = PERPENDICULAR[tile.direction]
    for (const d of perps) {
      const nx = tile.x + DIRECTIONS[d].x
      const ny = tile.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny) && this.state.grid[ny][nx].state === 'empty') {
        this.state.spineFrontier.add(this.tileIndex({ x: nx, y: ny }))
      }
    }
  }

  // ===========================================================================
  // Phase 2: Seed Ejection
  // ===========================================================================

  private stepEjection(): boolean {
    if (this.state.ejectionComplete) {
      this.state.phase = 'roomGrowth'
      return false
    }

    // Process one spine tile for ejection
    if (this.state.ejectionIndex >= this.state.spineTiles.length) {
      this.state.ejectionComplete = true
      this.state.phase = 'roomGrowth'
      return false
    }

    const spineTile = this.state.spineTiles[this.state.ejectionIndex]
    this.state.ejectionIndex++

    // Check if we should eject at this tile
    this.state.distanceToNextEjection--
    if (this.state.distanceToNextEjection > 0) {
      return true // Progress but no ejection
    }

    // Reset distance counter
    this.state.distanceToNextEjection = this.calculateNextEjectionDistance()

    // Eject seed(s)
    this.ejectSeed(spineTile)

    // Check limit and trim tail
    if (this.state.roomSeeds.length >= this.settings.seedCount) {
      this.state.ejectionComplete = true
      this.state.phase = 'roomGrowth'

      // Trim unused spine tiles (only for Normal/Organic spines)
      // For S, U, F overrides, we want to preserve the full shape even if seed count is met
      // UPDATE: User requests culling for ALL shapes (S, U, Fork) back to last seed.
      if (true) {
        const unusedTiles = this.state.spineTiles.splice(this.state.ejectionIndex)
        const width = this.settings.spine.spineWidth
        const radius = Math.floor((width - 1) / 2)

        for (const t of unusedTiles) {
          // Clear center
          this.clearSpineTile(t.x, t.y)
          
          // Clear neighbors
          if (width > 1) {
             const perps = PERPENDICULAR[t.direction]
             for (let i = 1; i <= radius; i++) {
                 // Left
                 const lx = t.x + DIRECTIONS[perps[0]].x * i
                 const ly = t.y + DIRECTIONS[perps[0]].y * i
                 this.clearSpineTile(lx, ly)
                 // Right
                 const rx = t.x + DIRECTIONS[perps[1]].x * i
                 const ry = t.y + DIRECTIONS[perps[1]].y * i
                 this.clearSpineTile(rx, ry)
             }
          }
        }
      }
    }

    this.state.stepCount++
    return true
  }

  private clearSpineTile(x: number, y: number): void {
      if (this.inBounds(x, y)) {
          const tile = this.state.grid[y][x]
          // Only clear if it looks like a spine/empty tile?
          // If we are trimming, we assume these are the spine tiles we placed.
          tile.state = 'empty'
          tile.regionId = null
          tile.isCorridor = false
      }
  }

  private calculateNextEjectionDistance(): number {
    const { minInterval, maxInterval, intervalMode } = this.settings.ejection
    
    if (intervalMode === 'fixed') {
      return Math.floor((minInterval + maxInterval) / 2)
    }
    
    return this.rng.nextInt(minInterval, maxInterval)
  }

  private ejectSeed__OLD(spineTile: SpineTile): void {
    const { ejectionSide, pairedEjection, minDistance, maxDistance, dudChance, wallSeedChance } = this.settings.ejection
    const { minWidth, maxWidth, minHeight, maxHeight } = this.settings.roomGrowth

    // Check Symmetry Logic (Chance to mirror)
    const isSymmetric = (this.settings.symmetry > 0) && (this.rng.next() < this.settings.symmetry / 100)

    let sides: Direction[] = []
    const perps = PERPENDICULAR[spineTile.direction]

    if (isSymmetric) {
      sides.push(...perps)
    } else {
      switch (ejectionSide) {
        case 'both':
          sides.push(...perps)
          break
        case 'left':
          sides.push(perps[0])
          break
        case 'right':
          sides.push(perps[1])
          break
        case 'random':
          sides.push(perps[this.rng.nextInt(0, 1)])
          break
      }
    }

    // Pre-calculate shared params if symmetric
    let sharedDist = 0
    let sharedW = 0
    let sharedH = 0
    // Secondary shared params
    let sharedSecondaryOffset = 0
    let sharedW2 = 0
    let sharedH2 = 0
    
    if (isSymmetric) {
       sharedDist = this.rng.nextInt(minDistance, maxDistance)
       sharedW = this.rng.nextInt(minWidth, maxWidth)
       sharedH = this.rng.nextInt(minHeight, maxHeight)
       
       if (this.settings.symmetryStrictSecondary) {
           sharedSecondaryOffset = this.rng.nextInt(3, 6)
           sharedW2 = this.rng.nextInt(minWidth, maxWidth)
           sharedH2 = this.rng.nextInt(minHeight, maxHeight)
       }
    }

    const primarySeeds: RoomSeed[] = []
    const secondarySeeds: RoomSeed[] = []

    for (const side of sides) {
      if (this.state.roomSeeds.length >= this.settings.seedCount) break

      // Use shared params if symmetric, otherwise random
      const distance = isSymmetric ? sharedDist : this.rng.nextInt(minDistance, maxDistance)
      const targetW = isSymmetric ? sharedW : this.rng.nextInt(minWidth, maxWidth)
      const targetH = isSymmetric ? sharedH : this.rng.nextInt(minHeight, maxHeight)
      
      const seedOpts = {
          minWidth: isSymmetric ? targetW : minWidth, 
          maxWidth: isSymmetric ? targetW : maxWidth,
          minHeight: isSymmetric ? targetH : minHeight,
          maxHeight: isSymmetric ? targetH : maxHeight,
          dudChance, wallSeedChance
      }

      // Primary seed
      const s1 = this.createRoomSeed(spineTile, side, distance, seedOpts, 'primary')
      if (s1 && isSymmetric) primarySeeds.push(s1)

      // Paired seed (farther)
      if (pairedEjection && this.state.roomSeeds.length < this.settings.seedCount) {
        // Determine offset and size for secondary
        const useStrictSec = isSymmetric && this.settings.symmetryStrictSecondary
        const offset = useStrictSec ? sharedSecondaryOffset : this.rng.nextInt(3, 6)
        
        const secW = useStrictSec ? sharedW2 : undefined // If undefined, createRoomSeed picks random using opts
        const secH = useStrictSec ? sharedH2 : undefined
        
        const secOpts = {
             minWidth: secW ?? minWidth,
             maxWidth: secW ?? maxWidth,
             minHeight: secH ?? minHeight,
             maxHeight: secH ?? maxHeight,
             dudChance, wallSeedChance
        }

        const s2 = this.createRoomSeed(spineTile, side, distance + offset, secOpts, 'secondary')
        if (s2 && isSymmetric) secondarySeeds.push(s2)
      }
    }

    // If strict symmetric matches needed, link them here
    if (isSymmetric) {
        // Link primaries
        if (primarySeeds.length === 2) {
             primarySeeds[0].partnerId = primarySeeds[1].id
             primarySeeds[1].partnerId = primarySeeds[0].id
        }
        // Link secondaries
         if (secondarySeeds.length === 2) {
             secondarySeeds[0].partnerId = secondarySeeds[1].id
             secondarySeeds[1].partnerId = secondarySeeds[0].id
        }
    }
  }

  private ejectSeed(spineTile: SpineTile): void {
      const { ejection, seedCount } = this.settings
      
      // Helper: Dequeue next available manual seed or create virtual
      const getNextSeed = (): { config: ManualSeedConfig, isManual: boolean } => {
          if (this.localSeedQueue.length > 0) {
              const config = this.localSeedQueue.shift()!
              return { config, isManual: true }
          }
          return { config: createVirtualConfig(this.settings, this.rng), isManual: false }
      }

      // 1. Get Primary Seed for Side 1 (Target Side)
      // We look at the first seed to determine target side preferences, but we consume it.
      // Wait, we need to know the 'side' before we loop.
      // But the first seed dictating the side is only relevant if it's manual.
      // So we peek? No, we just get it.
      
      // Actually, we must determine SIDES first.
      // If the first seed in queue says "Left", we do Left.
      // If it says "Both", we do Both.
      // If it says "Any", we resolve global.
      
      // So we MUST peek or shift the first seed to plan the ejection.
      // Let's shift it. This is "Seed 1".
      const seed1 = getNextSeed()
      const primaryConfig = seed1.config
      const isManual = seed1.isManual

      // Basic Symmetry Logic (random mirror)
      const allowMirror = primaryConfig.allowMirror !== false
      const symmetryChanceHit = (this.settings.symmetry > 0) && (this.rng.next() < this.settings.symmetry / 100)
      const enforceMirror = allowMirror && (symmetryChanceHit || this.settings.symmetryStrictPrimary)

      // Determine Sides based on Seed 1
      let sides: SeedSide[] = []
      const perps = PERPENDICULAR[spineTile.direction]

      // Resolve 'side' from config
      let targetSide: SeedSide = primaryConfig.side || 'any'
      
      if (targetSide === 'any' || targetSide === 'random') {
          const globalSide = this.settings.ejection.ejectionSide
          if (globalSide === 'both' || globalSide === 'left' || globalSide === 'right') {
              targetSide = globalSide
          } 
      }

      if (enforceMirror) {
         sides = ['left', 'right'] 
      } else {
           switch (targetSide) {
             case 'both':
               sides = ['left', 'right']
               break
             case 'left':
               sides = ['left']
               break
             case 'right':
               sides = ['right']
               break
             case 'random':
             case 'any':
             default:
               sides = [this.rng.next() < 0.5 ? 'left' : 'right']
               break
           }
      }

      // Pre-resolve Symmetry Values
      let sharedDist: number | undefined
      let sharedW: number | undefined
      let sharedH: number | undefined
      
      let sharedSecOffset: number | undefined
      let sharedSecW: number | undefined
      let sharedSecH: number | undefined
      
      if (enforceMirror) {
          sharedDist = this.resolveValue(primaryConfig.distance)
          sharedW = this.resolveValue(primaryConfig.width)
          sharedH = this.resolveValue(primaryConfig.height)
          
          if (this.settings.symmetryStrictSecondary) {
               const { minDistance, maxDistance } = this.settings.ejection
               sharedSecOffset = this.rng.nextInt(minDistance, maxDistance)
               sharedSecW = this.resolveValue(primaryConfig.width)
               sharedSecH = this.resolveValue(primaryConfig.height)
          }
      }

      // Create Seeds
      const createdSeeds: RoomSeed[] = []
      const secondarySeeds: RoomSeed[] = []

      // Store the secondary config from the first side for potential mirroring
      let firstSecondaryConfig: ManualSeedConfig | null = null;

      for (let i = 0; i < sides.length; i++) {
        const side = sides[i]
        
        if (this.state.roomSeeds.length >= seedCount) break
  
        // Direction Map
        const dir = side === 'left' ? perps[0] : perps[1]
        
        // Determine Config for this side
        let currentConfig: ManualSeedConfig
        let currentIsManual: boolean

        if (i === 0) {
            // First side uses the seed we already shifted (Seed 1)
            currentConfig = primaryConfig
            currentIsManual = isManual
        } else {
            // Second side (e.g. Right when Both)
            if (enforceMirror) {
                // MIRROR: Reuse Seed 1 (Cloned effectively by creating new RoomSeed from same config)
                // This means we DO NOT consume Seed 2 from queue.
                currentConfig = primaryConfig
                currentIsManual = isManual
            } else {
                // NOT MIRROR: Consume next seed from queue! (Seed 2)
                const next = getNextSeed()
                currentConfig = next.config
                currentIsManual = next.isManual
            }
        }

        // Resolve extra seeds from generic Trellis ejection phase
        // WE DO NOT HARD CODE ANY TRELLISES. EVER.
        const trellisContext: TrellisContext = { rng: this.rng, state: this.state }
        const extraConfigs: ManualSeedConfig[] = []
        
        if (currentConfig.trellis) {
            for (const t of currentConfig.trellis) {
                const parsed = TrellisManager.getInstance().parseTrellisString(t)
                if (parsed) {
                    const trellisItem = TrellisManager.getInstance().getTrellis(parsed.id)
                    if (trellisItem && trellisItem.phases.includes('ejection')) {
                        const results = trellisItem.execute('ejection', trellisContext, currentConfig, parsed.args)
                        if (Array.isArray(results)) {
                            extraConfigs.push(...results)
                        }
                    }
                }
            }
        }

        // Determine Cluster ID if we have extra burst seeds
        const clusterId = extraConfigs.length > 0 ? (currentConfig.id || `cluster_${this.state.roomSeeds.length}`) : undefined
        
        // Final list of seeds to spawn for this ejection step
        const allBurstConfigs = [
            { config: currentConfig, burstIndex: 0, burstSpacing: 0 },
            ...extraConfigs.map(c => ({
                config: c,
                burstIndex: (c as any)._burstIndex || 0,
                burstSpacing: (c as any)._burstSpacing || 0
            }))
        ]

        for (const burstEntry of allBurstConfigs) {
            const { config, burstIndex, burstSpacing } = burstEntry
            
            // Limit check: Only the first seed of a cluster (or non-clustered seeds) counts against limit
            const isClusterMember = clusterId !== undefined && burstIndex > 0
            if (!isClusterMember && this.state.roomSeeds.length >= seedCount) break

            // Find spine tile for this burst index
            const spineIndex = (this.state.ejectionIndex - 1) + (burstIndex * burstSpacing)
            if (spineIndex >= this.state.spineTiles.length) break
            
            const burstTile = this.state.spineTiles[spineIndex]

            // Resolve Dimensions for this specific seed
            let dist: number
            let w: number
            let h: number

            if (config === primaryConfig && enforceMirror) {
                 dist = sharedDist ?? this.resolveValue(config.distance)
                 w = sharedW ?? this.resolveValue(config.width)
                 h = sharedH ?? this.resolveValue(config.height)
            } else {
                 dist = this.resolveValue(config.distance)
                 w = this.resolveValue(config.width)
                 h = this.resolveValue(config.height)
            }
            
            const seed = this.createRoomSeedFromConfig(burstTile, dir, config, 'primary', dist, w, h)
            
            if (seed) {
                seed.clusterId = clusterId
                createdSeeds.push(seed)
                
                // 2. Secondary Seed (Paired)
                // Paired ejection only applies to the lead burst seed (index 0)
                if (burstIndex === 0 && this.settings.ejection.pairedEjection && this.state.roomSeeds.length < seedCount) {
                    let secConfig: ManualSeedConfig;
                    const hasStrictSecSymmetry = this.settings.symmetryStrictSecondary && firstSecondaryConfig;

                    if (i > 0 && enforceMirror && hasStrictSecSymmetry) {
                        secConfig = firstSecondaryConfig!;
                    } else {
                        const nextSec = getNextSeed();
                        secConfig = nextSec.config;
                    }
                    
                    const { minDistance, maxDistance } = this.settings.ejection
                    const offset = sharedSecOffset ?? this.rng.nextInt(minDistance, maxDistance)
                    const secDist = dist + offset
                    
                    let secW = this.resolveValue(secConfig.width)
                    let secH = this.resolveValue(secConfig.height)
                    
                    if (enforceMirror && this.settings.symmetryStrictSecondary) {
                        secW = sharedSecW ?? this.resolveValue(secConfig.width);
                        secH = sharedSecH ?? this.resolveValue(secConfig.height);
                    }

                    const s2 = this.createRoomSeedFromConfig(burstTile, dir, secConfig, 'secondary', secDist, secW, secH)
                    if (s2) {
                        s2.clusterId = clusterId // Mirror also shares cluster ID
                        secondarySeeds.push(s2)
                        createdSeeds.push(s2)
                        
                        if (i === 0) {
                            firstSecondaryConfig = secConfig
                        }
                    }
                }
            }
        }

      }
      
      // Link partners if symmetric pair created
      if (enforceMirror) {
          if (createdSeeds.length === 2) {
              createdSeeds[0].partnerId = createdSeeds[1].id
              createdSeeds[1].partnerId = createdSeeds[0].id
          }
           if (secondarySeeds.length === 2) {
              secondarySeeds[0].partnerId = secondarySeeds[1].id
              secondarySeeds[1].partnerId = secondarySeeds[0].id
          }
      }
  }

  // Removed generateRandomConfig -> moved to ManualSeedSystem.createVirtualConfig

  private resolveValue(val: RangeOrNumber | undefined): number {
      if (val === undefined) return 1
      if (typeof val === 'number') return val
      return this.rng.nextInt(val.min, val.max)
  }

  private createRoomSeedFromConfig(
    spineTile: SpineTile,
    direction: Direction,
    config: ManualSeedConfig,
    generation: 'primary' | 'secondary',
    distanceOverride?: number,
    widthOverride?: number,
    heightOverride?: number
  ): RoomSeed | null {
    
    // Resolve Dimensions
    const targetWidth = widthOverride !== undefined ? widthOverride : this.resolveValue(config.width)
    const targetHeight = heightOverride !== undefined ? heightOverride : this.resolveValue(config.height)
    const distance = distanceOverride !== undefined ? distanceOverride : this.resolveValue(config.distance)
    
    const pos: GridCoord = {
      x: spineTile.x + DIRECTIONS[direction].x * distance,
      y: spineTile.y + DIRECTIONS[direction].y * distance
    }

    // Check if position is valid
    if (!this.inBounds(pos.x, pos.y)) return null

    // Check if landing on existing room or spine
    const tile = this.state.grid[pos.y][pos.x]
    
    // Start overlap check
    const isOccupied = tile.state !== 'empty'
    const allowOverlap = tile.isCorridor && !this.settings.spine.spineActsAsWall

    // Dud check
    const isDud = (isOccupied && !allowOverlap) || (this.rng.next() < this.settings.ejection.dudChance)
    
    // Wall Seed check
    const isWallSeed = config.type === 'wall'

    const roomSeed: RoomSeed = {
      id: config.id || `${config.type || 'seed'}-${this.state.roomSeeds.length}`,
      position: pos,
      sourceSpineTile: { x: spineTile.x, y: spineTile.y },
      ejectionDirection: direction,
      targetWidth,
      targetHeight,
      isWallSeed,
      isDead: isDud,
      currentBounds: { x: pos.x, y: pos.y, w: 1, h: 1 },
      tiles: isDud ? [] : [pos],
      birthOrder: this.state.roomSeeds.length,
      isComplete: isDud,
      generation,
      
      // Metadata (Locked Scope v1)
      configSource: config,
      tags: config.tags,
      trellis: config.trellis,
      content: config.metadata
    }

    // Apply Trellises: ejection phase
    const context: TrellisContext = { state: this.state, rng: this.rng }
    TrellisManager.getInstance().processPhase('ejection', context, roomSeed)

    this.state.roomSeeds.push(roomSeed)

    // If not dead, mark initial tile
    if (!isDud) {
      tile.state = 'floor'
      tile.regionId = this.state.roomSeeds.length // Use seed index as region ID
      tile.growthOrder = this.state.tilesGrown++
    }
    
    return roomSeed
  }

  private createRoomSeed(
    spineTile: SpineTile,
    direction: Direction,
    distance: number,
    opts: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number; dudChance: number; wallSeedChance: number },
    generation: 'primary' | 'secondary' = 'primary'
  ): RoomSeed | null {
    const pos: GridCoord = {
      x: spineTile.x + DIRECTIONS[direction].x * distance,
      y: spineTile.y + DIRECTIONS[direction].y * distance
    }

    // Check if position is valid
    if (!this.inBounds(pos.x, pos.y)) return null

    // Check if landing on existing room or spine
    const tile = this.state.grid[pos.y][pos.x]
    
    // Start overlap check
    const isOccupied = tile.state !== 'empty'
    // If tile is a corridor (spine) and spineActsAsWall is false, effectively treat as empty (not dead)
    const allowOverlap = tile.isCorridor && !this.settings.spine.spineActsAsWall

    const isDead = (isOccupied && !allowOverlap) || this.rng.next() < opts.dudChance

    // Determine if wall seed
    const isWallSeed = this.rng.next() < opts.wallSeedChance

    // Random target dimensions
    const targetWidth = this.rng.nextInt(opts.minWidth, opts.maxWidth)
    const targetHeight = this.rng.nextInt(opts.minHeight, opts.maxHeight)

    const roomSeed: RoomSeed = {
      id: `room_${this.state.roomSeeds.length}`,
      position: pos,
      sourceSpineTile: { x: spineTile.x, y: spineTile.y },
      ejectionDirection: direction,
      targetWidth,
      targetHeight,
      isWallSeed,
      isDead,
      currentBounds: { x: pos.x, y: pos.y, w: 1, h: 1 },
      tiles: isDead ? [] : [pos],
      birthOrder: this.state.roomSeeds.length,
      isComplete: isDead,
      generation
    }

    this.state.roomSeeds.push(roomSeed)

    // If not dead, mark initial tile
    if (!isDead) {
      tile.state = 'floor'
      tile.regionId = this.state.roomSeeds.length // Use seed index as region ID
      tile.growthOrder = this.state.tilesGrown++
      // No frontier needed for rectangular growth
    }
    
    return roomSeed
  }

  // ===========================================================================
  // Phase 3: Room Growth
  // ===========================================================================

  private stepRoomGrowth(): boolean {
    if (this.state.roomGrowthComplete) {
      this.state.phase = 'walls'
      return false
    }

    // Check budget
    if (this.state.tilesGrown >= this.settings.tileBudget) {
      this.state.roomGrowthComplete = true
      
      // Run Classification Phase
      const context: TrellisContext = { state: this.state, rng: this.rng }
      TrellisManager.getInstance().processGlobalPhase('classification', context)
      
      this.state.phase = 'walls'
      return false
    }

    // Find rooms that can still grow
    const activeSeeds = this.state.roomSeeds.filter(s => !s.isComplete && !s.isDead)
    
    if (activeSeeds.length === 0) {
      this.state.roomGrowthComplete = true

      // Run Classification Phase
      const context: TrellisContext = { state: this.state, rng: this.rng }
      TrellisManager.getInstance().processGlobalPhase('classification', context)

      this.state.phase = 'walls'
      return false
    }

    // Pick a random active seed to grow
    const seed = activeSeeds[this.rng.nextInt(0, activeSeeds.length - 1)]

    // Strict Symmetry Logic
    // Determine strictness based on generation type
    const isStrict = seed.generation === 'secondary' 
        ? this.settings.symmetryStrictSecondary 
        : this.settings.symmetryStrictPrimary

    if (isStrict && seed.partnerId) {
        const partner = this.state.roomSeeds.find(s => s.id === seed.partnerId)
        
        // If partner is alive (not a dud), we enforce lockstep
        if (partner && !partner.isDead) {
            // If partner is already complete, strict symmetry means we must stop too
            if (partner.isComplete) {
                seed.isComplete = true
                return false
            }
            
            // Try to grow both in sync
            const grew = this.growLinkedRooms(seed, partner)
            if (grew) this.state.stepCount++
            return grew
        }
        // If partner is dead/dud, we allow solo growth (Dud% is individual)
    }

    const grew = this.growRoom(seed)

    if (grew) {
      this.state.stepCount++
    }

    return grew
  }

  private growLinkedRooms(seedA: RoomSeed, seedB: RoomSeed): boolean {
    const candidatesA = this.getGrowthCandidates(seedA)

    if (candidatesA.length === 0) {
        seedA.isComplete = true
        seedB.isComplete = true // Strict: if one stops, both stop
        return false
    }

    // Find candidates valid for BOTH in mirrored directions
    const validMoves: { dirA: Direction, dirB: Direction }[] = []

    for (const dirA of candidatesA) {
        const dirB = this.getMirroredDirection(dirA, seedA.ejectionDirection, seedB.ejectionDirection)
        
        // Check if B can expand in mirrored direction
        // We manually check expand logic for B here
        if (this.canExpandRoom(seedB, dirB)) {
            validMoves.push({ dirA, dirB })
        }
    }

    if (validMoves.length === 0) {
        // No synchronized moves possible
        seedA.isComplete = true
        seedB.isComplete = true
        return false
    }

    // Pick random synchronized move
    const move = validMoves[this.rng.nextInt(0, validMoves.length - 1)]
    
    this.expandRoom(seedA, move.dirA)
    this.expandRoom(seedB, move.dirB)

    return true
  }

  private growRoom(seed: RoomSeed): boolean {
    const candidates = this.getGrowthCandidates(seed)

    if (candidates.length === 0) {
      seed.isComplete = true
      return false
    }

    // Pick random direction
    const dir = candidates[this.rng.nextInt(0, candidates.length - 1)]

    // Execute expansion
    this.expandRoom(seed, dir)

    return true
  }

  private getGrowthCandidates(seed: RoomSeed): Direction[] {
    const candidates: Direction[] = []
    for (const d of ['north', 'south', 'east', 'west'] as Direction[]) {
        if (this.canExpandRoom(seed, d)) {
            candidates.push(d)
        }
    }
    return candidates
  }

  private canExpandRoom(seed: RoomSeed, dir: Direction): boolean {
    const { x, y, w, h } = seed.currentBounds
    const { targetWidth, targetHeight } = seed

    switch (dir) {
        case 'north': return h < targetHeight && this.canExpand(seed, x, y - 1, w, 1)
        case 'south': return h < targetHeight && this.canExpand(seed, x, y + h, w, 1)
        case 'west':  return w < targetWidth && this.canExpand(seed, x - 1, y, 1, h)
        case 'east':  return w < targetWidth && this.canExpand(seed, x + w, y, 1, h)
    }
    return false
  }

  private getMirroredDirection(dir: Direction, axisA: Direction, axisB: Direction): Direction {
      if (dir === axisA) return axisB
      if (dir === OPPOSITE[axisA]) return OPPOSITE[axisB]
      return dir
  }

  private canExpand(seed: RoomSeed, startX: number, startY: number, width: number, height: number): boolean {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = startX + dx
        const py = startY + dy

        // Basic checks
        if (!this.inBounds(px, py)) return false
        
        // Must be empty (or valid spine overlap)
        const tile = this.state.grid[py][px]
        if (tile.state !== 'empty') {
          // Check if we can overwrite spine
          if (tile.regionId === -1 && !this.settings.spine.spineActsAsWall) {
            // Allowed
          } else {
            return false
          }
        }

        // Buffer check: Ensure we don't touch another room (spine is OK)
        // Check all 8 neighbors (including diagonals) to prevent corner touching
        const neighbors = [
          { x: px + 1, y: py },     // East
          { x: px - 1, y: py },     // West
          { x: px, y: py + 1 },     // South
          { x: px, y: py - 1 },     // North
          { x: px + 1, y: py + 1 }, // SE
          { x: px + 1, y: py - 1 }, // NE
          { x: px - 1, y: py + 1 }, // SW
          { x: px - 1, y: py - 1 }  // NW
        ]

        for (const n of neighbors) {
          if (this.inBounds(n.x, n.y)) {
            const neighbor = this.state.grid[n.y][n.x]
            if (neighbor.state === 'floor') {
              // Allowed to touch:
              // 1. My own room (regionId === seed.birthOrder + 1)
              // 2. The spine (regionId === -1)
              if (neighbor.regionId !== -1 && neighbor.regionId !== (seed.birthOrder + 1)) {
                return false // Too close to another room
              }
            }
          }
        }
      }
    }
    return true
  }

  private expandRoom(seed: RoomSeed, dir: Direction): void {
    const { x, y, w, h } = seed.currentBounds
    let startX = x, startY = y, width = w, height = h

    // Calculate expansion area
    switch (dir) {
      case 'north':
        startY = y - 1; height = 1; width = w;
        seed.currentBounds.y--; seed.currentBounds.h++;
        break
      case 'south':
        startY = y + h; height = 1; width = w;
        seed.currentBounds.h++;
        break
      case 'west':
        startX = x - 1; width = 1; height = h;
        seed.currentBounds.x--; seed.currentBounds.w++;
        break
      case 'east':
        startX = x + w; width = 1; height = h;
        seed.currentBounds.w++;
        break
    }

    // Fill tiles
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = startX + dx
        const py = startY + dy
        
        const tile = this.state.grid[py][px]
        tile.state = 'floor'
        tile.regionId = seed.birthOrder + 1
        tile.growthOrder = this.state.tilesGrown++
        
        seed.tiles.push({ x: px, y: py })
      }
    }
  }

  // Deprecated / Unused methods removed
  private getRoomGrowthCandidates(seed: RoomSeed, frontier: Set<number>): GridCoord[] { return [] }
  private updateRoomFrontier(frontier: Set<number>, pos: GridCoord, seed: RoomSeed): void {}
  private checkRoomCollision(seed: RoomSeed, pos: GridCoord): void {}

  // ===========================================================================
  // Phase 4: Wall Generation
  // ===========================================================================

  private stepWalls(): boolean {
    // For now, walls are implicit (empty tiles adjacent to floor)
    // This phase could be expanded for explicit wall tile placement
    this.state.isComplete = true
    this.state.spineComplete = true // Required for GameWindow detection
    this.state.phase = 'complete'
    
    return false
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.settings.gridWidth && y >= 0 && y < this.settings.gridHeight
  }

  private tileIndex(pos: GridCoord): number {
    return pos.y * this.settings.gridWidth + pos.x
  }

  private indexToCoord(idx: number): GridCoord {
    return {
      x: idx % this.settings.gridWidth,
      y: Math.floor(idx / this.settings.gridWidth)
    }
  }
}
