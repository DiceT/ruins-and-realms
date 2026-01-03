
import { SpineSeedSettings } from '../types'
import { ManualSeedConfig, SeedSide } from '../SeedDefinitions'
import { expandRepeats, createVirtualConfig } from '../ManualSeedSystem'
import { SeededRNG } from '../../../utils/SeededRNG'
import { TrellisManager } from '../TrellisManager'
import { TrellisContext } from '../trellises/ITrellis'

/**
 * Queue accessor for pulling seeds during expansion.
 */
interface QueueAccessor {
  next(): ManualSeedConfig
  hasMore(): boolean
}

export class PouchBuilder {
  /**
   * Builds a complete list of seeds (the "Pouch") to be consumed by the generator.
   * 
   * seedCount is a LIMIT. Each seed/clone counts toward this limit.
   * - Side=Both: 2 seeds (left + right), counts as 2 toward limit
   * - Paired: 2 seeds (primary + secondary per side), counts as 2 per side
   * - Spawn(4): 4 seeds total, counts as 4 toward limit
   */
  public static build(settings: SpineSeedSettings, rng: SeededRNG): ManualSeedConfig[] {
    const rawPouch: ManualSeedConfig[] = []
    
    // 1. Prepare Manual Queue
    const manualQueue = expandRepeats(settings.manualSeedQueue || [])
    let manualIndex = 0
    let pouchIdCounter = 0 // Track distinct logical seed pulls
    
    const queueAccessor: QueueAccessor = {
      next: () => {
        let s: ManualSeedConfig
        if (manualIndex < manualQueue.length) {
          s = manualQueue[manualIndex++]
        } else {
          s = createVirtualConfig(settings, rng)
        }
        // Assign 1-based Pouch ID
        if (s.pouchId === undefined) {
             s.pouchId = ++pouchIdCounter
        }
        return s
      },
      hasMore: () => manualIndex < manualQueue.length
    }
    
    let seedCount = 0
    const targetCount = settings.seedCount

    const context: TrellisContext = { rng }

    // 2. Build Pouch until we hit the limit
    while (seedCount < targetCount) {
      // Get first seed for this ejection event
      const candidate = queueAccessor.next()
      seedCount++ // First seed counts
      
      // Calculate how many MORE seeds we need for this event
      const needsSymmetry = this.needsSymmetry(candidate, settings, rng)
      const needsPaired = settings.ejection.pairedEjection
      
      // Expand into physical seeds
      const expandedSeeds = this.expandSeed(candidate, settings, rng, needsSymmetry, needsPaired, seedCount, targetCount, queueAccessor)
      
      // Count additional seeds toward limit (first one already counted)
      seedCount += expandedSeeds.length - 1
      
      // Process each expanded seed through TrellisManager (for spawn, etc)
      for (const seed of expandedSeeds) {
        const processed = TrellisManager.getInstance().processSeed(seed, context)
        rawPouch.push(...processed)
      }
    }
    
    // 3. Log for debugging
    console.groupCollapsed(`[PouchBuilder] Generated Pouch (${rawPouch.length} physical, limit=${targetCount})`)
    rawPouch.forEach((s, i) => {
        const shape = s.type === 'wall' ? 'Wall' : 'Room'
        const cluster = s.clusterId ? `[${s.clusterId}] ` : ''
        const side = s.side || '?'
        const dist = typeof s.distance === 'object' ? s.distance.min : s.distance
        const interval = typeof s.interval === 'object' ? s.interval.min : s.interval
        console.log(`${i}: ${cluster}${shape} side:${side} dist:${dist} int:${interval} (${s.id || 'virtual'})`)
    })
    console.groupEnd()

    return rawPouch
  }

