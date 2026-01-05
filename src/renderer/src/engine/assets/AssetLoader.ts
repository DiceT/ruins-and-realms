import { Assets, Texture } from 'pixi.js'
import { MusicSystem } from '../audio/MusicSystem'
import { TerrainAssetLoader } from '../map/TerrainAssetLoader'
import { DungeonAssetLoader } from './DungeonAssetLoader'

// Define modules for glob imports
const overlandTiles = import.meta.glob('@/assets/images/overland-tiles/*/*.png', { eager: true }) as Record<string, { default: string }>
const adventureCards = import.meta.glob('@/assets/images/ui/adventure-cards/*.png', { eager: true }) as Record<string, { default: string }>
const crackedGlasses = import.meta.glob('@/assets/images/ui/cracked-glass/*.png', { eager: true }) as Record<string, { default: string }>
const audioTracks = import.meta.glob('@/assets/audio/music/*.{mp3,wav,ogg}', { eager: true }) as Record<string, { default: string }>
const dungeonIcons = import.meta.glob('@/assets/images/icons/*.svg', { eager: true }) as Record<string, { default: string }>

export class AssetLoader {
  private static totalAssets = 0
  private static loadedAssets = 0
  private static onProgressCallback: ((progress: number, message: string) => void) | null = null

  public static async loadAudio(): Promise<void> {
    // 1. Register Audio Tracks
    console.log('[AssetLoader] Registering Audio...')
    const tracks = Object.keys(audioTracks)
    for (const path of tracks) {
      // Extract filename as ID (e.g. "main-menu-theme")
      const match = path.match(/\/([^/]+)\.(mp3|wav|ogg)$/)
      if (match) {
        const id = match[1] // filename without extension
        const url = audioTracks[path].default
        MusicSystem.registerTrack(id, url)
        console.log(`[AssetLoader] Registered track: ${id}`)
      }
    }
    // We don't strictly "load" HTML5 audio here, registration is enough for immediate streaming.
    // However, if we wanted to use WebAudio decode, we would await here.
  }

  public static async loadGameAssets(onProgress: (p: number, msg: string) => void): Promise<void> {
    this.onProgressCallback = onProgress
    this.totalAssets = 0
    this.loadedAssets = 0

    // Collect all textures to load
    const texturesToLoad: string[] = []

    // Overland
    const terrainManifest: Record<string, string[]> = {}
    for (const path in overlandTiles) {
      const match = path.match(/overland-tiles\/([^/]+)\//)
      if (match) {
        const type = match[1]
        const src = overlandTiles[path].default
        texturesToLoad.push(src)
        
        // Track the type map to register later
        if (!terrainManifest[src]) { // src is unique URL
            // wait, we need to map src to type.
             terrainManifest[src] = [type] // A texture might theoretically belong to multiple? Unlikely.
             // Actually simplest way:
             // Load first. Then register.
             // But we load in batch. 
             // Let's store a map of URL -> Type to use AFTER loading.
        }
      }
    }
    
    // Store type mapping
    const urlToType: Record<string, string> = {}
    for (const path in overlandTiles) {
      const match = path.match(/overland-tiles\/([^/]+)\//)
      if (match) {
        urlToType[overlandTiles[path].default] = match[1]
      }
    }

    // Cards
    for (const path in adventureCards) texturesToLoad.push(adventureCards[path].default)
    for (const path in crackedGlasses) texturesToLoad.push(crackedGlasses[path].default)

    // Dungeon Icons (doors, stairs, etc.)
    const iconUrlToType: Record<string, string> = {}
    for (const path in dungeonIcons) {
      const match = path.match(/\/([^/]+)\.svg$/)
      if (match) {
        const type = match[1] // e.g., "door", "door-locked", "stairs"
        const src = dungeonIcons[path].default
        texturesToLoad.push(src)
        iconUrlToType[src] = type
      }
    }

    this.totalAssets = texturesToLoad.length
    console.log(`[AssetLoader] Loading ${this.totalAssets} assets...`)

    // Load in batches to allow UI updates
    const BATCH_SIZE = 10
    for (let i = 0; i < texturesToLoad.length; i += BATCH_SIZE) {
      const batch = texturesToLoad.slice(i, i + BATCH_SIZE)
      // Load
      const loadedTextures = await Promise.all(batch.map(src => Assets.load<Texture>(src)))
      
      // Register with appropriate loaders
      for (let j = 0; j < batch.length; j++) {
        const src = batch[j]
        const tex = loadedTextures[j]
        
        // Optimize: Set pixel art scaling here globally
        tex.source.scaleMode = 'nearest'
        
        // Terrain assets
        if (urlToType[src]) {
             TerrainAssetLoader.register(urlToType[src], tex)
        }
        
        // Dungeon icon assets
        if (iconUrlToType[src]) {
             DungeonAssetLoader.register(iconUrlToType[src], tex)
        }
      }
      
      this.loadedAssets += batch.length
      const progress = Math.min(1.0, this.loadedAssets / this.totalAssets)
      this.onProgressCallback?.(progress, `Loading assets... ${Math.floor(progress * 100)}%`)
      
      // Small tick to let UI breathe
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // Mark dungeon assets as loaded
    DungeonAssetLoader.setLoaded()
    
    console.log('[AssetLoader] Complete.')
  }
  public static getAdventureCards(): string[] {
    return Object.values(adventureCards).map((m) => m.default)
  }

  public static getCrackedGlasses(): string[] {
    return Object.values(crackedGlasses).map((m) => m.default)
  }
}
