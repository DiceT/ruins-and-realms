import { RoomSeed, SpineSeedState, Room } from '../types'
import { SeededRNG } from '../../../utils/SeededRNG'

export type TrellisPhase = 
  | 'initialization'
  | 'spine'
  | 'ejection'
  | 'roomGrowth'
  | 'classification'
  | 'corridorAssembly'
  | 'decoration'
  | 'spinePruning'
  | 'rendering'
  | 'visibility'

export interface TrellisContext {
  state?: SpineSeedState // Optional because dungeon assembly might not have full state
  rng: SeededRNG
  heatMap?: Map<string, number>
  rooms?: Room[]
}

export interface ITrellis {
  /** Unique identifier for the trellis (e.g., 'spawn', 'cell') */
  id: string
  
  /** Phases this trellis interrupts */
  phases: TrellisPhase[]

  /** 
   * Main execution hook.
   * @param phase The current phase being executed
   * @param context Access to generator state and RNG
   * @param subject The specific seed OR room this trellis is attached to
   * @param args Parsed arguments from the tag string (e.g., #spawn(4,3) -> [4, 3])
   */
  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room, args?: any[]): void
}
