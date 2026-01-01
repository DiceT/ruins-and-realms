/**
 * Wall Layer
 * 
 * Responsible for rendering wall tiles around rooms and corridors.
 * Also handles shadow rendering beneath walls.
 * Extracted from DungeonViewRenderer for modularity.
 */

import { Graphics } from 'pixi.js'
import { Room } from '../types'
import { RoomLayerConfig } from '../../themes/ThemeTypes'

export interface WallRenderData {
  rooms: Room[]
  corridorTiles: { x: number; y: number }[]
  gridWidth: number
  gridHeight: number
}

export interface WallRenderConfig {
  tileSize: number
  theme: RoomLayerConfig
}

/**
 * Renders wall tiles and shadows around dungeon floor areas
 */
export class WallLayer {
  private wallGraphics: Graphics
  private shadowGraphics: Graphics

  constructor() {
    this.wallGraphics = new Graphics()
    this.shadowGraphics = new Graphics()
  }

  /**
   * Get the wall Graphics container
   */
  get container(): Graphics {
    return this.wallGraphics
  }

  /**
   * Get the shadow Graphics container (should be added BEFORE walls in layer order)
   */
  get shadowContainer(): Graphics {
    return this.shadowGraphics
  }

  /**
   * Clear all wall and shadow rendering
   */
  clear(): void {
    this.wallGraphics.clear()
    this.shadowGraphics.clear()
  }

  /**
   * Render walls around all floor tiles and optionally shadows
   * Returns the set of wall positions for external use
   */
  render(data: WallRenderData, config: WallRenderConfig): Set<string> {
    this.clear()

    const { rooms, corridorTiles, gridWidth, gridHeight } = data
    const { tileSize, theme } = config

    // Build floor set from rooms + corridors
    const floorSet = this.buildFloorSet(rooms, corridorTiles)

    // Find wall positions (adjacent to floor but not floor)
    const wallSet = this.findWallPositions(floorSet, gridWidth, gridHeight)

    // Render shadows first (under walls)
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

  /**
   * Build a set of all floor positions from rooms and corridors
   */
  private buildFloorSet(rooms: Room[], corridorTiles: { x: number; y: number }[]): Set<string> {
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

  /**
   * Find all tiles adjacent to floor that are not floor themselves
   */
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

        // Relaxed bounds check for expanded border (padding 2)
        if (nx >= -2 && nx < gridWidth + 2 && ny >= -2 && ny < gridHeight + 2) {
          if (!floorSet.has(neighborKey)) {
            wallSet.add(neighborKey)
          }
        }
      }
    }

    return wallSet
  }

  /**
   * Render shadows at offset positions beneath walls
   */
  private renderShadows(wallPositions: Set<string>, tileSize: number, theme: RoomLayerConfig): void {
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

  /**
   * Destroy the layer and release resources
   */
  destroy(): void {
    this.wallGraphics.destroy()
    this.shadowGraphics.destroy()
  }
}
