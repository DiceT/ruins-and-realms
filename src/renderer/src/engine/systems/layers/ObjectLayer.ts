/**
 * Object Layer
 * 
 * Renders dungeon objects (doors, traps, chests, etc.)
 * Z-Index: 30
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { ILayer, TilePosition } from './ILayer'

export interface ObjectRenderData {
  type: string
  position: TilePosition
  properties?: Record<string, unknown>
}

export interface ObjectLayerData {
  objects: ObjectRenderData[]
}

export interface ObjectRenderConfig {
  tileSize: number
}

export class ObjectLayer implements ILayer {
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
    // Remove text labels but keep graphics
    const children = [...this._container.children]
    for (const child of children) {
      if (child instanceof Text) {
        child.destroy()
      }
    }
  }

  render(data: ObjectLayerData, config: ObjectRenderConfig): void {
    this.clear()

    const { objects } = data
    const { tileSize } = config

    for (const obj of objects) {
      this.renderObject(obj, tileSize)
    }
  }

  private renderObject(obj: ObjectRenderData, size: number): void {
    const { type, position } = obj
    const px = position.x * size
    const py = position.y * size

    // Handle door variations (door_north, door_south, etc.)
    if (type.startsWith('door')) {
      // Simple door marker - brown square
      this.graphics.rect(px + 2, py + 2, size - 4, size - 4)
      this.graphics.fill({ color: 0x8B4513 }) // Brown
      return
    }

    // Handle stairs variations
    if (type.startsWith('stairs')) {
      // Gray stairs marker
      this.graphics.rect(px + 2, py + 2, size - 4, size - 4)
      this.graphics.fill({ color: type === 'stairs_up' ? 0x00AA00 : 0xAA0000 })
      return
    }

    switch (type) {
      case 'trap':
        // Red X marker
        this.graphics.moveTo(px + 2, py + 2)
        this.graphics.lineTo(px + size - 2, py + size - 2)
        this.graphics.moveTo(px + size - 2, py + 2)
        this.graphics.lineTo(px + 2, py + size - 2)
        this.graphics.stroke({ width: 2, color: 0xFF0000 })
        break

      case 'chest':
        // Yellow square
        this.graphics.rect(px + 3, py + 3, size - 6, size - 6)
        this.graphics.fill({ color: 0xFFD700 })
        break

      default:
        // Generic marker
        this.graphics.circle(px + size / 2, py + size / 2, size / 4)
        this.graphics.fill({ color: 0x888888 })
    }
  }

  destroy(): void {
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
