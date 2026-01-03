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
    console.log(`[DebugLayer] Render called. Rooms: ${data.rooms.length}, HeatMap: ${config.showHeatMap}`)
    this.clear()
    
    // Use pre-computed heat scores from DungeonData (same as DungeonAssembler uses)
    const dungeonData = data.data as DungeonData
    this.renderHeatMap(dungeonData.heatScores, config.tileSize)
    this.renderWalkmap(dungeonData, config.tileSize)
    
    this.setVisibility(config.showHeatMap, config.showWalkmap)
  }

  /**
   * Render heat map using pre-computed wall scores from DungeonAssembler
   */
  private renderHeatMap(scores: Map<string, number> | undefined, size: number): void {
    if (!scores) return
    
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
