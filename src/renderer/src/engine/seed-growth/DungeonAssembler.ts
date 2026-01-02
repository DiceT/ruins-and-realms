import { DungeonData, Room, SeedGrowthSettings, DungeonObject, SpineSeedState } from './types'
import { CorridorPathfinder } from './CorridorPathfinder'
import { DungeonDecorator } from './DungeonDecorator'
import { SpinePruner } from './SpinePruner'
import { TagManager } from './TagManager'
import { SeededRNG } from '../../utils/SeededRNG'

/**
 * DungeonAssembler
 * 
 * Responsible for the "Physical Phase" of dungeon generation:
 * 1. Calculating Wall Heat Maps (Tag-aware)
 * 2. Generating Corridors (Spine Tributaries)
 * 3. Pruning Dead Ends
 * 4. Decorating (Doors, Stairs)
 */
export class DungeonAssembler {

  /**
   * Assemble a Spine-based dungeon.
   * Takes the raw rooms and spine from classification/generation and builds the connectivity.
   */
  public static assembleSpineDungeon(
    data: DungeonData, 
    settings: SeedGrowthSettings
  ): DungeonData {
    const { rooms, spine } = data
    
    // 1. Calculate Wall Heat Scores (Tag Aware)
    // We Map spine to simple {x,y} for context
    const spineCoords = spine.map(t => ({ x: t.x, y: t.y }))
    const heatScores = this.calculateWallHeatScores(rooms, spineCoords)

    // 2. Determine Active Spine (for pruning and generation)
    // Simplified: Use full spine for now, Pruner handles cleanup
    const activeSpineTiles = spineCoords

    // 3. Build Target Set (Spine Tiles are targets)
    const targetSet = new Set<string>()
    // If spine width > 1, we might expand this target set, but for now use center tiles
    for (const t of activeSpineTiles) targetSet.add(`${t.x},${t.y}`)

    // 4. Build Blocked Set (Room Floors - don't plow through other rooms)
    const blockedSet = new Set<string>()
    for (const room of rooms) {
        for (const t of room.tiles) blockedSet.add(`${t.x},${t.y}`)
    }

    // 5. Generate Tributaries
    console.log('[DungeonAssembler] Generating Corridors. Rooms:', rooms.length, 'Spine:', activeSpineTiles.length)
    const pathfinder = new CorridorPathfinder(settings.seed.toString())
    const tributaryTiles = pathfinder.generateSpineCorridors(
        data.gridWidth,
        data.gridHeight,
        rooms,
        activeSpineTiles, 
        heatScores,
        targetSet,
        blockedSet
    )
    console.log('[DungeonAssembler] Tributaries generated:', tributaryTiles.length)

    // 6. Assemble Corridors
    // Start with tributaries
    let finalCorridors = [...tributaryTiles]
    
    // If spine has width, we need to add the spine itself as a corridor?
    // In previous logic (Step 831), renderedSpinePath was used.
    // We should probably reconstruct that "Spine Corridor" logic here if needed.
    // For now, let's assume width 1 or rely on data.spine being sufficient if width > 1 logic is handled elsewhere?
    // Actually, Step 831 logic explicitly expanded the spine for rendering.
    // We should replicate that expansion if we want the "Spine Corridor" to physically exist in data.corridors.
    
    if (data.spineWidth > 1) {
        const expandedSpine = this.expandSpine(activeSpineTiles, data.spineWidth, spine) // simplified
        finalCorridors = [...expandedSpine, ...finalCorridors]
    }

    // 7. Initial Data Update
    data.corridors = [{
        id: 'main_network',
        tiles: finalCorridors,
        regionId: -1
    }]

    // 8. Decorate (Doors, Stairs)
    // Decoration happens BEFORE final pruning so we know where doors are, 
    // BUT pruning removes dead corridors.
    // Best workflow: 
    //   Decorate -> establishes where connections ARE.
    //   Prune -> removes corridors that DON'T lead to connections.
    const decorator = new DungeonDecorator(settings.seed.toString())
    decorator.decorate(data)

    // 9. Prune Dead Ends
    const prunedCorridors = SpinePruner.prune(data, finalCorridors, activeSpineTiles)
    
    data.corridors = [{
        id: 'main_network',
        tiles: prunedCorridors,
        regionId: -1
    }]

    return data
  }

