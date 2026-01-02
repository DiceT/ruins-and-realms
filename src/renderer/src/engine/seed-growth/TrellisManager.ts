import { ITrellis, TrellisPhase, TrellisContext } from './trellises/ITrellis'
import { RoomSeed, SpineSeedState, Room } from './types'
import { SeededRNG } from '../../utils/SeededRNG'

import { CellTrellis } from './trellises/CellTrellis' 
import { SpawnTrellis } from './trellises/SpawnTrellis'
import { TinyTitanTrellis } from './trellises/TinyTitanTrellis'
import { AlcoveTrellis } from './trellises/AlcoveTrellis' 

export class TrellisManager {
  private static instance: TrellisManager
  private trellises: Map<string, ITrellis> = new Map()

  private constructor() {
    this.registerTrellis(new CellTrellis())
    this.registerTrellis(new SpawnTrellis())
    this.registerTrellis(new TinyTitanTrellis())
    this.registerTrellis(new AlcoveTrellis())
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
   * Example: "#spawn({min: 2, max: 8}, 2)" -> { id: "spawn", args: [{min: 2, max: 8}, 2] }
   */
  public parseTrellisString(raw: string): { id: string, args: any[] } | null {
    const trimmed = raw.trim()
    if (!trimmed.startsWith('#')) return null

    // Regex to match #name or #name(arg1, arg2)
    const match = trimmed.match(/^#([a-zA-Z0-9_-]+)(?:\((.*)\))?$/)
    if (!match) return null

    const id = match[1]
    const argsStr = match[2]

    if (!argsStr) return { id, args: [] }

    // Smart splitting that respects { } and [ ]
    const args: any[] = []
    let current = ''
    let depth = 0
    
    for (let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i]
        if (char === '{' || char === '[') depth++
        if (char === '}' || char === ']') depth--
        
        if (char === ',' && depth === 0) {
            args.push(this.parseArgValue(current.trim()))
            current = ''
        } else {
            current += char
        }
    }
    if (current.trim()) {
        args.push(this.parseArgValue(current.trim()))
    }

    return { id, args }
  }

  private parseArgValue(s: string): any {
    // 0. Try JSON parse for objects/arrays
    if (s.startsWith('{') || s.startsWith('[')) {
        try {
            // Lensient match for {min: 2, max: 8}
            if (s.includes('min') && s.includes('max')) {
                const minMatch = s.match(/min\s*:\s*(\d+)/)
                const maxMatch = s.match(/max\s*:\s*(\d+)/)
                if (minMatch && maxMatch) {
                    return { min: parseInt(minMatch[1]), max: parseInt(maxMatch[1]) }
                }
            }
            
            // Try standard JSON with quoted keys
            return JSON.parse(s.replace(/([{,])\s*([a-zA-Z0-9_]+)\s*:/g, '$1"$2":'))
        } catch (e) {
            // Fallback
        }
    }

    // 1. Try parsing as range (e.g. "2-8")
    if (s.includes('-')) {
        const parts = s.split('-').map(p => parseFloat(p.trim()))
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return { min: parts[0], max: parts[1] }
        }
    }

    // 2. Try parsing as number
    const num = parseFloat(s)
    if (!isNaN(num)) return num

    // 3. Try boolean
    if (s === 'true') return true
    if (s === 'false') return false

    // 4. Return string (remove quotes if present)
    return s.replace(/^["']|["']$/g, '')
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
