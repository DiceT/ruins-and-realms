/**
 * Heatmap Layer
 * 
 * Renders tiles colored by their growth order (distance from spine).
 * Cold (blue) = early/close to spine, Hot (red) = late/far from spine
 * Z-Index: 36
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer } from './ILayer'

export interface HeatmapTileData {
  x: number
  y: number
  growthOrder: number
}

export interface HeatmapRenderData {
  tiles: HeatmapTileData[]
  maxGrowthOrder: number
}

export interface HeatmapRenderConfig {
  tileSize: number
  alpha?: number
}

export class HeatmapLayer implements ILayer {
  private _container: Container
  private graphics: Graphics

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

  render(data: HeatmapRenderData, config: HeatmapRenderConfig): void {
    this.clear()

    const { tiles, maxGrowthOrder } = data
    const { tileSize, alpha = 0.5 } = config

    if (maxGrowthOrder === 0) return

    for (const tile of tiles) {
      const { x, y, growthOrder } = tile
      const px = x * tileSize
      const py = y * tileSize

      // Normalize to 0-1
      const t = growthOrder / maxGrowthOrder

      // Heatmap color: blue (cold) -> green -> yellow -> red (hot)
      const color = this.heatmapColor(t)

      this.graphics.rect(px, py, tileSize, tileSize)
      this.graphics.fill({ color, alpha })
    }
  }

  /** Convert 0-1 value to heatmap color (blue -> green -> yellow -> red) */
  private heatmapColor(t: number): number {
    // Clamp
    t = Math.max(0, Math.min(1, t))

    let r: number, g: number, b: number

    if (t < 0.25) {
      // Blue to Cyan
      const s = t / 0.25
      r = 0
      g = Math.floor(255 * s)
      b = 255
    } else if (t < 0.5) {
      // Cyan to Green
      const s = (t - 0.25) / 0.25
      r = 0
      g = 255
      b = Math.floor(255 * (1 - s))
    } else if (t < 0.75) {
      // Green to Yellow
      const s = (t - 0.5) / 0.25
      r = Math.floor(255 * s)
      g = 255
      b = 0
    } else {
      // Yellow to Red
      const s = (t - 0.75) / 0.25
      r = 255
      g = Math.floor(255 * (1 - s))
      b = 0
    }

    return (r << 16) | (g << 8) | b
  }

  destroy(): void {
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
