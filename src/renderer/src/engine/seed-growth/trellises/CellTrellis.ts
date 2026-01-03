/**
 * # Cell Trellis (#cell)
 * 
 * DESCRIPTION:
 * Handles layout constraints for "Cell" type rooms (small, repeating units). 
 * Blocks walls where adjacent cells are detected (+/- 2 tiles).
 * Forces exits perpendicular to the cell row direction.
 */

import { ITrellis, TrellisPhase, TrellisContext } from './ITrellis'
import { RoomSeed, Room, ManualSeedConfig } from '../types'

export class CellTrellis implements ITrellis {
  id = 'cell'
  phases: TrellisPhase[] = ['classification', 'corridorAssembly']

  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room | ManualSeedConfig, args?: any[]): any {
    if (phase === 'classification') {
      // Classification phase - nothing needed

    } else if (phase === 'corridorAssembly') {
      const room = subject as Room
      const { heatMap, rooms } = context
      
      if (room && heatMap && rooms) {
        const { x, y, w, h } = room.bounds
        const cx = room.bounds.x + room.bounds.w / 2
        const cy = room.bounds.y + room.bounds.h / 2
        
        // Find ALL neighbors
        const neighbors = context.rooms.filter(r => 
            r.id !== room.id && 
            r.clusterId === room.clusterId &&
            Math.abs(r.bounds.x - cx) <= (w + 2) && 
            Math.abs(r.bounds.y - cy) <= (h + 2)
        )

        let hasNorthNeighbor = false
        let hasSouthNeighbor = false
        let hasWestNeighbor = false
        let hasEastNeighbor = false

        for (const other of neighbors) {
            const dy = other.bounds.y - room.bounds.y
            const dx = other.bounds.x - room.bounds.x
            const absDx = Math.abs(dx)
            const absDy = Math.abs(dy)
            
            // Determine primary axis of adjacency
            if (absDx > absDy) {
                // Horizontal: Check Y-Overlap to ensure true adjacency
                const yOverlap = Math.min(room.bounds.y + room.bounds.h, other.bounds.y + other.bounds.h) - Math.max(room.bounds.y, other.bounds.y)
                if (yOverlap > 0) {
                    if (dx > 0) hasEastNeighbor = true
                    else hasWestNeighbor = true
                }
            } else {
                // Vertical: Check X-Overlap to ensure true adjacency
                const xOverlap = Math.min(room.bounds.x + room.bounds.w, other.bounds.x + other.bounds.w) - Math.max(room.bounds.x, other.bounds.x)
                if (xOverlap > 0) {
                    if (dy > 0) hasSouthNeighbor = true
                    else hasNorthNeighbor = true
                }
            }
        }
        
        console.log(`[CellTrellis] Room ${room.id} Neighbors: N=${hasNorthNeighbor} S=${hasSouthNeighbor} W=${hasWestNeighbor} E=${hasEastNeighbor}`)

        // Define walls
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

        // Block Horizontal walls if any horizontal neighbor exists (Force Vertical Flow)
        if (hasWestNeighbor || hasEastNeighbor) {
            for (const k of walls.west) heatMap.set(k, 500)
            for (const k of walls.east) heatMap.set(k, 500)
        }

        // Block Vertical walls if any vertical neighbor exists (Force Horizontal Flow)
        if (hasNorthNeighbor || hasSouthNeighbor) {
            for (const k of walls.north) heatMap.set(k, 500)
            for (const k of walls.south) heatMap.set(k, 500)
        }
        
        // Block corners entirely
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

  /**
   * Check if there's an adjacent room in a given direction.
   * Checks +/- offset from center.
   */
  private checkDirection(
    cx: number, cy: number, 
    dx: number, dy: number,
    w: number, h: number,
    allFloors: Map<string, Room>
  ): boolean {
    // Check positions offset from center
    // For 1x1 cells, check just the offset position
    // For larger cells, check across the width/height
    
    if (dx !== 0) {
      // Horizontal check - scan vertically
      for (let oy = -Math.floor(h/2); oy <= Math.floor(h/2); oy++) {
        if (allFloors.has(`${cx + dx},${cy + oy}`)) return true
      }
    } else {
      // Vertical check - scan horizontally
      for (let ox = -Math.floor(w/2); ox <= Math.floor(w/2); ox++) {
        if (allFloors.has(`${cx + ox},${cy + dy}`)) return true
      }
    }
    return false
  }
}
