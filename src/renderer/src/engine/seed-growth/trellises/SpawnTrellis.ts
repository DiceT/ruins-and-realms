/**
 * # Spawn Trellis (#spawn)
 * 
 * DESCRIPTION:
 * This trellis handles "Burst Ejection." It allows a single logical seed configuration 
 * to expand into multiple physical seeds (a cluster). Seeds are placed at the SAME spine 
 * tile but pushed progressively further from the spine (perpendicular row).
 * 
 * SEED-ENGINE TERMINOLOGY:
 * - Phase [EJECTION]: Executes during the pouch-expansion stage to create extra configs.
 * - Cluster: The group of rooms created from this single trellis call.
 * - Distance Increment: How much further from spine each subsequent seed is pushed.
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
      
      // #spawn(count, distanceIncrement)
      // args[0] is cluster count (Total seeds including original)
      // args[1] is distance increment per step (seeds pushed further from spine)
      
      const clusterCountTarget = this.resolveValue(args[0], rng)
      const clusterCount = Math.max(1, clusterCountTarget)
      
      // Distance increment: how much further from spine each subsequent seed is pushed
      const distInc = (args[1] !== undefined) ? this.resolveValue(args[1], rng) : 0
      
      const results: ManualSeedConfig[] = []
      
      // Generate a shared cluster ID for all seeds
      const clusterId = config.id || `cluster_${rng.next().toString(36).substr(2, 9)}`
      
      // Mark original seed with cluster ID
      config.clusterId = clusterId
      
      // ID Formatting Helper
      const getLetter = (idx: number) => String.fromCharCode(97 + (idx % 26)) // a,b,c...
      const baseId = config.pouchId ? config.pouchId.toString() : clusterId
      const sideSuffix = config.side ? `_${config.side.charAt(0).toUpperCase()}` : ''
      
      // Update Master Seed ID (Index 0 -> 'a')
      // e.g. "4a_L"
      config.id = `${baseId}a${sideSuffix}`
      
      // Strip #spawn from original to prevent re-processing
      if (config.trellis) {
        config.trellis = config.trellis.filter(t => !t.startsWith('#spawn'))
      }
      
      // Create N-1 "extra" seeds (clones pushed further from spine)
      for (let i = 1; i < clusterCount; i++) {
        const seedReplica = { ...config }
        
        // Same spine tile (no spacing along spine)
        seedReplica.interval = { min: 0, max: 0 }
        
        // Shared identity
        seedReplica.clusterId = clusterId
        seedReplica.id = `${baseId}${getLetter(i)}${sideSuffix}`
        
        // Spawn children should NOT duplicate via symmetry/paired
        // They already have their position defined by the cluster
        ;(seedReplica as any)._symmetryActive = false
        ;(seedReplica as any)._paired = false
        // Inherit side from original but don't double it
        // If original was 'both', clones should stay on same side as original
        if (seedReplica.side === 'both') {
          // Keep 'both' - the Spine will place on both sides but not re-duplicate
          // Actually, spawn children should just inherit the resolved side
        }
        
        // Increment Distance (push further from spine)
        if (typeof seedReplica.distance === 'object') {
            seedReplica.distance = {
                min: seedReplica.distance.min + (distInc * i),
                max: seedReplica.distance.max + (distInc * i)
            }
        } else if (typeof seedReplica.distance === 'number') {
            seedReplica.distance = seedReplica.distance + (distInc * i)
        } else {
             // undefined, default is 1
             seedReplica.distance = 1 + (distInc * i)
        }
        
        // Trellis already stripped from config clone
        results.push(seedReplica)
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
