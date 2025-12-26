import { Assets, Texture } from 'pixi.js'

export class TerrainAssetLoader {
  private static textures: Record<string, Texture[]> = {}
  private static loaded = false

  public static async loadAll(): Promise<void> {
    if (this.loaded) return

    // Use Vite glob import to get all images
    // Note: We scan all subdirectories
    const modules = import.meta.glob<{ default: string }>(
      '../../assets/images/overland-tiles/*/*.png',
      { eager: true }
    )

    // Organize by folder name
    for (const path in modules) {
      // Path format: ../../assets/images/overland-tiles/{type}/{filename}.png
      const match = path.match(/overland-tiles\/([^/]+)\//)
      if (match) {
        const type = match[1]
        const src = modules[path].default

        // Load into Pixi Assets (or just use the URL if we prefer lazy loading, but let's preload for smoothness)
        // For simplicity with Pixi v8, we can use Assets.load() but doing it for 280 files might be heavy.
        // Let's store the URLs and load on demand OR load as Texture immediately if eager.
        // Given the requirement "all of the tiles should be loaded in as an array", let's create Textures.

        // Actually, creating 280 Texture objects is cheap. Loading the JS Image is the heavy part.
        // import.meta.glob with 'eager' gives us the URL.
        // We'll use Assets.load to get the Texture.
        // To avoid blocking start notification too long, we can do this in background or batch it.
        // For now, let's just collect the URLs and add a load method that fetches them.

        if (!this.textures[type]) {
          this.textures[type] = []
        }

        // We will load the texture via Assets
        const texture = await Assets.load<Texture>(src)
        texture.source.scaleMode = 'nearest' // Pixel art style usually
        this.textures[type].push(texture)
      }
    }

    this.loaded = true
    console.log(
      '[TerrainAssetLoader] Loaded terrain assets:',
      Object.keys(this.textures).map((k) => `${k}: ${this.textures[k].length}`)
    )
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
