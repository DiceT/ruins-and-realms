/**
 * Seed Growth Dungeon Generator
 * 
 * OPD-inspired frontier-based dungeon generation.
 * Territory grows outward from seeds; rooms/corridors emerge from growth patterns.
 */

import { SeededRNG } from '../../utils/SeededRNG'
import {
  SeedGrowthSettings,
  SeedGrowthState,
  GridTile,
  GridCoord,
  Seed,
  Region,
  Direction
} from './types'

// Direction vectors
const DIRECTIONS: { [key in Direction]: GridCoord } = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 }
}

const DIR_KEYS: Direction[] = ['north', 'south', 'east', 'west']

// Opposite directions for turn penalty calculation
const OPPOSITE: { [key in Direction]: Direction } = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
}

export class SeedGrowthGenerator {
  private settings: SeedGrowthSettings
  private rng: SeededRNG
  private state: SeedGrowthState

  constructor(settings: SeedGrowthSettings) {
    this.settings = { ...settings }
    this.rng = new SeededRNG(settings.seed)
    this.state = this.createInitialState()
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /** Reset generator with new settings. Optionally preserves the blocked mask. */
  public reset(settings: SeedGrowthSettings, preserveMask: boolean = false): void {
    const oldBlocked = preserveMask ? this.state?.blocked : null
    const oldMaskVersion = preserveMask ? this.state?.maskVersion : 0
    
    this.settings = { ...settings }
    this.rng = new SeededRNG(settings.seed)
    this.state = this.createInitialState()
    
    // Restore mask if requested and sizes match
    if (oldBlocked && oldBlocked.length === this.state.blocked.length) {
      this.state.blocked = oldBlocked
      this.state.maskVersion = oldMaskVersion ?? 0
    }
  }

  /** Get current state (for rendering) */
  public getState(): SeedGrowthState {
    return this.state
  }

  /** Get current settings */
  public getSettings(): SeedGrowthSettings {
    return this.settings
  }

  /** Execute a single growth step. Returns true if growth occurred. */
  public step(): boolean {
    if (this.state.isComplete) return false

    // Check budget
    if (this.state.tilesGrown >= this.settings.tileBudget) {
      this.state.isComplete = true
      this.state.completionReason = 'budget'
      return false
    }

    // Check if any frontier remains
    let totalFrontier = 0
    for (const region of this.state.regions.values()) {
      totalFrontier += region.frontier.size
    }
    if (totalFrontier === 0) {
      this.state.isComplete = true
      this.state.completionReason = 'exhausted'
      return false
    }

    // Growth step
    const grew = this.executeGrowthStep()
    if (grew) {
      this.state.stepCount++
    }

    return grew
  }

  /** Run until completion (budget or exhausted) */
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

  // ===========================================================================
  // Initialization
  // ===========================================================================

  private createInitialState(): SeedGrowthState {
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

    // Create empty blocked mask
    const blocked: boolean[][] = []
    for (let y = 0; y < gridHeight; y++) {
      blocked.push(new Array(gridWidth).fill(false))
    }

    const state: SeedGrowthState = {
      grid,
      blocked,
      maskVersion: 0,
      regions: new Map(),
      seeds: [],
      tilesGrown: 0,
      stepCount: 0,
      isComplete: false,
      completionReason: 'running',
      rooms: [],
      corridors: [],
      connections: [],
      objects: []
    }

    // Place seeds
    this.placeSeeds(state)

    return state
  }

  private placeSeeds(state: SeedGrowthState): void {
    const { gridWidth, gridHeight, seedCount, seedPlacement, minSeedDistance } = this.settings
    const positions: GridCoord[] = []

    if (seedPlacement === 'center') {
      // First seed at center, others scattered with min distance
      const centerX = Math.floor(gridWidth / 2)
      const centerY = Math.floor(gridHeight / 2)
      positions.push({ x: centerX, y: centerY })

      // Add remaining seeds with distance constraint
      for (let i = 1; i < seedCount; i++) {
        const pos = this.findValidSeedPosition(state, positions, minSeedDistance)
        if (pos) positions.push(pos)
      }
    } else if (seedPlacement === 'random') {
      // Random placement with min distance
      for (let i = 0; i < seedCount; i++) {
        const pos = this.findValidSeedPosition(state, positions, minSeedDistance)
        if (pos) positions.push(pos)
      }
    } else if (seedPlacement === 'symmetricPairs') {
      // Place pairs mirrored across symmetry axis
      const halfCount = Math.ceil(seedCount / 2)

      for (let i = 0; i < halfCount; i++) {
        const pos = this.findValidSeedPosition(state, positions, minSeedDistance, true)
        if (pos) {
          positions.push(pos)
          // Mirror position
          const mirrorPos = this.getMirrorPosition(pos)
          // Don't add if it's the same (on axis) or too close to existing
          if (!this.isSamePosition(pos, mirrorPos) && this.isValidSeedPosition(mirrorPos, positions, minSeedDistance, state.blocked)) {
            positions.push(mirrorPos)
          }
        }
      }
    }

    // Create seeds and regions from positions
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]
      const regionId = i + 1
      const seedId = `seed_${i}`

      // Create seed
      const seed: Seed = {
        id: seedId,
        position: pos,
        regionId
      }
      state.seeds.push(seed)

      // Create region
      const region: Region = {
        id: regionId,
        seedId,
        frontier: new Set(),
        size: 1,
        lastDir: null,
        priority: 1
      }
      state.regions.set(regionId, region)

      // Mark seed tile as floor
      const tile = state.grid[pos.y][pos.x]
      tile.state = 'floor'
      tile.regionId = regionId
      tile.growthOrder = state.tilesGrown++

      // Initialize frontier
      this.updateFrontier(state, region, pos)
    }
  }

  private findValidSeedPosition(
    state: SeedGrowthState,
    existing: GridCoord[],
    minDistance: number,
    preferOneSide: boolean = false
  ): GridCoord | null {
    const { gridWidth, gridHeight } = this.settings
    const margin = 5 // Keep seeds away from edges

    // Try up to 100 times to find valid position
    for (let attempt = 0; attempt < 100; attempt++) {
      let x: number
      let y: number

      if (preferOneSide && this.settings.symmetryAxis === 'vertical') {
        // Place on left half
        x = this.rng.nextInt(margin, Math.floor(gridWidth / 2) - 1)
        y = this.rng.nextInt(margin, gridHeight - margin - 1)
      } else if (preferOneSide && this.settings.symmetryAxis === 'horizontal') {
        // Place on top half
        x = this.rng.nextInt(margin, gridWidth - margin - 1)
        y = this.rng.nextInt(margin, Math.floor(gridHeight / 2) - 1)
      } else {
        x = this.rng.nextInt(margin, gridWidth - margin - 1)
        y = this.rng.nextInt(margin, gridHeight - margin - 1)
      }

      const pos = { x, y }
      if (this.isValidSeedPosition(pos, existing, minDistance, state.blocked)) {
        return pos
      }
    }

    return null
  }

  private isValidSeedPosition(pos: GridCoord, existing: GridCoord[], minDistance: number, blocked: boolean[][]): boolean {
    // Check if blocked
    if (blocked[pos.y]?.[pos.x]) return false
    
    for (const other of existing) {
      const dist = Math.abs(pos.x - other.x) + Math.abs(pos.y - other.y) // Manhattan distance
      if (dist < minDistance) return false
    }
    return true
  }

  private isSamePosition(a: GridCoord, b: GridCoord): boolean {
    return a.x === b.x && a.y === b.y
  }

  // ===========================================================================
  // Growth Algorithm
  // ===========================================================================

  private executeGrowthStep(): boolean {
    // Step 1: Select active region (weighted by frontier size)
    const region = this.selectActiveRegion()
    if (!region || region.frontier.size === 0) return false

    // Step 2: Select frontier tile via weighted random
    const candidate = this.selectFrontierTile(region)
    if (!candidate) return false

    // Step 3: Validate placement
    const { pos, dir: direction } = candidate
    if (!this.validatePlacement(pos, region)) {
      // Remove invalid tile from frontier
      region.frontier.delete(this.tileIndex(pos))
      return false
    }

    // Step 4: Handle symmetry
    let mirrorPos: GridCoord | null = null
    if (this.settings.symmetry > 0) {
      const mirrorChance = this.settings.symmetry / 100
      if (this.rng.next() <= mirrorChance) {
        mirrorPos = this.getMirrorPosition(pos)
        if (mirrorPos && !this.validatePlacement(mirrorPos, region)) {
          if (this.settings.symmetryStrict) {
            // Strict: reject both
            return false
          }
          mirrorPos = null // Relaxed: grow only primary
        }
      }
    }

    // Step 5: Grow!
    this.growTile(pos, region, direction)

    // Grow mirror if applicable
    if (mirrorPos) {
      // Mirror belongs to same region for now (could be different for variant behavior)
      const mirrorDir = this.getMirrorDirection(direction)
      this.growTile(mirrorPos, region, mirrorDir)
    }

    return true
  }

  private selectActiveRegion(): Region | null {
    const regions = Array.from(this.state.regions.values()).filter(r => r.frontier.size > 0)
    if (regions.length === 0) return null

    // Weighted by frontier size
    const totalWeight = regions.reduce((sum, r) => sum + r.frontier.size * r.priority, 0)
    let pick = this.rng.next() * totalWeight
    for (const r of regions) {
      pick -= r.frontier.size * r.priority
      if (pick <= 0) return r
    }
    return regions[regions.length - 1]
  }

  private selectFrontierTile(region: Region): { pos: GridCoord; dir: Direction } | null {
    const candidates: { pos: GridCoord; dir: Direction; weight: number }[] = []

    for (const idx of region.frontier) {
      const pos = this.indexToCoord(idx)
      
      // Determine which direction this tile came from
      const dir = this.getGrowthDirection(pos, region)

      // Calculate weight
      const weight = this.calculateFrontierWeight(pos, region, dir)
      if (weight > 0) {
        candidates.push({ pos, dir, weight })
      }
    }

    if (candidates.length === 0) return null

    // Weighted random selection
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0)
    let pick = this.rng.next() * totalWeight
    for (const c of candidates) {
      pick -= c.weight
      if (pick <= 0) return { pos: c.pos, dir: c.dir }
    }
    return candidates[candidates.length - 1]
  }

  private calculateFrontierWeight(pos: GridCoord, region: Region, dir: Direction): number {
    const { gamma, straightBias, turnPenalty, branchPenalty, neighborLimit } = this.settings

    // Count adjacent tiles in same region
    let adjacentCount = 0
    for (const d of DIR_KEYS) {
      const nx = pos.x + DIRECTIONS[d].x
      const ny = pos.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny)) {
        const neighbor = this.state.grid[ny][nx]
        if (neighbor.regionId === region.id) {
          adjacentCount++
        }
      }
    }

    // Base weight: pow(c, gamma)
    let weight = Math.pow(Math.max(adjacentCount, 0.1), gamma)

    // Straight bias: bonus if continuing same direction
    if (region.lastDir && dir === region.lastDir) {
      weight *= 1 + straightBias
    }

    // Turn penalty: if direction changes from last
    if (region.lastDir && dir !== region.lastDir && dir !== OPPOSITE[region.lastDir]) {
      weight *= Math.max(0.1, 1 - turnPenalty * 0.2)
    }

    // Branch penalty: if this would create multiple fronts (simplified)
    if (adjacentCount === 1 && region.size > 5) {
      weight *= Math.max(0.1, 1 - branchPenalty * 0.2)
    }

    // Neighbor limit check (hard or soft)
    const totalNeighbors = this.countNonEmptyNeighbors(pos)
    if (neighborLimit > 0 && totalNeighbors > neighborLimit) {
      if (!this.settings.allowLoops) {
        return 0 // Hard reject
      } else {
        weight *= this.settings.loopChance // Soft penalty
      }
    }

    return Math.max(weight, 0)
  }

  private getGrowthDirection(pos: GridCoord, region: Region): Direction {
    // Find which direction this tile is from existing region tiles
    for (const d of DIR_KEYS) {
      const nx = pos.x + DIRECTIONS[d].x
      const ny = pos.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny)) {
        const neighbor = this.state.grid[ny][nx]
        if (neighbor.regionId === region.id) {
          // This tile is in direction OPPOSITE from the neighbor
          return OPPOSITE[d]
        }
      }
    }
    return 'north' // Default
  }

  private countNonEmptyNeighbors(pos: GridCoord): number {
    let count = 0
    for (const d of DIR_KEYS) {
      const nx = pos.x + DIRECTIONS[d].x
      const ny = pos.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny)) {
        if (this.state.grid[ny][nx].state !== 'empty') {
          count++
        }
      }
    }
    return count
  }

  private validatePlacement(pos: GridCoord, region: Region): boolean {
    if (!this.inBounds(pos.x, pos.y)) return false
    // Check if blocked by mask
    if (this.state.blocked[pos.y]?.[pos.x]) return false
    const tile = this.state.grid[pos.y][pos.x]
    if (tile.state !== 'empty') return false
    
    // Collision corridors: prevent growth if this would place our tile adjacent to another region
    if (this.settings.collisionCorridors) {
      const neighbors = [
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y }
      ]
      for (const n of neighbors) {
        if (!this.inBounds(n.x, n.y)) continue
        const neighborTile = this.state.grid[n.y][n.x]
        // If neighbor belongs to a different region, block this placement
        if (neighborTile.state === 'floor' && neighborTile.regionId !== null && neighborTile.regionId !== region.id) {
          return false
        }
      }
    }
    
    return true
  }

  private growTile(pos: GridCoord, region: Region, direction: Direction): void {
    const tile = this.state.grid[pos.y][pos.x]
    tile.state = 'floor'
    tile.regionId = region.id
    tile.growthOrder = this.state.tilesGrown++

    region.size++
    region.lastDir = direction
    region.frontier.delete(this.tileIndex(pos))

    // Update frontier with new neighbors
    this.updateFrontier(this.state, region, pos)
  }

  private updateFrontier(state: SeedGrowthState, region: Region, pos: GridCoord): void {
    for (const d of DIR_KEYS) {
      const nx = pos.x + DIRECTIONS[d].x
      const ny = pos.y + DIRECTIONS[d].y
      if (this.inBounds(nx, ny)) {
        // Skip blocked cells - they can never be claimed
        if (state.blocked[ny]?.[nx]) continue
        const neighbor = state.grid[ny][nx]
        if (neighbor.state === 'empty') {
          region.frontier.add(this.tileIndex({ x: nx, y: ny }))
        }
      }
    }
  }

  // ===========================================================================
  // Symmetry Helpers
  // ===========================================================================

  private getMirrorPosition(pos: GridCoord): GridCoord {
    const { gridWidth, gridHeight, symmetryAxis } = this.settings
    if (symmetryAxis === 'vertical') {
      return { x: gridWidth - 1 - pos.x, y: pos.y }
    } else {
      return { x: pos.x, y: gridHeight - 1 - pos.y }
    }
  }

  private getMirrorDirection(dir: Direction): Direction {
    const { symmetryAxis } = this.settings
    if (symmetryAxis === 'vertical') {
      if (dir === 'east') return 'west'
      if (dir === 'west') return 'east'
    } else {
      if (dir === 'north') return 'south'
      if (dir === 'south') return 'north'
    }
    return dir
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
