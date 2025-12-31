import { Container, DisplacementFilter, Sprite } from 'pixi.js'
import { createNoiseTexture } from '../utils/rendering'

export type ShaderType = 'dungeon'

/**
 * ShaderManager - Applies visual effects to dungeon view
 * Uses DisplacementFilter for roughness/distortion effect (from plough-map-engine)
 */
export class ShaderManager {
  private container: Container | null = null
  private noiseSprite: Sprite | null = null
  private displacementFilter: DisplacementFilter | null = null
  public activeShaders: Set<ShaderType> = new Set()

  constructor() {}

  public attach(container: Container) {
    this.container = container
    
    // Create noise sprite for displacement effect
    if (!this.noiseSprite) {
      const noiseTexture = createNoiseTexture(64)
      this.noiseSprite = new Sprite(noiseTexture)
      this.noiseSprite.scale.set(20)
      this.noiseSprite.texture.source.style.addressMode = 'repeat'
      this.noiseSprite.renderable = false
      container.addChild(this.noiseSprite)
    }
    
    this.reapplyFilters()
  }

  public enable(type: ShaderType) {
    if (!this.activeShaders.has(type)) {
      console.log(`[ShaderManager] Enabling ${type}`)
      this.activeShaders.add(type)
      this.reapplyFilters()
    }
  }

  public disable(type: ShaderType) {
    if (this.activeShaders.has(type)) {
      console.log(`[ShaderManager] Disabling ${type}`)
      this.activeShaders.delete(type)
      this.reapplyFilters()
    }
  }

  public toggle(type: ShaderType, force?: boolean) {
    const shouldEnable = force !== undefined ? force : !this.activeShaders.has(type)
    console.log(`[ShaderManager] Toggling ${type} to ${shouldEnable}`)
    if (shouldEnable) {
      this.enable(type)
    } else {
      this.disable(type)
    }
  }

  public isActive(type: ShaderType): boolean {
    return this.activeShaders.has(type)
  }

  private reapplyFilters() {
    if (!this.container || !this.noiseSprite) return

    if (this.activeShaders.has('dungeon')) {
      // Create DisplacementFilter with roughness=1 (scale=4) like Dungeon theme
      if (!this.displacementFilter) {
        this.displacementFilter = new DisplacementFilter({
          sprite: this.noiseSprite,
          scale: 4 // roughness * 4 where roughness = 1
        })
        this.displacementFilter.padding = 24 // width (4) + 20
      }
      this.container.filters = [this.displacementFilter]
    } else {
      this.container.filters = []
    }
  }

  public destroy() {
    if (this.noiseSprite) {
      this.noiseSprite.destroy()
      this.noiseSprite = null
    }
    this.displacementFilter = null
  }
}
