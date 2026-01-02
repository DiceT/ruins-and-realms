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

import { Room } from './types'

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
    const spineSet = new Set<string>(spineTiles.map(t => `${t.x},${t.y}`))
    
    const checkSpineAdj = (x: number, y: number) => {
        return spineSet.has(`${x},${y-1}`) || 
               spineSet.has(`${x},${y+1}`) || 
               spineSet.has(`${x-1},${y}`) || 
               spineSet.has(`${x+1},${y}`)
    }

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      
      // North wall (y-1)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y - 1
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // South wall (y+h)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y + h
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // West wall (x-1)
      for (let dy = 0; dy < h; dy++) {
        const wx = x - 1, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // East wall (x+w)
      for (let dy = 0; dy < h; dy++) {
        const wx = x + w, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }

      const corners = [
        { x: x - 1, y: y - 1 }, { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h }, { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        const key = `${c.x},${c.y}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + 100)
      }
    }
    return heatScores
  }
}
