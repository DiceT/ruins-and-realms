
import { SpineSeedSettings } from '../types'
import { ManualSeedConfig } from '../SeedDefinitions'
import { expandRepeats, createVirtualConfig } from '../ManualSeedSystem'
import { SeededRNG } from '../../../utils/SeededRNG'
import { TrellisManager } from '../TrellisManager'
import { TrellisContext } from '../trellises/ITrellis'

export class PouchBuilder {
  /**
   * Builds a complete list of seeds (the "Pouch") to be consumed by the generator.
   * Handles manual queue expansion, trellis construction (bursts), and virtual seed filling.
   * 
   * NOTE: 'seedCount' in settings controls the number of PRIMARY ejection events.
   * Burst/Cluster seeds do NOT count against this limit, allowing precise control over path length
   * versus local density.
   */
  public static build(settings: SpineSeedSettings, rng: SeededRNG): ManualSeedConfig[] {
    const rawPouch: ManualSeedConfig[] = []
    
    // 1. Prepare Manual Queue
    const manualQueue = expandRepeats(settings.manualSeedQueue || [])
    let manualIndex = 0
    
    let logicalCount = 0
    const targetCount = settings.seedCount

    const context: TrellisContext = { rng }

    // 2. Build Pouch (Iterative Process)
    // Process Seed -> Trellis -> Add to Pouch
    while (logicalCount < targetCount) {
      let candidate: ManualSeedConfig

      if (manualIndex < manualQueue.length) {
        candidate = manualQueue[manualIndex]
        manualIndex++
      } else {
        candidate = createVirtualConfig(settings, rng)
      }
      
      // Process through TrellisManager (Construction/Ejection Logic)
      // This might expand the seed into a burst (array)
      const processedSeeds = TrellisManager.getInstance().processSeed(candidate, context)
      
      // Add all resulting seeds to the pouch
      // Note: Only the *lead* seed counts against the "spine slot" budget (logicalCount)
      // But we just add them all here.
      rawPouch.push(...processedSeeds)
      
      logicalCount++
    }
    
    // 3. Finalize
    const finalPouch = rawPouch

    console.groupCollapsed(`[PouchBuilder] Generated Pouch (${finalPouch.length} seeds)`)
    finalPouch.forEach((s, i) => {
        const shape = s.type === 'wall' ? 'Wall' : 'Room'
        const burstInfo = (s as any)._burstIndex !== undefined ? `[Burst ${(s as any)._burstIndex}] ` : ''
        console.log(`${i}: ${burstInfo}${shape} (${s.id || 'virtual'}) ${s.trellis ? `Trellis: ${s.trellis.join(', ')}` : ''}`)
    })
    console.groupEnd()

    return finalPouch
  }
}
