/**
 * Wall Layer
 * 
 * Renders wall tiles around rooms/corridors and their shadows.
 * Contains both shadow graphics (z:15) and wall graphics (z:20) in a single container.
 * Z-Index: 15-20
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer, ThemeColors } from './ILayer'

export interface WallRenderData {
  // Pre-computed wall positions (from processors/WallCalculator)
  wallPositions: Set<string>
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
   * Render walls from pre-computed positions
   */
  render(data: WallRenderData, config: WallRenderConfig): void {
    this.clear()

    const { wallPositions } = data
    const { tileSize, theme } = config

    // Render shadows first
    if (theme.shadow) {
      this.renderShadows(wallPositions, tileSize, theme)
    }

    // Render walls
    for (const key of wallPositions) {
      const [x, y] = key.split(',').map(Number)
      this.wallGraphics.rect(x * tileSize, y * tileSize, tileSize, tileSize)
      this.wallGraphics.fill({ color: theme.walls.color })
    }
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
