import { Texture } from 'pixi.js'

export class TerrainAssetLoader {
  private static textures: Record<string, Texture[]> = {}

  public static register(type: string, texture: Texture): void {
    if (!this.textures[type]) {
      this.textures[type] = []
    }
    this.textures[type].push(texture)
  }

  public static async loadAll(): Promise<void> {
    // Determine what to load here - for now it can be a no-op or load placeholders
    return Promise.resolve()
  }

  public static get(type: string): Texture[] {
    return this.textures[type] || []
  }

  public static getRandom(type: string): Texture | null {
    const list = this.textures[type]
    if (!list || list.length === 0) return null
    return list[Math.floor(Math.random() * list.length)]
  }
}
