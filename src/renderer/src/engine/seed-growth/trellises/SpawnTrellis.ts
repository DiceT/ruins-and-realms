/**
 * # Spawn Trellis (#spawn)
 * 
 * DESCRIPTION:
 * This trellis handles "Burst Ejection." It allows a single logical seed configuration 
 * to expand into multiple physical seeds (a cluster) along the spine. It is the primary 
 * mechanism for creating corridors of rooms or complex environmental features from a 
 * single manual seed entry.
 * 
 * SEED-ENGINE TERMINOLOGY:
 * - Phase [EJECTION]: Executes during the pouch-expansion stage or initial ejection to resolve "extra" configs.
 * - Burst: The group of rooms created from this single trellis call.
 * - Spacing: The fixed tiles between each member of the burst along the spine.
 */

import { ITrellis, TrellisPhase, TrellisContext } from './ITrellis'
import { RoomSeed, Room, ManualSeedConfig } from '../types'

export class SpawnTrellis implements ITrellis {
  id = 'spawn'
  phases: TrellisPhase[] = ['ejection']

  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room | ManualSeedConfig, args?: any[]): any {
    if (phase === 'ejection') {
      const config = subject as ManualSeedConfig
      if (!config || !args || args.length === 0) return
      
      const { rng } = context
      
      // #spawn(range, spacing)
      // args[0] is range (e.g. {min: 2, max: 8} or 5)
      // args[1] is spacing (default 1)
      
      const burstCountTarget = this.resolveValue(args[0], rng);
      const burstCount = Math.max(1, burstCountTarget);
      const burstSpacing = (args[1] !== undefined) ? this.resolveValue(args[1], rng) : 1;
      
      const results: ManualSeedConfig[] = [];
      
      // We return N-1 "extra" seeds to be ejected at intervals.
      // The generator will handle the actual spine indexing.
      for (let i = 1; i < burstCount; i++) {
        const clone = { ...config };
        // We'll mark these with metadata so the generator knows they are part of a burst
        // and which offset/spacing to apply from the lead spine tile.
        (clone as any)._burstIndex = i;
        (clone as any)._burstSpacing = burstSpacing;
        
        // Strip the #spawn tag from clones to prevent infinite recursion
        if (clone.trellis) {
            clone.trellis = clone.trellis.filter(t => !t.startsWith('#spawn'))
        }
        results.push(clone)
      }
      
      return results
    }
  }

  private resolveValue(val: any, rng: any): number {
      if (val === undefined) return 1
      if (typeof val === 'number') return val
      if (typeof val === 'object' && val.min !== undefined && val.max !== undefined) {
          return rng.nextInt(val.min, val.max)
      }
      return 1
  }
}
