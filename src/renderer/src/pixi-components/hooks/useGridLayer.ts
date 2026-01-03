/**
 * useGridLayer Hook
 * 
 * Manages the GridLayer class lifecycle within React.
 * Renders grid overlay lines that adapt to zoom level.
 * 
 * @example
 * const { container, layer } = useGridLayer(
 *   { rooms: roomData, corridorTiles: corridorData },
 *   { tileSize: 8, theme: themeColors, zoom: 1.0 }
 * )
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { GridLayer, GridRenderData, GridRenderConfig } from '@/engine/systems/layers/GridLayer'

export interface UseGridLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance (for updateZoom) */
  layer: GridLayer | null
}

/**
 * Hook that manages a GridLayer instance.
 * 
 * @param data - Grid render data (rooms and corridor tiles for bounds)
 * @param config - Render configuration (tile size, theme, zoom level)
 * @returns Container and layer reference
 */
export function useGridLayer(
  data: GridRenderData | null,
  config: GridRenderConfig | null
): UseGridLayerResult {
  const [layer, setLayer] = useState<GridLayer | null>(null)
  const layerRef = useRef<GridLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new GridLayer()
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
