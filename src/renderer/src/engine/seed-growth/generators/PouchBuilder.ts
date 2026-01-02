
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
    const pouch: ManualSeedConfig[] = []
    
    // 1. Prepare Manual Queue
    // We expand repeats immediately so we have a flat list of manual intents
    const manualQueue = expandRepeats(settings.manualSeedQueue || [])
    let manualIndex = 0

    let logicalCount = 0
    const targetCount = settings.seedCount

    // Create a context for Trellis execution
    // Note: State is undefined here as we are pre-generation. 
    // Trellises used in 'construction' phase must be robust to missing state.
    const context: TrellisContext = { rng }

    while (logicalCount < targetCount) {
      // A. Get Next Candidate
      let candidate: ManualSeedConfig
      let isManual = false

      if (manualIndex < manualQueue.length) {
        candidate = manualQueue[manualIndex]
        manualIndex++
        isManual = true
      } else {
        candidate = createVirtualConfig(settings, rng)
        isManual = false
      }

      // B. Process Trellises (Construction Phase) (Actually Ejection phase used as Construction here?)
      // Wait, SpawnTrellis uses 'ejection' phase in user's restored file (Step 389).
      // But PouchBuilder is doing pre-generation.
      // We should probably invoke 'ejection' phase here to resolve bursts? 
      // Or should we define a new phase 'construction'?
      // User's restored file Step 389: `phases: TrellisPhase[] = ['ejection']`
      // So if we run 'ejection' phase here, it works.
      
      const burstMembers: ManualSeedConfig[] = []
      
      // Implicitly, the candidate itself is the first member
      // We clone it to ensure we don't mutate the original queue objects unexpectedly
      const leadSeed = { ...candidate }
      burstMembers.push(leadSeed)

      // Run 'ejection' phase trellises
      if (leadSeed.trellis) {
         for (const tString of leadSeed.trellis) {
             const parsed = TrellisManager.getInstance().parseTrellisString(tString)
             if (parsed) {
                 const trellis = TrellisManager.getInstance().getTrellis(parsed.id)
                 if (trellis && trellis.phases.includes('ejection')) {
                     const result = trellis.execute('ejection', context, leadSeed, parsed.args)
                     if (Array.isArray(result) && result.length > 0) {
                         // These are the "extra" seeds from the burst
                         // Note: SpawnTrellis returns ONLY the extras, not the original
                         burstMembers.push(...result)
                     }
                 }
             }
         }
      }

      // C. Add to Pouch
      // Only the Lead Seed increments the logical count (consuming a "spine slot")
      logicalCount++
      
      // If we have a burst (size > 1), we ensure they are grouped
      // The generator will handle placing them based on _burstSpacing metadata
      if (burstMembers.length > 0) {
          pouch.push(...burstMembers)
      }
    }

    console.groupCollapsed(`[PouchBuilder] Generated Pouch (${pouch.length} seeds)`)
    pouch.forEach((s, i) => {
        const shape = s.type === 'wall' ? 'Wall' : 'Room'
        const burstInfo = (s as any)._burstIndex !== undefined ? `[Burst ${(s as any)._burstIndex}] ` : ''
        console.log(`${i}: ${burstInfo}${shape} (${s.id || 'virtual'}) ${s.trellis ? `Trellis: ${s.trellis.join(', ')}` : ''}`)
    })
    console.groupEnd()

    return pouch
  }
}
