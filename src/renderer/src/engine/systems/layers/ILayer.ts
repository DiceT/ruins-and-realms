/**
 * Layer Interface
 * 
 * Standard contract for all visual layers in the dungeon rendering system.
 * Layers are pure PixiJS containers with no game logic dependencies.
 */

import { Container } from 'pixi.js'

/**
 * Layer groupings for batch operations
 */
export type LayerGroup = 'base' | 'gameplay' | 'visibility' | 'debug' | 'ui'

/**
 * Configuration for registering a layer with LayerManager
 */
export interface ILayerConfig {
  zIndex: number
  visible?: boolean
  group?: LayerGroup
}

/**
 * Standard layer interface
 * 
 * All layers must implement this interface to ensure consistent
 * lifecycle management and container access.
 */
export interface ILayer {
  /**
   * The PixiJS container for this layer.
   * This is added to the scene graph by LayerManager.
   */
  readonly container: Container
  
  /**
   * Clear all graphics/children in this layer.
   * Called before re-rendering.
   */
  clear(): void
  
  /**
   * Destroy the layer and release all resources.
   * Called when the renderer is destroyed.
   */
  destroy(): void
}

/**
 * Render data types - pure data with no game logic references
 */

export interface TilePosition {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export interface RoomRenderData {
  id: string
  bounds: Bounds
  tiles: TilePosition[]
  isCircular?: boolean
  area: number
}

export interface ThemeColors {
  background: number
  floor: { color: number }
  walls: { color: number; width?: number; roughness?: number }
  shadow?: { color: number; x: number; y: number }
}
