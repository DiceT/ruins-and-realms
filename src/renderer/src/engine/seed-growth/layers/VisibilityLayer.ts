/**
 * Visibility Layer
 * 
 * Responsible for rendering:
 * 1. Fog of War (Unexplored/Explored areas)
 * 2. Ambient Darkness
 * 3. Dynamic Lighting (LightProfile)
 * 4. Entity/Player visibility
 */

import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import { VisionGrid, VISION_STATE, LightProfile } from '../../data/LightingData'

export interface VisibilityRenderConfig {
  tileSize: number
  showFog: boolean
  showLight: boolean
  showPlayer?: boolean  // Optional, defaults to false
}

export class VisibilityLayer {
  private container: Container
  
  // Sub-layers
  private fogLayer: Container
  private darknessLayer: Graphics
  private lightLayer: Sprite
  private entityLayer: Container
  
  private playerSprite: Graphics
  private fogGraphics: Graphics
  
  // Caches
  private lightTextureCache: Map<string, Texture> = new Map()
  
  constructor() {
    this.container = new Container()
    
    // In DungeonViewRenderer, order was: Light -> Grid -> Fog -> Darkness -> Entity
    // We will mimic that relative order as closely as possible in this grouped layer.
    
    this.lightLayer = new Sprite(Texture.WHITE)
    this.lightLayer.blendMode = 'screen'
    this.container.addChild(this.lightLayer)
    
    this.fogLayer = new Container()
    this.fogLayer.blendMode = 'normal'
    this.container.addChild(this.fogLayer)
    
    this.fogGraphics = new Graphics()
    this.fogLayer.addChild(this.fogGraphics)
    
    this.darknessLayer = new Graphics()
    this.darknessLayer.blendMode = 'multiply'
    this.container.addChild(this.darknessLayer)
    
    this.entityLayer = new Container()
    this.playerSprite = new Graphics()
    this.entityLayer.addChild(this.playerSprite)
    this.entityLayer.visible = false  // Hidden by default
    this.container.addChild(this.entityLayer)
  }
  
  get containerNode(): Container {
    return this.container
  }
  
  /**
   * Specific layer accessors for interleaving if needed by parent
   */
  get lightNode(): Sprite { return this.lightLayer }
  get fogNode(): Container { return this.fogLayer }
  get darknessNode(): Graphics { return this.darknessLayer }
  get entityNode(): Container { return this.entityLayer }

  /**
   * Update all visibility graphics
   */
  update(
    gridWidth: number,
    gridHeight: number,
    visionGrid: VisionGrid,
    playerX: number,
    playerY: number,
    lightProfile: LightProfile,
    config: VisibilityRenderConfig
  ): void {
    const { tileSize, showFog, showLight, showPlayer = false } = config
    
    // Entity layer visibility
    this.entityLayer.visible = showPlayer

    console.log(`[VisibilityLayer] Update: Fog=${showFog}, Light=${showLight}, Player=${showPlayer}, GridSize=${gridWidth}x${gridHeight}`)
    
    // 1. FOG & DARKNESS - ALWAYS RENDER (visibility controlled by container)
    this.fogGraphics.clear()
    
    // Always draw fog graphics so they're ready when layer is toggled visible
    console.log(`[VisibilityLayer] Drawing Fog. Grid: ${gridWidth}x${gridHeight}, TileSize: ${tileSize}. State 0: ${visionGrid[0]}`)
    // Draw "Border" Fog (Infinite Blackness outside the grid)
    const gloomSize = 10000 
    const totalW = gridWidth * tileSize
    const totalH = gridHeight * tileSize

    this.fogGraphics.rect(-gloomSize, -gloomSize, totalW + gloomSize * 2, gloomSize).fill({ color: 0x000000, alpha: 1.0 })
    this.fogGraphics.rect(-gloomSize, totalH, totalW + gloomSize * 2, gloomSize).fill({ color: 0x000000, alpha: 1.0 })
    this.fogGraphics.rect(-gloomSize, 0, gloomSize, totalH).fill({ color: 0x000000, alpha: 1.0 })
    this.fogGraphics.rect(totalW, 0, gloomSize, totalH).fill({ color: 0x000000, alpha: 1.0 })

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

    // 2. PLAYER - ALWAYS RENDER (visibility controlled by container)
    if (this.playerSprite) {
        const cx = (playerX + 0.5) * tileSize
        const cy = (playerY + 0.5) * tileSize
        const r = tileSize * 0.4
        this.playerSprite.clear()
        this.playerSprite.circle(cx, cy, r).fill(0xFFA500).stroke({ width: 2, color: 0xFFFFFF })
    }
    
    // 3. LIGHTING - ALWAYS RENDER (visibility controlled by container)
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
  }

  /**
   * Fast toggle for visibility flags without re-computing grid
   */
  setVisibility(showFog: boolean, showLight: boolean): void {
      this.fogLayer.visible = showFog
      this.darknessLayer.visible = showLight
      this.lightLayer.visible = showLight
  }

  /**
   * Generate cached light texture
   */
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
          
          // Adjustable Warm Colors
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
    this.container.destroy({ children: true })
  }
}
