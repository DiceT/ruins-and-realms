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