  /**
   * Check if this seed needs symmetry expansion.
   */
  private static needsSymmetry(seed: ManualSeedConfig, settings: SpineSeedSettings, rng: SeededRNG): boolean {
    const { ejection, symmetry } = settings
    let baseSide: SeedSide = seed.side || ejection.ejectionSide
    if (baseSide === 'any') baseSide = ejection.ejectionSide
    
    const symmetryActive = symmetry > 0 && rng.next() < symmetry / 100
    return symmetryActive || baseSide === 'both'
  }

  /**
   * Expands a seed into physical seeds based on symmetry/paired settings.
   * Each physical seed counts toward the limit.
   */
  private static expandSeed(
    firstSeed: ManualSeedConfig, 
    settings: SpineSeedSettings, 
    rng: SeededRNG,
    needsSymmetry: boolean,
    needsPaired: boolean,
    currentCount: number,
    targetCount: number,
    queue: QueueAccessor
  ): ManualSeedConfig[] {
    const { ejection, roomGrowth } = settings
    const results: ManualSeedConfig[] = []
    
    // Determine sides
    let baseSide: SeedSide = firstSeed.side || ejection.ejectionSide
    if (baseSide === 'any') baseSide = ejection.ejectionSide
    
    let sides: ('left' | 'right')[]
    if (needsSymmetry) {
      sides = ['left', 'right']
    } else if (baseSide === 'random') {
      sides = [rng.next() < 0.5 ? 'left' : 'right']
    } else {
      sides = [baseSide as 'left' | 'right']
    }
    
    let totalSeeds = 0
    const maxSeeds = targetCount - currentCount + 1 // +1 because first is already counted
    
    for (const side of sides) {
      if (totalSeeds >= maxSeeds) break
      
      // Get seed for this position (first uses firstSeed, rest pull from queue)
      const seed = totalSeeds === 0 ? firstSeed : queue.next()
      totalSeeds++
      
      // Resolve values
      const dist = this.resolveRange(seed.distance, ejection.minDistance, ejection.maxDistance, rng)
      const width = this.resolveRange(seed.width, roomGrowth.minWidth, roomGrowth.maxWidth, rng)
      const height = this.resolveRange(seed.height, roomGrowth.minHeight, roomGrowth.maxHeight, rng)
      const interval = this.resolveRange(seed.interval, ejection.minInterval, ejection.maxInterval, rng)
      
      // PRIMARY SEED
      const primary: ManualSeedConfig = {
        ...seed,
        side: side,
        distance: { min: dist, max: dist },
        width: { min: width, max: width },
        height: { min: height, max: height },
        // First seed gets normal interval, rest get 0 (same spine tile)
        interval: { min: results.length === 0 ? interval : 0, max: results.length === 0 ? interval : 0 }
      }
      results.push(primary)
      
      // SECONDARY SEED (if paired and we have room)
      if (needsPaired && totalSeeds < maxSeeds) {
        const secSeed = queue.next()
        totalSeeds++
        
        const pairedOffset = rng.nextInt(ejection.minDistance, ejection.maxDistance)
        const secDist = dist + pairedOffset
        const secWidth = this.resolveRange(secSeed.width, roomGrowth.minWidth, roomGrowth.maxWidth, rng)
        const secHeight = this.resolveRange(secSeed.height, roomGrowth.minHeight, roomGrowth.maxHeight, rng)
        
        const secondary: ManualSeedConfig = {
          ...secSeed,
          side: side,
          distance: { min: secDist, max: secDist },
          width: { min: secWidth, max: secWidth },
          height: { min: secHeight, max: secHeight },
          interval: { min: 0, max: 0 } // Same spine tile
        }
        results.push(secondary)
      }
    }
    
    return results
  }

  /**
   * Resolve a RangeOrNumber to a concrete number.
   */
  private static resolveRange(
    val: { min: number; max: number } | number | undefined,
    defaultMin: number,
    defaultMax: number,
    rng: SeededRNG
  ): number {
    if (val === undefined) {
      return rng.nextInt(defaultMin, defaultMax)
    }
    if (typeof val === 'number') {
      return val
    }
    return rng.nextInt(val.min, val.max)
  }
}
