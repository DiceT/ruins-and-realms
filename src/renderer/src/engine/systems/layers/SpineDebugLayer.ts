/**
 * Spine Debug Layer
 * 
 * Renders the spine path debug overlay for visualization.
 * Z-Index: 80
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { ILayer, TilePosition, Bounds } from './ILayer'

export interface SpineSeedData {
  position: TilePosition
  id: string
  bounds?: Bounds
  sourceSpineTile?: TilePosition
}

export interface SpineDebugRenderData {
  spinePath: TilePosition[]
  ejectedSeeds: SpineSeedData[]
}

export interface SpineDebugRenderConfig {
  tileSize: number
}

export class SpineDebugLayer implements ILayer {
  private _container: Container
  private pathGraphics: Graphics
  private seedGraphics: Graphics
  private labelContainer: Container

  constructor() {
    this._container = new Container()
    this._container.visible = false // Hidden by default
    
    this.pathGraphics = new Graphics()
    this.seedGraphics = new Graphics()
    this.labelContainer = new Container()
    
    this._container.addChild(this.pathGraphics)
    this._container.addChild(this.seedGraphics)
    this._container.addChild(this.labelContainer)
  }

  get container(): Container {
    return this._container
  }

  clear(): void {
    this.pathGraphics.clear()
    this.seedGraphics.clear()
    this.labelContainer.removeChildren()
  }

  setVisible(visible: boolean): void {
    this._container.visible = visible
  }

  render(data: SpineDebugRenderData, config: SpineDebugRenderConfig): void {
    this.clear()

    const { spinePath, ejectedSeeds } = data
    const { tileSize } = config

    // Render spine path (purple)
    if (spinePath.length > 0) {
      for (const tile of spinePath) {
        const px = tile.x * tileSize
        const py = tile.y * tileSize
        this.pathGraphics.rect(px, py, tileSize, tileSize)
        this.pathGraphics.fill({ color: 0x8B00FF, alpha: 0.4 }) // Purple
      }

      // Draw connecting line
      this.pathGraphics.moveTo(
        (spinePath[0].x + 0.5) * tileSize,
        (spinePath[0].y + 0.5) * tileSize
      )
      for (let i = 1; i < spinePath.length; i++) {
        this.pathGraphics.lineTo(
          (spinePath[i].x + 0.5) * tileSize,
          (spinePath[i].y + 0.5) * tileSize
        )
      }
      this.pathGraphics.stroke({ width: 2, color: 0x8B00FF, alpha: 0.8 })
    }

    // Render ejected seeds (orange markers with white-blue border, no labels)
    for (const seed of ejectedSeeds) {
      const cx = (seed.position.x + 0.5) * tileSize
      const cy = (seed.position.y + 0.5) * tileSize

      // Orange circle marker with white-blue (cyan) border
      this.seedGraphics.circle(cx, cy, tileSize * 0.3)
      this.seedGraphics.fill({ color: 0xFFA500, alpha: 0.9 }) // Orange
      this.seedGraphics.stroke({ width: 2, color: 0x87CEEB }) // Light blue/white-blue

      // Draw line from source spine tile to seed (if we have sourceSpineTile)
      if ((seed as any).sourceSpineTile) {
        const source = (seed as any).sourceSpineTile
        const sx = (source.x + 0.5) * tileSize
        const sy = (source.y + 0.5) * tileSize
        this.seedGraphics.moveTo(sx, sy)
        this.seedGraphics.lineTo(cx, cy)
        this.seedGraphics.stroke({ width: 1, color: 0xFFA500, alpha: 0.7 })
      }

      // Draw room bounds if available
      if (seed.bounds) {
        const { x, y, w, h } = seed.bounds
        this.seedGraphics.rect(x * tileSize, y * tileSize, w * tileSize, h * tileSize)
        this.seedGraphics.stroke({ width: 2, color: 0x00FF00, alpha: 0.6 }) // Green bounds
      }
    }
  }

  destroy(): void {
    this.pathGraphics.destroy()
    this.seedGraphics.destroy()
    this.labelContainer.destroy({ children: true })
    this._container.destroy({ children: true })
  }
}
