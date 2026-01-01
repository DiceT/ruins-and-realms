/**
 * Object Layer
 * 
 * Responsible for rendering dungeon objects (doors, stairs, decorations).
 * Extracted from DungeonViewRenderer for modularity.
 */

import { Container, Sprite, Assets } from 'pixi.js'
import { DungeonObject } from '../types'

import stairsIcon from '../../../assets/images/icons/stairs.svg'
import doorIcon from '../../../assets/images/icons/door.svg'
import doorSecretIcon from '../../../assets/images/icons/door-secret.svg'
import doorArchwayIcon from '../../../assets/images/icons/door-archway.svg'
import doorLockedIcon from '../../../assets/images/icons/door-locked.svg'
import doorPortcullisIcon from '../../../assets/images/icons/door-portcullis.svg'
import doorBarredIcon from '../../../assets/images/icons/door-barred.svg'

export interface ObjectRenderData {
  objects: DungeonObject[]
}

export interface ObjectRenderConfig {
  tileSize: number
}

/**
 * Renders objects like doors and stairs
 */
export class ObjectLayer {
  private container: Container

  constructor() {
    this.container = new Container()
  }

  /**
   * Get the underlying Container
   */
  get containerNode(): Container {
    return this.container
  }

  /**
   * Clear all objects
   */
  clear(): void {
    this.container.removeChildren()
  }

  /**
   * Render all objects
   */
  render(data: ObjectRenderData, config: ObjectRenderConfig): void {
    this.clear()
    
    const { objects } = data
    const { tileSize } = config

    for (const obj of objects) {
      if (obj.type === 'stairs_up') {
        this.renderStairs(obj, tileSize)
      }
      else if (obj.type.startsWith('door')) {
        this.renderDoor(obj, tileSize)
      }
    }
  }

  /**
   * Render stairs object
   */
  private renderStairs(obj: DungeonObject, size: number): void {
    const sprite = new Sprite()
    sprite.x = obj.x * size
    sprite.y = obj.y * size
    sprite.width = size
    sprite.height = size
    this.container.addChild(sprite)

    Assets.load(stairsIcon).then((texture) => {
      if (sprite.destroyed) return
      sprite.texture = texture
      sprite.width = size
      sprite.height = size
    }).catch(err => {
      console.error('Failed to load stairs icon', err)
    })
  }

  /**
   * Render door object
   */
  private renderDoor(obj: DungeonObject, size: number): void {
    const sprite = new Sprite()
    // Center anchor for rotation
    sprite.anchor.set(0.5)
    sprite.x = (obj.x + 0.5) * size
    sprite.y = (obj.y + 0.5) * size
    sprite.width = size
    sprite.height = size
    sprite.angle = obj.rotation || 0
    
    this.container.addChild(sprite)
    
    let iconPath = doorIcon
    switch (obj.type) {
      case 'door-secret': iconPath = doorSecretIcon; break;
      case 'door-archway': iconPath = doorArchwayIcon; break;
      case 'door-locked': iconPath = doorLockedIcon; break;
      case 'door-portcullis': iconPath = doorPortcullisIcon; break;
      case 'door-barred': iconPath = doorBarredIcon; break;
    }

    Assets.load(iconPath).then((texture) => {
      if (sprite.destroyed) return
      sprite.texture = texture
      sprite.width = size
      sprite.height = size
    }).catch(err => {
      console.error('Failed to load door icon', obj.type, err)
    })
  }

  /**
   * Destroy and release resources
   */
  destroy(): void {
    this.container.destroy({ children: true })
  }
}
