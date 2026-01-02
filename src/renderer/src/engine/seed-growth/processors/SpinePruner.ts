/**
 * Spine Pruner
 * 
 * Encapsulates the logic for:
 * 1. Pruning unused spine sections (ranges that don't connect relevant areas).
 * 2. Expanding the spine based on `spineWidth`.
 * 3. Eroding dead-end corridor artifacts.
 * 4. Ensuring objects have necessary floor tiles.
 */

import { DungeonData } from '../types'

export class SpinePruner {
  /**
   * Refines the dungeon data by pruning the spine and eroding dead ends.
   * MODIFIES `data` in place (updates `corridors` and `spine`).
   * 
   * @param data The dungeon data model
   * @param initialCorridors The initial set of corridor tiles
   * @param spineTiles The raw spine tiles (SpineTile[]) containing direction info
   * @returns The final set of consolidated corridor tiles
   */
  static prune(data: DungeonData, initialCorridors: { x: number, y: number }[], spineTiles: any[] = []): { x: number, y: number }[] {
    const rooms = data.rooms || []
    // spineTiles argument used directly
    
    // 0. Setup Sets
    const roomTileSet = new Set<string>()
    for (const r of rooms) for (const t of r.tiles) roomTileSet.add(`${t.x},${t.y}`)
    
    const objectTileSet = new Set<string>() // ALL objects (protects these tiles)
    const objectFloorSet = new Set<string>() // Objects needing floor rendering
    if (data.objects) {
        for (const obj of data.objects) {
            const k = `${obj.x},${obj.y}`
            objectTileSet.add(k)
            if (obj.properties?.hasFloor) objectFloorSet.add(k)
        }
    }
    
    const tributarySet = new Set(initialCorridors.map(t => `${t.x},${t.y}`))
    let renderedSpinePath: { x: number, y: number }[] = []
    let consolidatedCorridors: { x: number, y: number }[] = [...initialCorridors]

    // 1. Spine Range Pruning (Critical for Wide Corridors - ONLY for spineWidth > 1)
    // AND implies we have spine tiles to prune.
    const spineWidth = data.spineWidth || 1
    
    if (spineTiles.length > 0 && spineWidth > 1) {
        const effectiveWidth = Math.max(1, spineWidth - 2)
        const radius = Math.floor((effectiveWidth - 1) / 2)
        
        const usedIndices: number[] = []
        for (let i = 0; i < spineTiles.length; i++) {
            const st = spineTiles[i]
            const sliceKeys = [`${st.x},${st.y}`]
            
            // Check radius for interaction
            if (radius > 0) {
                const dir = st.direction || 'north'
                const perps = dir === 'north' || dir === 'south' 
                    ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                    : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                for (let r = 1; r <= radius; r++) {
                    for (const p of perps) sliceKeys.push(`${st.x + p.x * r},${st.y + p.y * r}`)
                }
            }
            
            const isUsed = sliceKeys.some(key => {
                if (roomTileSet.has(key)) return true
                if (tributarySet.has(key)) return true
                if (objectTileSet.has(key)) return true
                
                const [x, y] = key.split(',').map(Number)
                const adj = [`${x+1},${y}`, `${x-1},${y}`, `${x},${y+1}`, `${x},${y-1}`]
                if (adj.some(k => tributarySet.has(k) || objectTileSet.has(k))) return true
                return false
            })
            if (isUsed) usedIndices.push(i)
        }
        
        if (usedIndices.length > 0) {
            const first = usedIndices[0]
            const last = usedIndices[usedIndices.length - 1]
            const prunedSpineTiles = spineTiles.slice(first, last + 1)
            
            const newFullSpineSet = new Set<string>()
            const newFullSpineTiles: { x: number, y: number }[] = []
            
            for (const t of prunedSpineTiles) {
                const key = `${t.x},${t.y}`
                if (!newFullSpineSet.has(key)) {
                    newFullSpineSet.add(key)
                    newFullSpineTiles.push({ x: t.x, y: t.y })
                }
                if (radius > 0) {
                    const dir = t.direction || 'north'
                    const perps = dir === 'north' || dir === 'south' 
                        ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                        : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                    for (let r = 1; r <= radius; r++) {
                        for (const p of perps) {
                            const px = t.x + p.x * r, py = t.y + p.y * r
                            const pkey = `${px},${py}`
                            if (!newFullSpineSet.has(pkey)) {
                                newFullSpineSet.add(pkey)
                                newFullSpineTiles.push({ x: px, y: py })
                            }
                        }
                    }
                }
            }
            renderedSpinePath = newFullSpineTiles
            // Combine spine + initial tributaries
            consolidatedCorridors = [...renderedSpinePath, ...initialCorridors]
        }
    }

    // 2. Iterative Dead-end Erosion
    // Build floor set from rooms, ALL objects, and corridors
    const allFloor = new Set<string>([...roomTileSet, ...objectTileSet, ...consolidatedCorridors.map(t => `${t.x},${t.y}`)])
    let currCorridorSet = new Set(consolidatedCorridors.map(t => `${t.x},${t.y}`))
    
    let changed = true
    while (changed) {
        changed = false
        const toRemove: string[] = []
        for (const key of currCorridorSet) {
            // If this tile HAS an object (stair, door), it is an anchor. PROTECT.
            if (objectTileSet.has(key)) continue
            
            const [x, y] = key.split(',').map(Number)
            let floorNeighbors = 0
            if (allFloor.has(`${x+1},${y}`)) floorNeighbors++
            if (allFloor.has(`${x-1},${y}`)) floorNeighbors++
            if (allFloor.has(`${x},${y+1}`)) floorNeighbors++
            if (allFloor.has(`${x},${y-1}`)) floorNeighbors++
            
            if (floorNeighbors < 2) toRemove.push(key)
        }
        for (const key of toRemove) {
            currCorridorSet.delete(key)
            allFloor.delete(key)
            changed = true
        }
    }
    
    // Rebuild consolidatedCorridors from pruned set
    consolidatedCorridors = Array.from(currCorridorSet).map(k => {
        const [x, y] = k.split(',').map(Number)
        return { x, y }
    })

    // Finally, add all objects with 'hasFloor' to consolidatedCorridors if they aren't already there
    // This ensures no object floats in void
    for (const k of objectFloorSet) {
        if (!currCorridorSet.has(k)) {
            const [x, y] = k.split(',').map(Number)
            consolidatedCorridors.push({ x, y })
        }
    }
    
    // 3. Update Data Model (Side Effects)
    // Update corridors list
    data.corridors = [{
        id: 'generated_render_corridors',
        tiles: consolidatedCorridors.map(t => ({ x: t.x, y: t.y }))
    }]
    
    // Update spine visual path if we have one
    if (renderedSpinePath.length > 0) {
        const prunedSet = new Set(consolidatedCorridors.map(t => `${t.x},${t.y}`))
        renderedSpinePath = renderedSpinePath.filter(t => prunedSet.has(`${t.x},${t.y}`))
        data.spine = renderedSpinePath
    } else if (spineWidth > 1) { // Only clear spine if we were supposed to have one but pruned it all?
        // Or if we never had one.
        // If spineWidth=1, we didn't touch renderedSpinePath, so we shouldn't wipe data.spine if it existed?
        // Currently DungeonViewRenderer implementation wipes it if spineWidth > 1
        // My logic above: if spineWidth > 1 and spineTiles > 0, we calculate renderedSpinePath.
        // If that block runs, we update data.spine.
        // If that block does NOT run (e.g. spineWidth=1), what happens?
        // In DVR, if spineWidth <= 1, it skipped the block, and data.spine was left alone?
        // Wait, DVR had: `if (spineWidth > 1) { ... }`
        // It did NOT touch data.spine in the else block.
        // So I should only update data.spine IF spineWidth > 1.
        data.spine = [] // This wipes it? No, wait.
    }
    
    // Correction: Match DVR logic strictly.
    // data.spine = renderedSpinePath ONLY if we actually calculated it.
    if (renderedSpinePath.length > 0) {
        const prunedSet = new Set(consolidatedCorridors.map(t => `${t.x},${t.y}`))
        renderedSpinePath = renderedSpinePath.filter(t => prunedSet.has(`${t.x},${t.y}`))
        data.spine = renderedSpinePath
    } else if (spineWidth > 1 && spineTiles.length > 0) {
       // We attempted to generate spine but it was all pruned?
       // Then spine should be empty.
       data.spine = []
    }
    
    return consolidatedCorridors
  }
}
