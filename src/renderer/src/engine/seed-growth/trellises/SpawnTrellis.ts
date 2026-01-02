import { ITrellis, TrellisPhase, TrellisContext } from './ITrellis'
import { RoomSeed, Direction, Room } from '../types'

export class SpawnTrellis implements ITrellis {
  id = 'spawn'
  phases: TrellisPhase[] = ['ejection']

  execute(phase: TrellisPhase, context: TrellisContext, subject?: RoomSeed | Room, args?: any[]): void {
    const seed = subject as RoomSeed
    if (phase === 'ejection' && seed && args && args.length >= 2) {
      const count = args[0] as number
      const spacing = args[1] as number
      
      if (count <= 1) return // count includes original

      // We need to clone the seed X-1 times
      const { state } = context
      
      // Calculate growth direction vector
      // Usually spawns extend in the direction of ejection relative to the spine?
      // Or maybe strictly linear? 
      // Markdown: "Spawns X-1 additional copies in a straight line"
      // "Orientation inherited from original"
      
      // If seed was ejected 'north', we assume spacing moves further north?
      // Or does it move along the spine? 
      // Context: "Prison Cell Row". Usually parallel to spine if ejected sideways?
      // Or perpendicular? 
      // "Y: spacing in tiles between room origins... (or height if the spawn is ejected vertically)"
      // Let's assume it continues in the ejection direction for now.
      
      const dir = seed.ejectionDirection
      let dx = 0
      let dy = 0
      
      switch (dir) {
        case 'north': dy = -1; break
        case 'south': dy = 1; break
        case 'east': dx = 1; break
        case 'west': dx = -1; break
      }

      for (let i = 1; i < count; i++) {
        const cx = seed.position.x + (dx * spacing * i)
        const cy = seed.position.y + (dy * spacing * i)
        
        // Bounds check
        if (cx < 0 || cx >= context.state.grid[0].length || cy < 0 || cy >= context.state.grid.length) continue

        // Check if occupied? For now, we force overwrite or skip?
        // Let's check for floor/wall
        const tile = context.state.grid[cy][cx]
        if (tile.state !== 'empty' && tile.state !== 'floor') continue // Don't spawn in walls?
        // If it's another room (floor and regionId != -1), we might overlap.
        // Let's assume valid placement for now or force it.

        const newLength = state.roomSeeds.length
        
        // Create Clone
        const newSeed: RoomSeed = {
          ...seed,
          id: `${seed.id}_spawn_${i}`,
          position: { x: cx, y: cy },
          currentBounds: { x: cx, y: cy, w: 1, h: 1 },
          tiles: [{ x: cx, y: cy }],
          birthOrder: newLength,
          regionId: newLength + 1, // Usually seed index + 1
          generation: 'secondary', 
          // Remove #spawn tag
          trellis: seed.trellis?.filter(t => !t.startsWith('#spawn')),
          content: seed.content ? { ...seed.content } : undefined
        }

        // Mark Grid
        tile.state = 'floor'
        tile.regionId = newLength + 1
        tile.growthOrder = context.state.tilesGrown ? context.state.tilesGrown++ : 0

        // Add to state
        state.roomSeeds.push(newSeed)
        console.warn(`[SpawnTrellis] 🌱 SPROUTING CLONE ${newSeed.id} at ${cx},${cy} [1x1]. Trellis: ${newSeed.trellis?.join(',') || 'none'}`)
      }
    }
  }
}
