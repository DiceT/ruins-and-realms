/**
 * HeatMapCalculator
 * 
 * Calculates wall heat scores for corridor pathfinding.
 * Higher scores = less desirable for corridor connections.
 * 
 * Scoring Rules:
 * - Wall center tiles: -10 (preferred for doors)
 * - Wall edge tiles: -5 (slightly less preferred)
 * - Spine-adjacent tiles: +20 (discourage direct spine connections)
 * - Corner tiles: +100 (strongly discourage corner connections)
 */

import { Room } from '../types'

export class HeatMapCalculator {
  /**
   * Calculate heat scores for all wall tiles around rooms.
   * 
   * @param rooms The rooms to calculate wall scores for
   * @param spineTiles The spine tiles (for adjacency penalty)
   * @returns Map of "x,y" -> score
   */
  public static calculate(rooms: Room[], spineTiles: { x: number; y: number }[]): Map<string, number> {
    const heatScores = new Map<string, number>()
    const wallOwnership = new Map<string, Set<string>>()
    const floorOccupancy = new Map<string, string>() // x,y -> roomId
    const spineSet = new Set<string>(spineTiles.map(t => `${t.x},${t.y}`))

    // 1. Map all existing floor tiles
    for (const room of rooms) {
      for (const t of room.tiles) {
        floorOccupancy.set(`${t.x},${t.y}`, room.id)
      }
    }
    
    const checkSpineAdj = (x: number, y: number) => {
        return spineSet.has(`${x},${y-1}`) || 
               spineSet.has(`${x},${y+1}`) || 
               spineSet.has(`${x-1},${y}`) || 
               spineSet.has(`${x+1},${y}`)
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
        if (checkSpineAdj(wx, wy)) bonus += 20
        addScore(`${wx},${wy}`, bonus, id)
      }
      // South wall (y+h)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y + h
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        addScore(`${wx},${wy}`, bonus, id)
      }
      // West wall (x-1)
      for (let dy = 0; dy < h; dy++) {
        const wx = x - 1, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        addScore(`${wx},${wy}`, bonus, id)
      }
      // East wall (x+w)
      for (let dy = 0; dy < h; dy++) {
        const wx = x + w, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        addScore(`${wx},${wy}`, bonus, id)
      }

      const corners = [
        { x: x - 1, y: y - 1 }, { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h }, { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        addScore(`${c.x},${c.y}`, 100, id)
      }
    }

    // Apply shared wall penalty (Issue #5)
    // Shared if:
    // - Multiple rooms claim it as a wall tile
    // - One room claims it as wall, and it is another room's floor (Abutting)
    for (const [key, owners] of wallOwnership.entries()) {
      const isClaimedByMultipleWalls = owners.size > 1
      const isOccupiedByOtherFloor = floorOccupancy.has(key) && !owners.has(floorOccupancy.get(key)!)

      if (isClaimedByMultipleWalls || isOccupiedByOtherFloor) {
        heatScores.set(key, 500)
      }
    }

    return heatScores
  }
}
