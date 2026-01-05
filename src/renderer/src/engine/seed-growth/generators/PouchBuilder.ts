
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
      const needsPaired = (settings.ejection.ejectionCount || 1) >= 2  // Legacy compat
      
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
    
    // 3. Return pouch
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
   * Expands a seed into physical seeds based on symmetry/ejectionCount settings.
   * Each physical seed counts toward the limit.
   * 
   * ejectionCount:
   * - 1 (Single): One seed per side
   * - 2 (Paired): Primary + Secondary per side
   * - 3 (Triplets): Primary + Secondary + Tertiary per side
   * 
   * When symmetry is active, L/R pairs are linked via symmetryPartnerId.
   */
  private static expandSeed(
    firstSeed: ManualSeedConfig, 
    settings: SpineSeedSettings, 
    rng: SeededRNG,
    needsSymmetry: boolean,
    needsPaired: boolean, // Legacy param, now uses ejectionCount
    currentCount: number,
    targetCount: number,
    queue: QueueAccessor
  ): ManualSeedConfig[] {
    const { ejection, roomGrowth } = settings
    const results: ManualSeedConfig[] = []
    
    // Get ejection count (1 = Single, 2 = Paired, 3 = Triplets)
    const ejectionCount = ejection.ejectionCount || 1
    
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
    
    // Generate unique IDs for linking symmetric pairs
    const primaryPairId = needsSymmetry ? `sym_pri_${rng.nextInt(0, 999999)}` : undefined
    const secondaryPairId = needsSymmetry && ejectionCount >= 2 ? `sym_sec_${rng.nextInt(0, 999999)}` : undefined
    const tertiaryPairId = needsSymmetry && ejectionCount >= 3 ? `sym_ter_${rng.nextInt(0, 999999)}` : undefined
    
    // Pre-calculate shared values for symmetric seeds (identical distance, width, height)
    const sharedPrimary = needsSymmetry ? {
      dist: this.resolveRange(firstSeed.distance, ejection.minDistance, ejection.maxDistance, rng),
      width: this.resolveRange(firstSeed.width, roomGrowth.minWidth, roomGrowth.maxWidth, rng),
      height: this.resolveRange(firstSeed.height, roomGrowth.minHeight, roomGrowth.maxHeight, rng),
      interval: this.resolveRange(firstSeed.interval, ejection.minInterval, ejection.maxInterval, rng)
    } : null
    
    const sharedSecondary = needsSymmetry && ejectionCount >= 2 ? {
      offset: rng.nextInt(ejection.minDistance, ejection.maxDistance),
      width: rng.nextInt(roomGrowth.minWidth, roomGrowth.maxWidth),
      height: rng.nextInt(roomGrowth.minHeight, roomGrowth.maxHeight)
    } : null
    
    const sharedTertiary = needsSymmetry && ejectionCount >= 3 ? {
      offset: rng.nextInt(ejection.minDistance, ejection.maxDistance),
      width: rng.nextInt(roomGrowth.minWidth, roomGrowth.maxWidth),
      height: rng.nextInt(roomGrowth.minHeight, roomGrowth.maxHeight)
    } : null

    for (const side of sides) {
      if (totalSeeds >= maxSeeds) break
      
      // Get seed for this position (first uses firstSeed, rest pull from queue)
      const seed = totalSeeds === 0 ? firstSeed : queue.next()
      totalSeeds++
      
      // Resolve values for PRIMARY (use shared if symmetric)
      const dist = sharedPrimary?.dist ?? this.resolveRange(seed.distance, ejection.minDistance, ejection.maxDistance, rng)
      const width = sharedPrimary?.width ?? this.resolveRange(seed.width, roomGrowth.minWidth, roomGrowth.maxWidth, rng)
      const height = sharedPrimary?.height ?? this.resolveRange(seed.height, roomGrowth.minHeight, roomGrowth.maxHeight, rng)
      const interval = sharedPrimary?.interval ?? this.resolveRange(seed.interval, ejection.minInterval, ejection.maxInterval, rng)
      
      // PRIMARY SEED
      const primaryId = `${seed.pouchId || 'seed'}_${side}_pri`
      const primary: ManualSeedConfig = {
        ...seed,
        id: primaryId,
        side: side,
        distance: { min: dist, max: dist },
        width: { min: width, max: width },
        height: { min: height, max: height },
        interval: { min: results.length === 0 ? interval : 0, max: results.length === 0 ? interval : 0 },
        symmetryPartnerId: primaryPairId
      }
      results.push(primary)
      
      // SECONDARY SEED (if ejectionCount >= 2 and we have room)
      if (ejectionCount >= 2 && totalSeeds < maxSeeds) {
        const secSeed = queue.next()
        totalSeeds++
        
        const secOffset = sharedSecondary?.offset ?? rng.nextInt(ejection.minDistance, ejection.maxDistance)
        const secDist = dist + secOffset
        const secWidth = sharedSecondary?.width ?? this.resolveRange(secSeed.width, roomGrowth.minWidth, roomGrowth.maxWidth, rng)
        const secHeight = sharedSecondary?.height ?? this.resolveRange(secSeed.height, roomGrowth.minHeight, roomGrowth.maxHeight, rng)
        
        const secondaryId = `${secSeed.pouchId || 'seed'}_${side}_sec`
        const secondary: ManualSeedConfig = {
          ...secSeed,
          id: secondaryId,
          side: side,
          distance: { min: secDist, max: secDist },
          width: { min: secWidth, max: secWidth },
          height: { min: secHeight, max: secHeight },
          interval: { min: 0, max: 0 },
          symmetryPartnerId: secondaryPairId
        }
        results.push(secondary)
      }
      
      // TERTIARY SEED (if ejectionCount >= 3 and we have room)
      if (ejectionCount >= 3 && totalSeeds < maxSeeds) {
        const terSeed = queue.next()
        totalSeeds++
        
        const secOffset = sharedSecondary?.offset ?? rng.nextInt(ejection.minDistance, ejection.maxDistance)
        const terOffset = sharedTertiary?.offset ?? rng.nextInt(ejection.minDistance, ejection.maxDistance)
        const terDist = dist + secOffset + terOffset
        const terWidth = sharedTertiary?.width ?? this.resolveRange(terSeed.width, roomGrowth.minWidth, roomGrowth.maxWidth, rng)
        const terHeight = sharedTertiary?.height ?? this.resolveRange(terSeed.height, roomGrowth.minHeight, roomGrowth.maxHeight, rng)
        
        const tertiaryId = `${terSeed.pouchId || 'seed'}_${side}_ter`
        const tertiary: ManualSeedConfig = {
          ...terSeed,
          id: tertiaryId,
          side: side,
          distance: { min: terDist, max: terDist },
          width: { min: terWidth, max: terWidth },
          height: { min: terHeight, max: terHeight },
          interval: { min: 0, max: 0 },
          symmetryPartnerId: tertiaryPairId
        }
        results.push(tertiary)
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
