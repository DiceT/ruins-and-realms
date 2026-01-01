/**
 * Debug Layer
 * 
 * Responsible for rendering debug visualizations:
 * 1. Heat map (wall placement scores)
 * 2. Walkmap (pathfinding diagnostics, movement costs, traversals)
 */

import { Container, Graphics, Text } from 'pixi.js'
import { Room, DungeonData, SeedGrowthState } from '../types'
import { DungeonAnalysis } from '../../analysis/DungeonAnalysis'

export interface DebugRenderData {
  data: SeedGrowthState | DungeonData
  rooms: Room[]
  spineTiles: { x: number; y: number }[]
}

export interface DebugRenderConfig {
  tileSize: number
  showHeatMap: boolean
  showWalkmap: boolean
}

/**
 * Renders debug overlays for the dungeon
 */
export class DebugLayer {
  private heatMapLayer: Graphics
  private walkmapLayer: Container
  private container: Container

  constructor() {
    this.container = new Container()
    this.heatMapLayer = new Graphics()
    this.walkmapLayer = new Container()
    
    this.container.addChild(this.heatMapLayer)
    this.container.addChild(this.walkmapLayer)
  }

  /**
   * Get the underlying Container
   */
  get containerNode(): Container {
    return this.container
  }

  /**
   * Clear all debug overlays
   */
  clear(): void {
    this.heatMapLayer.clear()
    this.walkmapLayer.removeChildren()
  }

  /**
   * Set visibility for specific sub-layers
   */
  setVisibility(heatMap: boolean, walkmap: boolean): void {
    this.heatMapLayer.visible = heatMap
    this.walkmapLayer.visible = walkmap
  }

  /**
   * Render debug layers
   */
  render(data: DebugRenderData, config: DebugRenderConfig): void {
    this.clear()
    
    // Always render if visibility is tied to these layers, 
    // but we can skip logic if both are off if performance is an issue.
    this.renderHeatMap(data.rooms, data.spineTiles, config.tileSize)
    this.renderWalkmap(data.data as DungeonData, config.tileSize)
    
    this.setVisibility(config.showHeatMap, config.showWalkmap)
  }

  /**
   * Render heat map using wall scores
   */
  private renderHeatMap(rooms: Room[], spineTiles: { x: number; y: number }[], size: number): void {
    const scores = this.calculateWallHeatScores(rooms, spineTiles)
    
    // Color scale helper for Additive Scores
    const scoreToColor = (s: number): number => {
      if (s <= -20) return 0x00FF00 // Green (Best - Double Shared)
      if (s < -5) return 0x00FFFF // Cyan (Good - Center/Edge)
      if (s < 5) return 0xFFFF00 // Yellow (Neutral)
      if (s < 50) return 0xFF8800 // Orange (Spine Adj)
      return 0xFF0000 // Red (Corner/Blocked)
    }

    for (const [key, score] of scores.entries()) {
      const [x, y] = key.split(',').map(Number)
      this.heatMapLayer.rect(x * size, y * size, size, size)
      this.heatMapLayer.fill({ color: scoreToColor(score), alpha: 0.5 })
    }
  }

  /**
   * Calculate heat map scores for all room walls
   */
  private calculateWallHeatScores(rooms: Room[], spineTiles: { x: number; y: number }[]): Map<string, number> {
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
      
      // North and South walls
      for (let dx = 0; dx < w; dx++) {
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        
        // North
        const nKey = `${x + dx},${y - 1}`
        if (checkSpineAdj(x + dx, y - 1)) bonus += 20
        heatScores.set(nKey, (heatScores.get(nKey) || 0) + bonus)
        
        // South
        const sKey = `${x + dx},${y + h}`
        if (checkSpineAdj(x + dx, y + h)) bonus += 20
        heatScores.set(sKey, (heatScores.get(sKey) || 0) + bonus)
      }

      // West and East walls
      for (let dy = 0; dy < h; dy++) {
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)

        // West
        const wKey = `${x - 1},${y + dy}`
        if (checkSpineAdj(x - 1, y + dy)) bonus += 20
        heatScores.set(wKey, (heatScores.get(wKey) || 0) + bonus)

        // East
        const eKey = `${x + w},${y + dy}`
        if (checkSpineAdj(x + w, y + dy)) bonus += 20
        heatScores.set(eKey, (heatScores.get(eKey) || 0) + bonus)
      }

      // Diagonal corners
      const corners = [
        { x: x - 1, y: y - 1 },
        { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h },
        { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        const key = `${c.x},${c.y}`
        heatScores.set(key, (heatScores.get(key) || 0) + 100)
      }
    }
    return heatScores
  }

  /**
   * Render walkmap overlay
   */
  private renderWalkmap(data: DungeonData, size: number): void {
    if (!data || !data.rooms) return

    const analysis = DungeonAnalysis.analyze(data)
    const { roomCosts, walkableTiles, roomTraversals, doorTraversals } = analysis
    
    const graphics = new Graphics()
    graphics.fillStyle = { color: 0xADD8E6, alpha: 0.5 } // light blue
    
    for (const key of walkableTiles) {
      const [x, y] = key.split(',').map(Number)
      graphics.rect(x * size, y * size, size, size)
      graphics.fill()
    }
    
    this.walkmapLayer.addChild(graphics)
    
    // Render Labels
    const labelStyle = {
      fontFamily: 'Arial',
      fontSize: Math.max(10, Math.floor(size / 2.5)),
      fontWeight: 'normal',
      fill: '#000000',
      align: 'center'
    }
    
    for (const room of data.rooms) {
      const cx = room.bounds.x + room.bounds.w / 2
      const cy = room.bounds.y + room.bounds.h / 2
      
      // Movement Costs (0.5 squares above)
      const cost = roomCosts.get(room.id)
      if (cost !== undefined) {
        const text = new Text({ text: `(${cost})`, style: labelStyle })
        text.anchor.set(0.5)
        text.x = cx * size
        text.y = (cy - 0.5) * size
        this.walkmapLayer.addChild(text)
      }
      
      // Traversal counts (0.5 squares below)
      const roomCount = roomTraversals.get(room.id) ?? 0
      const doorCount = doorTraversals.get(room.id) ?? 0
      const traversalLabel = new Text({
        text: `R:${roomCount} D:${doorCount}`,
        style: labelStyle
      })
      traversalLabel.anchor.set(0.5)
      traversalLabel.x = cx * size
      traversalLabel.y = (cy + 0.5) * size
      this.walkmapLayer.addChild(traversalLabel)
    }
  }

  /**
   * Destroy and release resources
   */
  destroy(): void {
    this.container.destroy({ children: true })
  }
}
