/**
 * Floor Layer
 * 
 * Renders room and corridor floor tiles.
 * Z-Index: 10
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer, RoomRenderData, TilePosition, ThemeColors } from './ILayer'

export interface FloorRenderData {
  rooms: RoomRenderData[]
  corridorTiles: TilePosition[]
}

export interface FloorRenderConfig {
  tileSize: number
  theme: ThemeColors
}

export class FloorLayer implements ILayer {
  private graphics: Graphics
  private _container: Container

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

  render(data: FloorRenderData, config: FloorRenderConfig): void {
    this.clear()
    
    const { rooms, corridorTiles } = data
    const { tileSize, theme } = config

    // Render room floors
    for (const room of rooms) {
      this.renderRoomFloor(room, tileSize, theme)
    }

    // Render corridor floors
    for (const pos of corridorTiles) {
      this.graphics.rect(pos.x * tileSize, pos.y * tileSize, tileSize - 1, tileSize - 1)
      this.graphics.fill({ color: theme.floor.color })
    }
  }

  private renderRoomFloor(room: RoomRenderData, size: number, theme: ThemeColors): void {
    if (room.isCircular) {
      // Draw wall-colored bounding box first (corners show as walls)
      const { x, y, w, h } = room.bounds
      this.graphics.rect(x * size, y * size, w * size, h * size)
      this.graphics.fill({ color: theme.walls.color })

      // Draw circular room on top
      const centerX = (x + w / 2) * size
      const centerY = (y + h / 2) * size
      const radius = (w / 2) * size

      this.graphics.circle(centerX, centerY, radius)
      this.graphics.fill({ color: theme.floor.color })
    } else {
      // Draw tiles individually (safer for non-rect or 1x1 rooms)
      for (const t of room.tiles) {
        this.graphics.rect(t.x * size, t.y * size, size, size)
        this.graphics.fill({ color: theme.floor.color })
      }
    }
  }

  destroy(): void {
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
