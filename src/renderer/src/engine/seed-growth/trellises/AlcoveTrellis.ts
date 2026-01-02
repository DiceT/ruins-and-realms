/**
 * # Alcove Trellis (#alcove)
 * 
 * DESCRIPTION:
 * Creates decorative or functional 1x1 "blocked" tiles (alcoves) along the inner 
 * walls of a room at 2-space intervals (010101). It can also manipulate the 
 * room's heatmap to prevent or restrict corridor exits along those walls.
 * 
 * SEED-ENGINE TERMINOLOGY:
 * - Phase [CORRIDOR_ASSEMBLY]: Modifies the heatmap to restrict door placement.
 * - Phase [DECORATION]: Physically marks grid tiles as "blocked" to create the alcoves.
 * - Kitty-Corner Rule: Applies heatmap penalties to tiles diagonally adjacent to 
 *   an alcove's "front" on the wall, forcing specific door alignments.
 */

import { ITrellis, TrellisPhase, TrellisContext } from './ITrellis'
import { RoomSeed, Room, ManualSeedConfig } from '../types'

export class AlcoveTrellis implements ITrellis {
  id = 'alcove'
  phases: TrellisPhase[] = ['corridorAssembly', 'decoration']

  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room | ManualSeedConfig, args?: any[]): any {
    if (phase === 'corridorAssembly') {
      this.handleCorridorAssembly(context, subject as Room, args)
    } else if (phase === 'decoration') {
      this.handleDecoration(context, subject as Room, args)
    }
  }

  private handleCorridorAssembly(context: TrellisContext, room: Room, args?: any[]): void {
    if (!room || !context.heatMap) return
    
    const { heatMap } = context
    const { numberOfWalls, preventExits } = this.parseArgs(args)
    const selectedWalls = this.getSelectedWalls(room, numberOfWalls, context.rng)

    for (const wallSide of selectedWalls) {
      const wallTiles = this.getWallTiles(room, wallSide)
      const wallKeyList = this.getWallBoundaryKeys(room, wallSide)
      
      // Implement heatmap logic
      if (preventExits) {
        // Block entire wall
        for (const k of wallKeyList) {
          heatMap.set(k, 500)
        }
      } else {
        // Kitty-corner rule: Block tiles on wall adjacent to alcove tiles
        // Alcoves are at 2-space intervals: 0, 2, 4...
        // We only block if preventExits is false (kitty-corner mode)
        for (let i = 0; i < wallTiles.length; i += 2) {
          // Wall tiles are 1-indexed relative to the wall boundary
          // Kitty corners on the wall are i-1 and i+1
          if (i > 0) heatMap.set(wallKeyList[i - 1], 500)
          if (i < wallKeyList.length - 1) heatMap.set(wallKeyList[i + 1], 500)
        }
      }
    }
  }

  private handleDecoration(context: TrellisContext, room: Room, args?: any[]): void {
    if (!room || !context.state) return
    
    const { grid } = context.state
    const { numberOfWalls } = this.parseArgs(args)
    const selectedWalls = this.getSelectedWalls(room, numberOfWalls, context.rng)

    for (const wallSide of selectedWalls) {
      const wallInternalTiles = this.getWallTiles(room, wallSide)
      
      // Create 1x1 walls at 2-space intervals (0, 2, 4...)
      for (let i = 0; i < wallInternalTiles.length; i += 2) {
        const t = wallInternalTiles[i]
        if (grid[t.y] && grid[t.y][t.x]) {
          grid[t.y][t.x].state = 'blocked'
        }
      }
    }
  }

  private parseArgs(args?: any[]): { numberOfWalls: number, preventExits: boolean } {
    return {
      numberOfWalls: (args && typeof args[0] === 'number') ? args[0] : 1,
      preventExits: (args && args[1] === true)
    }
  }

  private getSelectedWalls(room: Room, count: number, rng: any): string[] {
    const all = ['north', 'south', 'east', 'west']
    if (count <= 1) {
      // Pick one randomly
      return [all[rng.nextInt(0, 3)]]
    }
    if (count === 2) {
      // Pick opposing
      return rng.next() < 0.5 ? ['north', 'south'] : ['east', 'west']
    }
    if (count === 3) {
      // Pick 3 random
      const shuffled = [...all].sort(() => rng.next() - 0.5)
      return shuffled.slice(0, 3)
    }
    return all // 4 or more
  }

  /** Gets internal tiles inside the room boundary along a specific wall */
  private getWallTiles(room: Room, side: string): {x: number, y: number}[] {
    const { x, y, w, h } = room.bounds
    const res: {x: number, y: number}[] = []
    
    if (side === 'north') {
      for (let dx = 0; dx < w; dx++) res.push({ x: x + dx, y: y })
    } else if (side === 'south') {
      for (let dx = 0; dx < w; dx++) res.push({ x: x + dx, y: y + h - 1 })
    } else if (side === 'west') {
      for (let dy = 0; dy < h; dy++) res.push({ x: x, y: y + dy })
    } else if (side === 'east') {
      for (let dy = 0; dy < h; dy++) res.push({ x: x + w - 1, y: y + dy })
    }
    return res
  }

  /** Gets the boundary keys outside the room for heatmapping */
  private getWallBoundaryKeys(room: Room, side: string): string[] {
    const { x, y, w, h } = room.bounds
    const res: string[] = []
    
    if (side === 'north') {
      for (let dx = 0; dx < w; dx++) res.push(`${x + dx},${y - 1}`)
    } else if (side === 'south') {
      for (let dx = 0; dx < w; dx++) res.push(`${x + dx},${y + h}`)
    } else if (side === 'west') {
      for (let dy = 0; dy < h; dy++) res.push(`${x - 1},${y + dy}`)
    } else if (side === 'east') {
      for (let dy = 0; dy < h; dy++) res.push(`${x + w},${y + dy}`)
    }
    return res
  }
}
