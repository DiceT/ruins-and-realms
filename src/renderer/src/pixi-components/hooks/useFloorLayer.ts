/**
 * useFloorLayer Hook
 * 
 * Manages the FloorLayer class lifecycle within React.
 * Renders room and corridor floor tiles.
 * 
 * @example
 * const { container } = useFloorLayer(
 *   { rooms: roomData, corridorTiles: corridorData },
 *   { tileSize: 8, theme: themeColors }
 * )
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { FloorLayer, FloorRenderData, FloorRenderConfig } from '@/engine/systems/layers/FloorLayer'

export interface UseFloorLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance (for advanced use cases) */
  layer: FloorLayer | null
}

/**
 * Hook that manages a FloorLayer instance.
 * 
 * @param data - Floor render data (rooms and corridor tiles)
 * @param config - Render configuration (tile size, theme colors)
 * @returns Container and layer reference
 */
export function useFloorLayer(
  data: FloorRenderData | null,
  config: FloorRenderConfig | null
): UseFloorLayerResult {
  const [layer, setLayer] = useState<FloorLayer | null>(null)
  const layerRef = useRef<FloorLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new FloorLayer()
    layerRef.current = newLayer
    setLayer(newLayer) // Trigger re-render with new layer
    
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
