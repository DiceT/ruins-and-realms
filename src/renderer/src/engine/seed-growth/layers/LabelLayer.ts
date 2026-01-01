/**
 * Label Layer
 * 
 * Responsible for rendering room numbers and other text labels.
 * Extracted from DungeonViewRenderer for modularity.
 */

import { Container, Text, TextStyle } from 'pixi.js'
import { Room } from '../types'
import { FurthestRoomResult } from '../../analysis/DungeonAnalysis'

export interface LabelRenderData {
  rooms: Room[]
  furthestMap: Map<string, FurthestRoomResult>
  totalFurthest: number
}

export interface LabelRenderConfig {
  tileSize: number
  showRoomNumbers: boolean
}

/**
 * Renders text labels for dungeon rooms
 */
export class LabelLayer {
  private container: Container

  constructor() {
    this.container = new Container()
  }

  /**
   * Get the underlying Container
   */
  get containerNode(): Container {
    return this.container
  }

  /**
   * Clear all labels
   */
  clear(): void {
    this.container.removeChildren()
  }

  /**
   * Toggle visibility
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible
  }

  /**
   * Render room number labels
   */
  render(data: LabelRenderData, config: LabelRenderConfig): void {
    this.clear()
    
    if (!config.showRoomNumbers) return

    const { rooms, furthestMap, totalFurthest } = data
    const { tileSize } = config

    // Label Style Options (Plain Object)
    const baseStyle = {
      fontFamily: 'Arial',
      fontSize: Math.max(12, Math.floor(tileSize / 2)) + 8, // User requested +4px more (+8 total)
      fontWeight: 'bold',
      fill: '#000000', // Default black
      stroke: '#ffffff',
      strokeThickness: 2,
      align: 'center'
    }

    for (const room of rooms) {
      const isFurthest = furthestMap.get(room.id)
      
      let fillColor: string | number = '#000000'
      
      if (isFurthest) {
        const rank = isFurthest.rank
        const maxRank = Math.max(1, totalFurthest - 1)
        const t = Math.min(1, rank / maxRank) // 0 to 1
        
        // Interpolate RGB
        // Red: 255, 0, 0
        // Orange: 255, 165, 0
        const r1 = 255, g1 = 0, b1 = 0
        const r2 = 255, g2 = 165, b2 = 0
        
        const r = Math.round(r1 + (r2 - r1) * t)
        const g = Math.round(g1 + (g2 - g1) * t)
        const b = Math.round(b1 + (b2 - b1) * t)
        
        fillColor = `rgb(${r}, ${g}, ${b})`
      }

      // Parse ID to number
      let labelText = ''
      try {
        const num = parseInt(room.id.replace('room_', ''))
        labelText = String(num + 1)
      } catch (e) {
        labelText = room.id
      }

      const label = new Text({ 
        text: labelText, 
        style: {
          ...baseStyle,
          fill: fillColor
        }
      })
      
      label.anchor.set(0.5)
      
      // Calculate true center of room (1/2w, 1/2h of bounds)
      const cx = room.bounds.x + room.bounds.w / 2
      const cy = room.bounds.y + room.bounds.h / 2
      
      // Position at PIXEL center
      label.x = cx * tileSize
      label.y = cy * tileSize
      
      this.container.addChild(label)
    }
  }

  /**
   * Destroy and release resources
   */
  destroy(): void {
    this.container.destroy({ children: true })
  }
}
