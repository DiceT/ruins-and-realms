/**
 * useBackgroundLayer Hook
 * 
 * Manages the BackgroundLayer class lifecycle within React.
 * Renders the solid background color behind all dungeon elements.
 * 
 * @example
 * const { container } = useBackgroundLayer({
 *   gridWidth: 100,
 *   gridHeight: 100,
 *   tileSize: 8,
 *   padding: 2,
 *   theme: themeColors
 * })
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { BackgroundLayer, BackgroundRenderConfig } from '@/engine/systems/layers/BackgroundLayer'

export interface UseBackgroundLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance */
  layer: BackgroundLayer | null
}

/**
 * Hook that manages a BackgroundLayer instance.
 * Note: BackgroundLayer takes only config (no separate data).
 * 
 * @param config - Render configuration (grid size, tile size, padding, theme)
 * @returns Container and layer reference
 */
export function useBackgroundLayer(
  config: BackgroundRenderConfig | null
): UseBackgroundLayerResult {
  const [layer, setLayer] = useState<BackgroundLayer | null>(null)
  const layerRef = useRef<BackgroundLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new BackgroundLayer()
    layerRef.current = newLayer
    setLayer(newLayer)
    
    return () => {
      newLayer.destroy()
      layerRef.current = null
      setLayer(null)
    }
  }, [])

  // Re-render when config changes
  useEffect(() => {
    if (layerRef.current && config) {
      layerRef.current.render(config)
    }
  }, [config])

  return {
    container: layer?.container ?? null,
    layer
  }
}
