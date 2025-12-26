import { Assets, Texture } from 'pixi.js'

export class TerrainAssetLoader {
  private static textures: Record<string, Texture[]> = {}
  private static loaded = false

  public static register(type: string, texture: Texture): void {
    if (!this.textures[type]) {
      this.textures[type] = []
    }
    this.textures[type].push(texture)
    this.loaded = true
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
