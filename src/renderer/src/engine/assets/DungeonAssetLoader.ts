/**
 * DungeonAssetLoader
 * 
 * Static registry for dungeon object textures (doors, stairs, traps, etc.)
 * Similar pattern to TerrainAssetLoader.
 */

import { Texture } from 'pixi.js'

export class DungeonAssetLoader {
  // Map of object type -> texture
  private static textures = new Map<string, Texture>()
  private static loaded = false

  /**
   * Register a texture for a dungeon object type
   */
  public static register(type: string, texture: Texture): void {
    this.textures.set(type, texture)
  }

  /**
   * Get texture by exact type match
   */
  public static get(type: string): Texture | null {
    return this.textures.get(type) || null
  }

  /**
   * Check if textures have been loaded
   */
  public static isLoaded(): boolean {
    return this.loaded
  }

  /**
   * Mark as loaded (called after AssetLoader finishes loading icons)
   */
  public static setLoaded(): void {
    this.loaded = true
    console.log('[DungeonAssetLoader] Loaded', this.textures.size, 'textures')
  }

  /**
   * Get all registered types
   */
  public static getTypes(): string[] {
    return [...this.textures.keys()]
  }
}
