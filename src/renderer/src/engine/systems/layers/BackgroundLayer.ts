/**
 * Background Layer
 * 
 * Renders the solid background color behind all dungeon elements.
 * Z-Index: 0
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer, ThemeColors } from './ILayer'

export interface BackgroundRenderConfig {
  gridWidth: number
  gridHeight: number
  tileSize: number
  padding?: number
  theme: ThemeColors
}

export class BackgroundLayer implements ILayer {
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

  render(config: BackgroundRenderConfig): void {
    this.clear()
    
    const { gridWidth, gridHeight, tileSize, padding = 2, theme } = config
    
    this.graphics.rect(
      -padding * tileSize,
      -padding * tileSize,
      (gridWidth + padding * 2) * tileSize,
      (gridHeight + padding * 2) * tileSize
    )
    this.graphics.fill({ color: theme.background })
  }

  destroy(): void {
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
