import { Container } from 'pixi.js'

export type LayerKey = 'background' | 'floor' | 'wall' | 'shadow' | 'object' | 'grid' | 'fog' | 'light' | 'darkness' | 'entity' | 'debug' | 'spineDebug' | 'label' | 'overlay'

export interface LayerConfig {
  zIndex: number
  visible?: boolean
  group?: string // e.g., 'debug', 'gameplay', 'lighting'
}

interface LayerEntry {
  container: Container
  config: LayerConfig
}

export class LayerManager {
  private container: Container
  public layers: Map<string, LayerEntry> = new Map()

  constructor(rootContainer: Container) {
    this.container = rootContainer
    // Ensure sorting is enabled (PixiJS v7+ respects zIndex when sortableChildren is true)
    this.container.sortableChildren = true
  }

  /**
   * Register a new layer
   * Automatically adds the container to the root if not already added.
   * If the container was child of another, it reparents it (flattening).
   */
  public register(key: string, container: Container, config: LayerConfig): void {
    container.zIndex = config.zIndex
    container.visible = config.visible ?? true
    
    // Add to map
    this.layers.set(key, { container, config })
    
    // Add to scene graph (Reparent if necessary)
    if (container.parent !== this.container) {
       this.container.addChild(container)
    }
  }

  /**
   * Get a layer container by key
   */
  public get(key: string): Container | undefined {
    return this.layers.get(key)?.container
  }

  /**
   * Toggle visibility of a specific layer
   * @param visible: if provided, sets to specific state. if undefined, toggles current state.
   */
  public toggle(key: string, visible?: boolean): void {
    const layer = this.layers.get(key)
    if (layer) {
      const newState = visible ?? !layer.container.visible
      console.log(`[LayerManager] Toggling ${key}: ${layer.container.visible} -> ${newState} (Z:${layer.config.zIndex})`)
      layer.container.visible = newState
      layer.config.visible = newState // Update config to match
    } else {
      console.warn(`[LayerManager] Toggle failed: Layer '${key}' not found`)
    }
  }

  /**
   * Toggle visibility for an entire group of layers
   */
  public toggleGroup(group: string, visible: boolean): void {
    for (const [key, layer] of this.layers.entries()) {
      if (layer.config.group === group) {
        layer.container.visible = visible
        layer.config.visible = visible
      }
    }
  }

  /**
   * Check if a layer is visible
   */
  public isVisible(key: string): boolean {
    return this.layers.get(key)?.container.visible ?? false
  }

  /**
   * Clear all children from all layers (helper for resetting view)
   */
  public clearAll(): void {
    for (const layer of this.layers.values()) {
      layer.container.removeChildren()
    }
  }

  /**
   * Destroy all layers and the manager
   */
  public destroy(): void {
    this.layers.clear()
    this.container.removeChildren()
  }
}
