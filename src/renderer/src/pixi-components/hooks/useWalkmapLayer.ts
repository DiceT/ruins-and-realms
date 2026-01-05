/**
 * useWalkmapLayer Hook
 * 
 * Manages the WalkmapLayer class lifecycle within React.
 * Renders walkable tile overlay.
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { WalkmapLayer, WalkmapRenderData, WalkmapRenderConfig } from '@/engine/systems/layers/WalkmapLayer'

export interface UseWalkmapLayerResult {
  container: Container | null
  layer: WalkmapLayer | null
}

export function useWalkmapLayer(
  data: WalkmapRenderData | null,
  config: WalkmapRenderConfig | null
): UseWalkmapLayerResult {
  const [layer, setLayer] = useState<WalkmapLayer | null>(null)
  const layerRef = useRef<WalkmapLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new WalkmapLayer()
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
