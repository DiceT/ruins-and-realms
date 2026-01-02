/**
 * # Trellis System - Core Interface
 * 
 * DESCRIPTION:
 * The Trellis system is a "middleware" architecture for the Seed-Engine. It allows 
 * specific rooms or seeds to carry logic that "interrupts" the standard generation 
 * flow at various phases (Ejection, Growth, Pathfinding).
 * 
 * SEED-ENGINE TERMINOLOGY:
 * - Phase: A discrete step in the dungeon generation lifecycle.
 * - Context: The bundle of state (RNG, Grid, Heatmap) passed to a Trellis.
 * - Subject: The specific entity (Seed, Room, or Config) the Trellis is acting upon.
 * - Arguments: Parameters passed via the tag syntax in manual seeds (e.g. #name(arg1, arg2)).
 */

import { RoomSeed, SpineSeedState, Room, ManualSeedConfig } from '../types'
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
   * @returns Dynamic results based on phase (e.g. ManualSeedConfig[] for 'ejection')
   */
  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room | ManualSeedConfig, args?: any[]): any
}
