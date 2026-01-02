/**
 * # Tiny Titan Trellis (#tinytitan)
 * 
 * DESCRIPTION:
 * Creates "Minimum Viable Rooms." It forces a seed's target dimensions to 1x1 
 * and applies an immunity flag to ensure the room is never pruned by the generator's 
 * cleanup pass. Perfect for essential 1-tile markers like stairs or key altars.
 * 
 * SEED-ENGINE TERMINOLOGY:
 * - Phase [EJECTION]: Forces the room size to its minimum bound (1x1) before growth begins.
 * - Phase [CLASSIFICATION]: Re-applies metadata to ensure the room is recognized as essential.
 * - Immune to Pruning: A metadata flag (`immuneToPruning`) that tells the engine's classifier to ignore this room during "dead-end" or "under-size" removal.
 */

import { ITrellis, TrellisPhase, TrellisContext } from './ITrellis'
import { RoomSeed, Room } from '../types'

export class TinyTitanTrellis implements ITrellis {
  id = 'tinytitan'
  phases: TrellisPhase[] = ['classification', 'ejection']

  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room, args?: any[]): void {
    const seed = subject as RoomSeed
    if (!seed) return

    if (phase === 'ejection') {
      // Force dimensions to 1x1 so it barely grows (or stays as is)
      seed.targetWidth = 1
      seed.targetHeight = 1
      
      // Also ensure immunity flag is set early
      if (!seed.content) seed.content = {}
      seed.content['immuneToPruning'] = true
    }

    if (phase === 'classification') {
      if (!seed.content) seed.content = {}
      seed.content['immuneToPruning'] = true
    }
  }
}