  /**
   * Expand single-tile spine into a wide corridor
   */
  private static expandSpine(spineTiles: {x:number, y:number}[], width: number, fullSpineData: any[]): {x:number, y:number}[] {
     const effectiveWidth = Math.max(1, width - 2) // As per rule: Spine CORRIDOR is 2 less than Width
     if (effectiveWidth <= 0) return [] // Should not happen if width > 1 check passed

     const radius = Math.floor((effectiveWidth - 1) / 2)
     const fullSet = new Set<string>()
     const tiles: {x:number, y:number}[] = []

     const add = (x, y) => {
         const key = `${x},${y}`
         if (!fullSet.has(key)) {
             fullSet.add(key)
             tiles.push({x, y})
         }
     }

     for (const t of spineTiles) {
         add(t.x, t.y)
         
         // Find direction from original data if possible, else default
         const original = fullSpineData.find(st => st.x === t.x && st.y === t.y)
         const dir = original?.direction || 'north'
         
         const perps = (dir === 'north' || dir === 'south')
             ? [{x:1, y:0}, {x:-1, y:0}]
             : [{x:0, y:1}, {x:0, y:-1}]
             
         for (let i = 1; i <= radius; i++) {
             for (const p of perps) {
                 add(t.x + p.x * i, t.y + p.y * i)
             }
         }
     }
     return tiles
  }

  /**
   * Calculate heat map scores for all room walls.
   * Includes TagManager hooks for architectural influence.
   */
  private static calculateWallHeatScores(rooms: Room[], spineTiles: { x: number; y: number }[]): Map<string, number> {
    const heatScores = new Map<string, number>()
    const spineSet = new Set<string>(spineTiles.map(t => `${t.x},${t.y}`))
    
    const checkSpineAdj = (x: number, y: number) => {
        return spineSet.has(`${x},${y-1}`) || 
               spineSet.has(`${x},${y+1}`) || 
               spineSet.has(`${x-1},${y}`) || 
               spineSet.has(`${x+1},${y}`)
    }

    const tagManager = TagManager.getInstance()

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      
      // Helper to apply score
      const apply = (tx: number, ty: number, isEdge: boolean, isCenter: boolean) => {
          let bonus = isEdge ? -5 : (isCenter ? -10 : 0)
          if (checkSpineAdj(tx, ty)) bonus += 20 // Default Rule: +20 penalty for Spine Adjacency
          
          const key = `${tx},${ty}`
          const current = heatScores.get(key) || 0
          heatScores.set(key, current + bonus)
      }

      // North (y-1)
      for (let dx = 0; dx < w; dx++) {
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        apply(x + dx, y - 1, dx === 0 || dx === w - 1, dist === 0)
      }
      // South (y+h)
      for (let dx = 0; dx < w; dx++) {
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        apply(x + dx, y + h, dx === 0 || dx === w - 1, dist === 0)
      }
      // West (x-1)
      for (let dy = 0; dy < h; dy++) {
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        apply(x - 1, y + dy, dy === 0 || dy === h - 1, dist === 0)
      }
      // East (x+w)
      for (let dy = 0; dy < h; dy++) {
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        apply(x + w, y + dy, dy === 0 || dy === h - 1, dist === 0)
      }

      // Corners (Heavy Penalty/Bonus depending on view, historically +100 in code)
      const corners = [
        { x: x - 1, y: y - 1 }, { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h }, { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        const key = `${c.x},${c.y}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + 100)
      }
      
      // --- TAG HOOK ---
      // Allow the room to override its wall scores
      tagManager.applyOnCalculateHeat(room, heatScores, { spineTiles, rooms })
    }
    return heatScores
  }
}
