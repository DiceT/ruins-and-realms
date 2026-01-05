/**
 * useHeatmapLayer Hook
 * 
 * Manages the HeatmapLayer class lifecycle within React.
 * Renders growth order heatmap overlay.
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { HeatmapLayer, HeatmapRenderData, HeatmapRenderConfig } from '@/engine/systems/layers/HeatmapLayer'

export interface UseHeatmapLayerResult {
  container: Container | null
  layer: HeatmapLayer | null
}

export function useHeatmapLayer(
  data: HeatmapRenderData | null,
  config: HeatmapRenderConfig | null
): UseHeatmapLayerResult {
  const [layer, setLayer] = useState<HeatmapLayer | null>(null)
  const layerRef = useRef<HeatmapLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new HeatmapLayer()
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
    if (!layerRef.current) return
    
    if (data && config) {
      layerRef.current.render(data, config)
    } else {
      layerRef.current.clear()
    }
  }, [data, config])

  return {
    container: layer?.container ?? null,
    layer
  }
}
