/**
 * Wall Layer
 * 
 * Renders wall tiles around rooms/corridors and their shadows.
 * Contains both shadow graphics (z:15) and wall graphics (z:20) in a single container.
 * Z-Index: 15-20
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer, RoomRenderData, TilePosition, ThemeColors } from './ILayer'

export interface WallRenderData {
  rooms: RoomRenderData[]
  corridorTiles: TilePosition[]
  gridWidth: number
  gridHeight: number
}

export interface WallRenderConfig {
  tileSize: number
  theme: ThemeColors
}

export class WallLayer implements ILayer {
  private _container: Container
  private shadowGraphics: Graphics
  private wallGraphics: Graphics

  constructor() {
    this._container = new Container()
    
    // Shadow goes below walls
    this.shadowGraphics = new Graphics()
    this._container.addChild(this.shadowGraphics)
    
    // Walls on top
    this.wallGraphics = new Graphics()
    this._container.addChild(this.wallGraphics)
  }

  get container(): Container {
    return this._container
  }

  clear(): void {
    this.shadowGraphics.clear()
    this.wallGraphics.clear()
  }

  /**
   * Render walls around all floor tiles
   * @returns Set of wall positions for external use (e.g., collision)
   */
  render(data: WallRenderData, config: WallRenderConfig): Set<string> {
    this.clear()

    const { rooms, corridorTiles, gridWidth, gridHeight } = data
    const { tileSize, theme } = config

    // Build floor set from rooms + corridors
    const floorSet = this.buildFloorSet(rooms, corridorTiles)

    // Find wall positions (adjacent to floor but not floor)
    const wallSet = this.findWallPositions(floorSet, gridWidth, gridHeight)

    // Render shadows first
    if (theme.shadow) {
      this.renderShadows(wallSet, tileSize, theme)
    }

    // Render walls
    for (const key of wallSet) {
      const [x, y] = key.split(',').map(Number)
      this.wallGraphics.rect(x * tileSize, y * tileSize, tileSize, tileSize)
      this.wallGraphics.fill({ color: theme.walls.color })
    }

    return wallSet
  }

  private buildFloorSet(rooms: RoomRenderData[], corridorTiles: TilePosition[]): Set<string> {
    const floorSet = new Set<string>()

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          floorSet.add(`${x + dx},${y + dy}`)
        }
      }
    }

    for (const pos of corridorTiles) {
      floorSet.add(`${pos.x},${pos.y}`)
    }

    return floorSet
  }

  private findWallPositions(floorSet: Set<string>, gridWidth: number, gridHeight: number): Set<string> {
    const wallSet = new Set<string>()
    const neighbors = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ]

    for (const key of floorSet) {
      const [x, y] = key.split(',').map(Number)

      for (const [dx, dy] of neighbors) {
        const nx = x + dx
        const ny = y + dy
        const neighborKey = `${nx},${ny}`

        // Relaxed bounds for border padding
        if (nx >= -2 && nx < gridWidth + 2 && ny >= -2 && ny < gridHeight + 2) {
          if (!floorSet.has(neighborKey)) {
            wallSet.add(neighborKey)
          }
        }
      }
    }

    return wallSet
  }

  private renderShadows(wallPositions: Set<string>, tileSize: number, theme: ThemeColors): void {
    if (!theme.shadow) return

    const { color, x: offX, y: offY } = theme.shadow

    for (const key of wallPositions) {
      const [x, y] = key.split(',').map(Number)
      this.shadowGraphics.rect(
        x * tileSize + offX,
        y * tileSize + offY,
        tileSize,
        tileSize
      )
    }
    this.shadowGraphics.fill({ color: color, alpha: 0.5 })
  }

  destroy(): void {
    this.shadowGraphics.destroy()
    this.wallGraphics.destroy()
    this._container.destroy({ children: true })
  }
}
