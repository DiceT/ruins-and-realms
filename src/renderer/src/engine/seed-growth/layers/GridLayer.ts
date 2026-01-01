/**
 * Grid Layer
 * 
 * Responsible for rendering grid lines between floor tiles.
 * Lines have constant visual weight regardless of zoom level.
 * Extracted from DungeonViewRenderer for modularity.
 */

import { Graphics } from 'pixi.js'
import { Room } from '../types'
import { RoomLayerConfig } from '../../themes/ThemeTypes'

export interface GridRenderData {
  rooms: Room[]
  corridorTiles: { x: number; y: number }[]
}

export interface GridRenderConfig {
  tileSize: number
  theme: RoomLayerConfig
  zoom: number
}

/**
 * Renders grid lines between adjacent floor tiles
 */
export class GridLayer {
  private graphics: Graphics
  private floorPositions: Set<string> = new Set()
  private tileSize: number = 8
  private zoom: number = 1
  private config: RoomLayerConfig | null = null

  constructor() {
    this.graphics = new Graphics()
  }

  /**
   * Get the underlying Graphics container
   */
  get container(): Graphics {
    return this.graphics
  }

  /**
   * Clear grid rendering
   */
  clear(): void {
    this.graphics.clear()
  }

  /**
   * Render grid lines for all floor tiles
   */
  render(data: GridRenderData, config: GridRenderConfig): void {
    const { rooms, corridorTiles } = data
    this.tileSize = config.tileSize
    this.zoom = config.zoom
    this.config = config.theme

    // Build floor positions set
    this.floorPositions.clear()

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.floorPositions.add(`${x + dx},${y + dy}`)
        }
      }
    }

    for (const pos of corridorTiles) {
      this.floorPositions.add(`${pos.x},${pos.y}`)
    }

    // Draw grid lines
    this.updateLines()
  }

  /**
   * Update grid lines with current zoom level
   * Call this after zoom changes to maintain constant visual weight
   */
  updateZoom(zoom: number): void {
    this.zoom = zoom
    this.updateLines()
  }

  /**
   * Get the current floor positions set
   * Useful for external collision/pathfinding
   */
  getFloorPositions(): Set<string> {
    return this.floorPositions
  }

  /**
   * Internal: Draw grid lines between adjacent floor tiles
   */
  private updateLines(): void {
    this.graphics.clear()

    if (!this.config) return

    const size = this.tileSize
    // Line width in world space = 1 screen pixel / zoom
    const lineWidth = 1 / this.zoom
    const color = this.config.grid.color

    // Draw grid lines ONLY between adjacent floor tiles (not at edges)
    for (const key of this.floorPositions) {
      const [x, y] = key.split(',').map(Number)
      const px = x * size
      const py = y * size

      // Right edge - only draw if there's a floor tile to the right
      if (this.floorPositions.has(`${x + 1},${y}`)) {
        this.graphics.rect(px + size - lineWidth, py, lineWidth, size)
        this.graphics.fill({ color: color })
      }

      // Bottom edge - only draw if there's a floor tile below
      if (this.floorPositions.has(`${x},${y + 1}`)) {
        this.graphics.rect(px, py + size - lineWidth, size, lineWidth)
        this.graphics.fill({ color: color })
      }
    }
  }

  /**
   * Destroy and release resources
   */
  destroy(): void {
    this.graphics.destroy()
  }
}
