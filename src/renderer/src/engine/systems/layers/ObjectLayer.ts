/**
 * Object Layer
 * 
 * Renders dungeon objects (doors, traps, chests, etc.) using sprites.
 * Falls back to colored rectangles if sprites not loaded.
 * Z-Index: 30
 */

import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { ILayer, TilePosition } from './ILayer'
import { DungeonAssetLoader } from '../../assets/DungeonAssetLoader'

export interface ObjectRenderData {
  type: string
  position: TilePosition
  rotation?: number
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
  private sprites: Sprite[] = []

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
    // Remove all sprites
    for (const sprite of this.sprites) {
      sprite.destroy()
    }
    this.sprites = []
    // Remove text labels
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
    const { type, position, rotation = 0 } = obj
    const px = position.x * size
    const py = position.y * size

    // Map object types to texture names
    const textureKey = this.getTextureKey(type)
    const texture = DungeonAssetLoader.get(textureKey)

    if (texture) {
      // Use sprite
      const sprite = new Sprite(texture)
      sprite.x = px
      sprite.y = py
      sprite.width = size
      sprite.height = size
      
      // Handle rotation (90 degrees for vertical doors)
      if (rotation !== 0) {
        sprite.anchor.set(0.5)
        sprite.x = px + size / 2
        sprite.y = py + size / 2
        sprite.rotation = (rotation * Math.PI) / 180
      }
      
      this._container.addChild(sprite)
      this.sprites.push(sprite)
    } else {
      // Fallback to colored rectangles
      this.renderFallback(type, px, py, size)
    }
  }

  /**
   * Map object type to texture asset name
   */
  private getTextureKey(type: string): string {
    // Handle door types
    if (type === 'door') return 'door'
    if (type === 'door-locked') return 'door-locked'
    if (type === 'door-barred') return 'door-barred'
    if (type === 'door-archway') return 'door-archway'
    if (type === 'door-portcullis') return 'door-portcullis'
    if (type === 'door-secret') return 'door-secret'
    
    // Handle stairs
    if (type === 'stairs_up' || type === 'stairs_down' || type === 'stairs') return 'stairs'
    
    // Default: use type as-is
    return type
  }

  /**
   * Fallback rendering using graphics (colored shapes)
   */
  private renderFallback(type: string, px: number, py: number, size: number): void {
    // Handle door variations
    if (type.startsWith('door')) {
      this.graphics.rect(px + 2, py + 2, size - 4, size - 4)
      this.graphics.fill({ color: 0x8B4513 }) // Brown
      return
    }

    // Handle stairs variations
    if (type.startsWith('stairs')) {
      this.graphics.rect(px + 2, py + 2, size - 4, size - 4)
      this.graphics.fill({ color: type === 'stairs_up' ? 0x00AA00 : 0xAA0000 })
      return
    }

    switch (type) {
      case 'trap':
        this.graphics.moveTo(px + 2, py + 2)
        this.graphics.lineTo(px + size - 2, py + size - 2)
        this.graphics.moveTo(px + size - 2, py + 2)
        this.graphics.lineTo(px + 2, py + size - 2)
        this.graphics.stroke({ width: 2, color: 0xFF0000 })
        break

      case 'chest':
        this.graphics.rect(px + 3, py + 3, size - 6, size - 6)
        this.graphics.fill({ color: 0xFFD700 })
        break

      default:
        this.graphics.circle(px + size / 2, py + size / 2, size / 4)
        this.graphics.fill({ color: 0x888888 })
    }
  }

  destroy(): void {
    this.clear()
    this.graphics.destroy()
    this._container.destroy({ children: true })
  }
}
