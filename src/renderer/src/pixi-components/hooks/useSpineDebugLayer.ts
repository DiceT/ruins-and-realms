/**
 * useSpineDebugLayer Hook
 * 
 * Manages the SpineDebugLayer class lifecycle within React.
 * Renders the spine path and ejected seed markers for debugging.
 * 
 * Note: This layer is hidden by default. Use layer.setVisible(true) to show it.
 * 
 * @example
 * const { container, layer } = useSpineDebugLayer(
 *   { spinePath: pathTiles, ejectedSeeds: seedData },
 *   { tileSize: 8 }
 * )
 * layer?.setVisible(showDebug) // Toggle visibility
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { 
  SpineDebugLayer, 
  SpineDebugRenderData, 
  SpineDebugRenderConfig 
} from '@/engine/systems/layers/SpineDebugLayer'

export interface UseSpineDebugLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance (for setVisible) */
  layer: SpineDebugLayer | null
}

/**
 * Hook that manages a SpineDebugLayer instance.
 * 
 * @param data - Spine debug data (path tiles and ejected seed info)
 * @param config - Render configuration (tile size)
 * @param visible - Whether to show the debug overlay (default: false)
 * @returns Container and layer reference
 */
export function useSpineDebugLayer(
  data: SpineDebugRenderData | null,
  config: SpineDebugRenderConfig | null,
  visible: boolean = false
): UseSpineDebugLayerResult {
  const [layer, setLayer] = useState<SpineDebugLayer | null>(null)
  const layerRef = useRef<SpineDebugLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new SpineDebugLayer()
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

  // Update visibility when toggle changes
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setVisible(visible)
    }
  }, [visible])

  return {
    container: layer?.container ?? null,
    layer
  }
}
