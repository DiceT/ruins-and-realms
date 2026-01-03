/**
 * useWallLayer Hook
 * 
 * Manages the WallLayer class lifecycle within React.
 * Renders wall tiles and their shadows.
 * 
 * @example
 * const { container } = useWallLayer(
 *   { wallPositions: wallSet },
 *   { tileSize: 8, theme: themeColors }
 * )
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { WallLayer, WallRenderData, WallRenderConfig } from '@/engine/systems/layers/WallLayer'

export interface UseWallLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance */
  layer: WallLayer | null
}

/**
 * Hook that manages a WallLayer instance.
 * 
 * @param data - Wall render data (pre-computed wall positions)
 * @param config - Render configuration (tile size, theme with shadow settings)
 * @returns Container and layer reference
 */
export function useWallLayer(
  data: WallRenderData | null,
  config: WallRenderConfig | null
): UseWallLayerResult {
  const [layer, setLayer] = useState<WallLayer | null>(null)
  const layerRef = useRef<WallLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new WallLayer()
    layerRef.current = newLayer
    setLayer(newLayer)
    
    return () => {
      newLayer.destroy()
      layerRef.current = null
      setLayer(null)
    }
  }, [])

  // Re-render when data or config changes
  useEffect(() => {
    if (layerRef.current && data && config) {
      layerRef.current.render(data, config)
    }
  }, [data, config])

  return {
    container: layer?.container ?? null,
    layer
  }
}
