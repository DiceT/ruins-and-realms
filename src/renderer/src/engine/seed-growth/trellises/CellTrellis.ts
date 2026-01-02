/**
 * # Cell Trellis (#cell)
 * 
 * DESCRIPTION:
 * Handles layout constraints for "Cell" type rooms (small, repeating units). 
 * It enforces a "Single Exit" rule and ensures that corridors enter/exit the cell 
 * only from orthogonal sides by manipulating the pathfinding heatmap.
 * 
 * SEED-ENGINE TERMINOLOGY:
 * - Phase [CORRIDOR_ASSEMBLY]: Executes during the final pathfinding stage to block specific walls.
 * - Heatmap: The cost-grid for door placement. Setting a tile to 500 "blocks" it; 1000 "forbids" it.
 * - Shared Wall: A wall abutting another room's floor, detected by the engine and blocked by this trellis.
 */

import { ITrellis, TrellisPhase, TrellisContext } from './ITrellis'
import { RoomSeed, Room, ManualSeedConfig } from '../types'

export class CellTrellis implements ITrellis {
  id = 'cell'
  phases: TrellisPhase[] = ['classification', 'corridorAssembly']

  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room | ManualSeedConfig, args?: any[]): any {
    if (phase === 'classification') {
      const seed = subject as RoomSeed
      // Ensure cluster seeds share a type/label if needed
      // Most of this is handled by clusterId sharing

    } else if (phase === 'corridorAssembly') {
      const room = subject as Room
      const { heatMap, rooms } = context
      
      if (room && heatMap && rooms) {
        const { x, y, w, h } = room.bounds
        
        // 1. Identify shared walls (500)
        // (HeatMapCalculator already does some of this, but we can enforce it here specifically for cells)
        
        const walls = {
            north: [] as string[],
            south: [] as string[],
            west: [] as string[],
            east: [] as string[]
        }
        
        for (let dx = 0; dx < w; dx++) {
            walls.north.push(`${x + dx},${y - 1}`)
            walls.south.push(`${x + dx},${y + h}`)
        }
        for (let dy = 0; dy < h; dy++) {
            walls.west.push(`${x - 1},${y + dy}`)
            walls.east.push(`${x + w},${y + dy}`)
        }

        const isWallBlocked = (keyList: string[]) => {
            return keyList.some(k => heatMap.get(k) === 500)
        }

        // Apply "Opposite wall 500 if shared"
        // This forces exits to be strictly orthogonal to the shared axis.
        if (isWallBlocked(walls.north)) {
            for (const k of walls.south) heatMap.set(k, 500)
        }
        if (isWallBlocked(walls.south)) {
            for (const k of walls.north) heatMap.set(k, 500)
        }
        if (isWallBlocked(walls.west)) {
            for (const k of walls.east) heatMap.set(k, 500)
        }
        if (isWallBlocked(walls.east)) {
            for (const k of walls.west) heatMap.set(k, 500)
        }
        
        // Implementation for corners zeroed (Prevent corner doors)
        const corners = [
            {x: x-1, y: y-1}, {x: x+w, y: y-1},
            {x: x+w, y: y+h}, {x: x-1, y: y+h}
        ]
        for (const c of corners) {
            heatMap.set(`${c.x},${c.y}`, 1000) // Forbid
        }
      }
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
