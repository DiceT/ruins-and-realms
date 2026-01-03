/**
 * HeatMapCalculator
 * 
 * Calculates wall heat scores for corridor pathfinding.
 * Higher scores = less desirable for corridor connections.
 * 
 * Scoring Rules:
 * - Wall center tiles: -10 (preferred for doors)
 * - Wall edge tiles: -5 (slightly less preferred)
 * - Spine-adjacent tiles: +50 (discourage direct spine connections)
 * - Spine-proximal tiles (1-tile gap): +25 (discourage short tributaries)
 * - Corner tiles: +500 (impassable)
 */

import { Room } from '../types'

export class HeatMapCalculator {
  /**
   * Calculate heat scores for all wall tiles around rooms.
   * 
   * @param rooms The rooms to calculate wall scores for
   * @param spineTiles The spine tiles (center path)
   * @param spineWidth The width of the spine corridor (default 1)
   * @returns Map of "x,y" -> score
   */
  public static calculate(rooms: Room[], spineTiles: { x: number; y: number; direction?: string }[], spineWidth: number = 1): Map<string, number> {
    const heatScores = new Map<string, number>()
    const wallOwnership = new Map<string, Set<string>>()
    const floorOccupancy = new Map<string, string>() // x,y -> roomId

    // EXPAND SPINE TO GET FULL CORRIDOR FOOTPRINT
    const spineSet = new Set<string>()
    if (spineWidth <= 1) {
        spineTiles.forEach(t => spineSet.add(`${t.x},${t.y}`))
    } else {
        const effectiveWidth = Math.max(1, spineWidth - 2)
        const radius = Math.floor((effectiveWidth - 1) / 2)
        
        for (const t of spineTiles) {
            const key = `${t.x},${t.y}`
            spineSet.add(key)
            
            if (radius > 0) {
              const dir = t.direction || 'north'
              // Expand perpendicular to direction
              const perps = (dir === 'north' || dir === 'south')
                ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                
              for (let i = 1; i <= radius; i++) {
                for (const p of perps) {
                  const px = t.x + p.x * i
                  const py = t.y + p.y * i
                  spineSet.add(`${px},${py}`)
                }
              }
            }
        }
    }

    // 1. Map all existing floor tiles
    for (const room of rooms) {
      for (const t of room.tiles) {
        floorOccupancy.set(`${t.x},${t.y}`, room.id)
      }
    }
    
    const checkSpinePenalty = (x: number, y: number): number => {
        // Distance 1 (Adjacency) -> +50
        if (spineSet.has(`${x},${y-1}`) || 
            spineSet.has(`${x},${y+1}`) || 
            spineSet.has(`${x-1},${y}`) || 
            spineSet.has(`${x+1},${y}`)) {
            return 50
        }
        
        // Distance 2 (Proximity/Near) -> +25
        if (spineSet.has(`${x},${y-2}`) || 
            spineSet.has(`${x},${y+2}`) || 
            spineSet.has(`${x-2},${y}`) || 
            spineSet.has(`${x+2},${y}`)) {
            return 25
        }
        
        return 0
    }

    const addScore = (key: string, bonus: number, roomId: string) => {
      // Track ownership
      if (!wallOwnership.has(key)) {
        wallOwnership.set(key, new Set())
      }
      wallOwnership.get(key)!.add(roomId)

      // Add score
      const current = heatScores.get(key) || 0
      heatScores.set(key, current + bonus)
    }

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      const id = room.id
      
      // North wall (y-1)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y - 1
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        bonus += checkSpinePenalty(wx, wy)
        addScore(`${wx},${wy}`, bonus, id)
      }
      // South wall (y+h)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y + h
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        bonus += checkSpinePenalty(wx, wy)
        addScore(`${wx},${wy}`, bonus, id)
      }
      // West wall (x-1)
      for (let dy = 0; dy < h; dy++) {
        const wx = x - 1, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        bonus += checkSpinePenalty(wx, wy)
        addScore(`${wx},${wy}`, bonus, id)
      }
      // East wall (x+w)
      for (let dy = 0; dy < h; dy++) {
        const wx = x + w, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        bonus += checkSpinePenalty(wx, wy)
        addScore(`${wx},${wy}`, bonus, id)
      }

      const corners = [
        { x: x - 1, y: y - 1 }, { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h }, { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        addScore(`${c.x},${c.y}`, 500, id)
      }
    }

    // Apply shared wall penalty (Issue #5)
    // Shared if:
    // - Multiple rooms claim it as a wall tile
    // - One room claims it as wall, and it is another room's floor (Abutting)
    for (const [key, owners] of wallOwnership.entries()) {
      const isOccupiedByOtherFloor = floorOccupancy.has(key) && !owners.has(floorOccupancy.get(key)!)

      // Only penalize if it physically overlaps another room's floor (Abutting)
      // We ALLOW share walls (owners > 1) because those are good connection points (-10 + -10 = -20)!
      if (isOccupiedByOtherFloor) {
        heatScores.set(key, 500)
      }
    }


    // 3. Score Spine Corridor Walls (NEW)
    // The spine corridor itself is a valid "room" (conceptually) that we can connect TO.
    // If a room is trying to connect to the spine, it targets the spine FLOOR, not wall.
    // BUT the map visualization needs to know that the spine wall is NOT void.
    // AND pathfinding might want to know traversing a spine wall is "opening a door" (costly).
    
    // We iterate the spine SET (which represents floor tiles).
    // Any neighbor of a spine floor tile that is NOT a spine floor tile is a "Spine Wall".
    // We give it a base score of 0 (Neutral) or similar to show it exists.
    
    const spineWallSet = new Set<string>()
    const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}]
    
    for (const key of spineSet) {
        const [sx, sy] = key.split(',').map(Number)
        for (const d of dirs) {
            const wx = sx + d.x
            const wy = sy + d.y
            const wKey = `${wx},${wy}`
            
            // If it's not floor (spine or room), it's a potential wall
            if (!spineSet.has(wKey) && !floorOccupancy.has(wKey)) {
                // If we haven't already scored it (e.g. it might be a room wall too)
                if (!heatScores.has(wKey)) {
                   // Assign a "Spine Wall" score. 
                   // This ensures it is not VOID.
                   heatScores.set(wKey, 50) 
                   spineWallSet.add(wKey)
                }
            }
        }
    }

    return heatScores
  }
}
