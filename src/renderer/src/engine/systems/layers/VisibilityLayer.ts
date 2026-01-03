/**
 * Visibility Layer
 * 
 * Renders fog of war, dynamic lighting, darkness, and player entity.
 * Contains multiple sub-layers managed internally.
 * Z-Index: 50-60
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { ILayer, TilePosition } from './ILayer'

/**
 * Vision states for fog of war
 */
export const VISION_STATE = {
  UNEXPLORED: 0,
  EXPLORED: 1,
  VISIBLE: 2
} as const

export type VisionGrid = Uint8Array

export interface LightProfile {
  type: string
  brightRadius: number
  dimRadius: number
}

export interface VisibilityRenderConfig {
  tileSize: number
  showFog: boolean
  showLight: boolean
  showPlayer?: boolean
}

export interface VisibilityRenderData {
  gridWidth: number
  gridHeight: number
  visionGrid: VisionGrid
  playerX: number
  playerY: number
  lightProfile: LightProfile
}

export class VisibilityLayer implements ILayer {
  private _container: Container
  
  // Sub-layers (ordered by z-index within this layer)
  private lightLayer: Sprite
  private fogLayer: Container
  private fogGraphics: Graphics
  private darknessLayer: Graphics
  private entityLayer: Container
  private playerSprite: Graphics
  
  // Light texture cache
  private lightTextureCache: Map<string, Texture> = new Map()

  constructor() {
    this._container = new Container()
    
    // Light (screen blend) - z:50
    this.lightLayer = new Sprite(Texture.WHITE)
    this.lightLayer.blendMode = 'screen'
    this.lightLayer.visible = false
    this._container.addChild(this.lightLayer)
    
    // Darkness (multiply blend) - z:52
    this.darknessLayer = new Graphics()
    this.darknessLayer.blendMode = 'multiply'
    this.darknessLayer.visible = false
    this._container.addChild(this.darknessLayer)
    
    // Fog (normal) - z:55
    this.fogLayer = new Container()
    this.fogLayer.visible = false
    this.fogGraphics = new Graphics()
    this.fogLayer.addChild(this.fogGraphics)
    this._container.addChild(this.fogLayer)
    
    // Entity (player) - z:60
    this.entityLayer = new Container()
    this.entityLayer.visible = false
    this.playerSprite = new Graphics()
    this.entityLayer.addChild(this.playerSprite)
    this._container.addChild(this.entityLayer)
  }

  get container(): Container {
    return this._container
  }

  /**
   * Individual sub-layer accessors for LayerManager registration
   */
  get lightNode(): Sprite { return this.lightLayer }
  get fogNode(): Container { return this.fogLayer }
  get darknessNode(): Graphics { return this.darknessLayer }
  get entityNode(): Container { return this.entityLayer }

  clear(): void {
    this.fogGraphics.clear()
    this.darknessLayer.clear()
    this.playerSprite.clear()
  }

  /**
   * Set visibility for sub-layers
   */
  setVisibility(showFog: boolean, showLight: boolean): void {
    this.fogLayer.visible = showFog
    this.lightLayer.visible = showLight
    this.darknessLayer.visible = showLight
  }

  /**
   * Set player visibility
   */
  setPlayerVisible(visible: boolean): void {
    this.entityLayer.visible = visible
  }

  /**
   * Main render/update method
   */
  render(data: VisibilityRenderData, config: VisibilityRenderConfig): void {
    const { gridWidth, gridHeight, visionGrid, playerX, playerY, lightProfile } = data
    const { tileSize, showFog, showLight, showPlayer = false } = config

    // Update sub-layer visibility
    this.entityLayer.visible = showPlayer

    // 1. FOG
    this.fogGraphics.clear()
    
    if (showFog) {
      // Border fog (infinite blackness outside grid)
      const gloomSize = 10000
      const totalW = gridWidth * tileSize
      const totalH = gridHeight * tileSize

      this.fogGraphics.rect(-gloomSize, -gloomSize, totalW + gloomSize * 2, gloomSize).fill({ color: 0x000000, alpha: 1.0 })
      this.fogGraphics.rect(-gloomSize, totalH, totalW + gloomSize * 2, gloomSize).fill({ color: 0x000000, alpha: 1.0 })
      this.fogGraphics.rect(-gloomSize, 0, gloomSize, totalH).fill({ color: 0x000000, alpha: 1.0 })
      this.fogGraphics.rect(totalW, 0, gloomSize, totalH).fill({ color: 0x000000, alpha: 1.0 })

      // Per-tile fog based on vision state
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const idx = y * gridWidth + x
          const state = visionGrid[idx]
          
          const px = x * tileSize
          const py = y * tileSize
          
          if (state === VISION_STATE.VISIBLE) {
            // Visible: Transparent
          } else if (state === VISION_STATE.EXPLORED) {
            // Explored: 75% opacity black
            this.fogGraphics.rect(px, py, tileSize, tileSize).fill({ color: 0x000000, alpha: 0.75 })
          } else {
            // Unexplored: 100% opacity black
            this.fogGraphics.rect(px, py, tileSize, tileSize).fill({ color: 0x000000, alpha: 1.0 })
          }
        }
      }
    }

    // 2. PLAYER
    if (showPlayer) {
      const cx = (playerX + 0.5) * tileSize
      const cy = (playerY + 0.5) * tileSize
      const r = tileSize * 0.4
      this.playerSprite.clear()
      this.playerSprite.circle(cx, cy, r).fill(0xFFA500).stroke({ width: 2, color: 0xFFFFFF })
    } else {
      this.playerSprite.clear()
    }

    // 3. LIGHTING
    if (showLight) {
      let tex = this.lightTextureCache.get(lightProfile.type)
      if (!tex) {
        tex = this.generateLightTexture(lightProfile)
        this.lightTextureCache.set(lightProfile.type, tex)
      }

      this.lightLayer.texture = tex
      this.lightLayer.anchor.set(0.5)
      this.lightLayer.width = lightProfile.dimRadius * 2 * tileSize
      this.lightLayer.height = lightProfile.dimRadius * 2 * tileSize
      this.lightLayer.x = (playerX + 0.5) * tileSize
      this.lightLayer.y = (playerY + 0.5) * tileSize
      this.lightLayer.visible = true
    } else {
      this.lightLayer.visible = false
    }
  }

  private generateLightTexture(profile: LightProfile): Texture {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    if (ctx) {
      const cx = size / 2
      const cy = size / 2
      const r = size / 2

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      const brightRatio = Math.min(1, profile.brightRadius / profile.dimRadius)

      grad.addColorStop(0, 'rgba(255, 240, 200, 1.0)')
      grad.addColorStop(brightRatio, 'rgba(255, 200, 150, 0.6)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')

      ctx.fillStyle = grad
      ctx.fillRect(0, 0, size, size)
    }
    
    return Texture.from(canvas)
  }

  destroy(): void {
    // Clean up textures
    for (const tex of this.lightTextureCache.values()) {
      tex.destroy(true)
    }
    this.lightTextureCache.clear()
    this._container.destroy({ children: true })
  }
}
