/**
 * useVisibilityLayer Hook
 * 
 * Manages the VisibilityLayer class lifecycle within React.
 * Handles fog of war, dynamic lighting, darkness, and player entity.
 * This is the most complex layer with multiple internal sub-layers.
 * 
 * @example
 * const { container, layer } = useVisibilityLayer(
 *   { gridWidth, gridHeight, visionGrid, playerX, playerY, lightProfile },
 *   { tileSize: 8, showFog: true, showLight: true, showPlayer: true }
 * )
 * // Access sub-layers via layer.lightNode, layer.fogNode, etc.
 */

import { useEffect, useRef, useMemo } from 'react'
import { Container } from 'pixi.js'
import { 
  VisibilityLayer, 
  VisibilityRenderData, 
  VisibilityRenderConfig 
} from '@/engine/systems/layers/VisibilityLayer'

export interface UseVisibilityLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance (for sub-layer nodes and visibility control) */
  layer: VisibilityLayer | null
}

/**
 * Hook that manages a VisibilityLayer instance.
 * 
 * @param data - Visibility data (grid dimensions, vision state, player position, light profile)
 * @param config - Render configuration (tile size, visibility toggles)
 * @returns Container and layer reference
 */
export function useVisibilityLayer(
  data: VisibilityRenderData | null,
  config: VisibilityRenderConfig | null
): UseVisibilityLayerResult {
  const layerRef = useRef<VisibilityLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    layerRef.current = new VisibilityLayer()
    
    return () => {
      layerRef.current?.destroy()
      layerRef.current = null
    }
  }, [])

  // Re-render when data or config changes
  useEffect(() => {
    if (layerRef.current && data && config) {
      layerRef.current.render(data, config)
    }
  }, [data, config])

  // Update visibility settings when config changes
  useEffect(() => {
    if (layerRef.current && config) {
      layerRef.current.setVisibility(config.showFog, config.showLight)
      if (config.showPlayer !== undefined) {
        layerRef.current.setPlayerVisible(config.showPlayer)
      }
    }
  }, [config?.showFog, config?.showLight, config?.showPlayer])

  return useMemo(() => ({
    container: layerRef.current?.container ?? null,
    layer: layerRef.current
  }), [layerRef.current])
}
