/**
 * Grid Layer
 * 
 * Renders grid lines overlay on the dungeon.
 * Lines are adaptive to zoom level for performance.
 * Z-Index: 40
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer, RoomRenderData, TilePosition, ThemeColors } from './ILayer'

export interface GridRenderData {
  rooms: RoomRenderData[]
  corridorTiles: TilePosition[]
}

export interface GridRenderConfig {
  tileSize: number
  theme: ThemeColors
  zoom?: number
}

export class GridLayer implements ILayer {
  private _container: Container
  private graphics: Graphics
  private currentZoom: number = 1

  constructor() {
    this._container = new Container()
    this.graphics = new Graphics()
    this._container.addChild(this.graphics)
  }

  get container(): Container {
    return this._container
  }

  clear(): void {
    this.graphics.clear()
  }

  /**
   * Update zoom level for adaptive grid rendering
   */
  updateZoom(zoom: number): void {
    this.currentZoom = zoom
    // Grid density could be adjusted here based on zoom
    // At low zoom, we could skip every other line, etc.
  }

  render(data: GridRenderData, config: GridRenderConfig): void {
    this.clear()

    const { rooms, corridorTiles } = data
    const { tileSize, zoom = 1 } = config

    this.currentZoom = zoom

    // Build floor set for grid bounds
    const positions = new Set<string>()
    
    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          positions.add(`${x + dx},${y + dy}`)
        }
      }
    }

    for (const pos of corridorTiles) {
      positions.add(`${pos.x},${pos.y}`)
    }

    // Grid color - subtle darker shade
    const gridColor = 0x000000
    const gridAlpha = 0.1

    // Draw grid lines
    for (const key of positions) {
      const [x, y] = key.split(',').map(Number)
      const px = x * tileSize
      const py = y * tileSize

      // Right edge
      this.graphics.moveTo(px + tileSize, py)
      this.graphics.lineTo(px + tileSize, py + tileSize)
      
      // Bottom edge
      this.graphics.moveTo(px, py + tileSize)
      this.graphics.lineTo(px + tileSize, py + tileSize)
    }

    this.graphics.stroke({ width: 1, color: gridColor, alpha: gridAlpha })
  }

  destroy(): void {
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
