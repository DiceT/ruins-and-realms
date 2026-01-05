/**
 * Walkmap Layer
 * 
 * Renders a semi-transparent overlay showing walkable tiles.
 * Green tiles = walkable (rooms, corridors, doors)
 * Z-Index: 35
 */

import { Container, Graphics } from 'pixi.js'
import { ILayer } from './ILayer'

export interface WalkmapRenderData {
  walkableSet: Set<string>  // "x,y" keys
  gridWidth: number
  gridHeight: number
}

export interface WalkmapRenderConfig {
  tileSize: number
  alpha?: number
}

export class WalkmapLayer implements ILayer {
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

  render(data: WalkmapRenderData, config: WalkmapRenderConfig): void {
    this.clear()

    const { walkableSet } = data
    const { tileSize, alpha = 0.3 } = config

    // Walkable color - green tint
    const walkableColor = 0x00ff00

    for (const key of walkableSet) {
      const [x, y] = key.split(',').map(Number)
      const px = x * tileSize
      const py = y * tileSize

      this.graphics.rect(px, py, tileSize, tileSize)
    }

    this.graphics.fill({ color: walkableColor, alpha })
  }

  destroy(): void {
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
