import { ITrellis, TrellisPhase, TrellisContext } from './trellises/ITrellis'
import { RoomSeed, SpineSeedState, Room } from './types'
import { SeededRNG } from '../../utils/SeededRNG'

import { CellTrellis } from './trellises/CellTrellis' 
import { SpawnTrellis } from './trellises/SpawnTrellis'
import { TinyTitanTrellis } from './trellises/TinyTitanTrellis'

export class TrellisManager {
  private static instance: TrellisManager
  private trellises: Map<string, ITrellis> = new Map()

  private constructor() {
    this.registerTrellis(new CellTrellis())
    this.registerTrellis(new SpawnTrellis())
    this.registerTrellis(new TinyTitanTrellis())
  }

  public static getInstance(): TrellisManager {
    if (!TrellisManager.instance) {
      TrellisManager.instance = new TrellisManager()
    }
    return TrellisManager.instance
  }

  public registerTrellis(trellis: ITrellis): void {
    if (this.trellises.has(trellis.id)) {
      console.warn(`TrellisManager: Overwriting existing trellis with id '${trellis.id}'`)
    }
    this.trellises.set(trellis.id, trellis)
  }

  public getTrellis(id: string): ITrellis | undefined {
    return this.trellises.get(id)
  }

  /**
   * Parse a raw trellis string into ID and arguments.
   * Example: "#spawn(4, 3)" -> { id: "spawn", args: [4, 3] }
   * Example: "#cell" -> { id: "cell", args: [] }
   */
  public parseTrellisString(raw: string): { id: string, args: any[] } | null {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('#')) return null

    // Regex to match #name or #name(arg1, arg2)
    const match = trimmed.match(/^#([a-zA-Z0-9_-]+)(?:\((.*)\))?$/)
    if (!match) return null

    const id = match[1]
    const argsStr = match[2]

    let args: any[] = []
    if (argsStr) {
      // Split by comma, trim, and adjust types
      args = argsStr.split(',').map(s => {
        const sTrim = s.trim()
        // Try parsing as number
        const num = parseFloat(sTrim)
        if (!isNaN(num)) return num
        // Try boolean
        if (sTrim === 'true') return true
        if (sTrim === 'false') return false
        // Return string (remove quotes if present)
        return sTrim.replace(/^["']|["']$/g, '')
      })
    }

    return { id, args }
  }

  /**
   * Process a specific phase for a single seed.
   */
  public processPhase(
    phase: TrellisPhase, 
    context: TrellisContext, 
    subject: RoomSeed | Room
  ): void {
    if (!subject.trellis || subject.trellis.length === 0) return

    for (const tString of subject.trellis) {
      const parsed = this.parseTrellisString(tString)
      if (!parsed) {
        console.warn(`TrellisManager: Invalid trellis string '${tString}' on subject '${subject.id}'`)
        continue
      }

      const trellis = this.trellises.get(parsed.id)
      if (!trellis) {
        console.warn(`TrellisManager: Unknown trellis ID '${parsed.id}'`)
        continue
      }

      if (trellis.phases.includes(phase)) {
        trellis.execute(phase, context, subject, parsed.args)
      }
    }
  }

  /**
   * Process a phase for ALL active seeds or the global state.
   * Some trellises might need to run even if not attached to a specific seed (though typical usage is per-seed).
   * For now, we iterate all seeds in state and run their trellises.
   */
  public processGlobalPhase(phase: TrellisPhase, context: TrellisContext): void {
    // Iterate over all seeds in the state
    if (context.state) {
      for (const seed of context.state.roomSeeds) {
        this.processPhase(phase, context, seed)
      }
    }
  }

  public processPhaseForRooms(phase: TrellisPhase, context: TrellisContext, rooms: Room[]): void {
    // Add rooms to context for global access if not already present
    if (!context.rooms) context.rooms = rooms
    
    for (const room of rooms) {
      this.processPhase(phase, context, room)
    }
  }
}
