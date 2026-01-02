/**
 * Floor Layer
 * 
 * Responsible for rendering room and corridor floor tiles.
 * Extracted from DungeonViewRenderer for modularity.
 */

import { Graphics } from 'pixi.js'
import { Room } from '../types'
import { RoomLayerConfig } from '../../themes/ThemeTypes'

export interface FloorRenderData {
  rooms: Room[]
  corridorTiles: { x: number; y: number }[]
}

export interface FloorRenderConfig {
  tileSize: number
  theme: RoomLayerConfig
}

/**
 * Renders floor tiles for rooms and corridors
 */
export class FloorLayer {
  private graphics: Graphics

  constructor() {
    this.graphics = new Graphics()
  }

  /**
   * Get the underlying Graphics container for adding to scene
   */
  get container(): Graphics {
    return this.graphics
  }

  /**
   * Clear all floor rendering
   */
  clear(): void {
    this.graphics.clear()
  }

  /**
   * Render all floors (rooms + corridors)
   */
  render(data: FloorRenderData, config: FloorRenderConfig): void {
    this.clear()
    
    const { rooms, corridorTiles } = data
    const { tileSize, theme } = config

    // 1. Render room floors
    for (const room of rooms) {
      this.renderRoomFloor(room, tileSize, theme)
    }

    // 2. Render corridor floors
    for (const pos of corridorTiles) {
      this.graphics.rect(pos.x * tileSize, pos.y * tileSize, tileSize - 1, tileSize - 1)
      this.graphics.fill({ color: theme.floor.color })
    }
  }

  /**
   * Render a single room's floor
   */
  private renderRoomFloor(room: Room, size: number, theme: RoomLayerConfig): void {
    if (room.isCircular) {
      // Draw wall-colored bounding box first (corners will show as walls)
      const { x, y, w, h } = room.bounds
      this.graphics.rect(x * size, y * size, w * size, h * size)
      this.graphics.fill({ color: theme.walls.color })

      // Draw circular room on top (covers the center)
      const centerX = (x + w / 2) * size
      const centerY = (y + h / 2) * size
      const radius = (w / 2) * size

      this.graphics.circle(centerX, centerY, radius)
      this.graphics.fill({ color: theme.floor.color })
    } else {
      // Draw actual tiles (safer than bounds for non-rect or 1x1 rooms)
      // DEBUG: Log for small rooms
      if (room.area <= 1) {
         // Force a debug color if needed, or just ensure it draws
         // console.log('[FloorLayer] Rendering 1x1 room', room.id, room.tiles[0])
      }

      for (const t of room.tiles) {
        this.graphics.rect(t.x * size, t.y * size, size, size)
        this.graphics.fill({ color: theme.floor.color })
      }
    }
  }

  /**
   * Destroy the layer and release resources
   */
  destroy(): void {
    this.graphics.destroy()
  }
}
