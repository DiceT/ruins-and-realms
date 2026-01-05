/**
 * useObjectLayer Hook
 * 
 * Manages the ObjectLayer class lifecycle within React.
 * Renders dungeon objects (doors, stairs, traps, chests, etc.)
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { ObjectLayer, ObjectLayerData, ObjectRenderConfig } from '@/engine/systems/layers/ObjectLayer'

export interface UseObjectLayerResult {
  container: Container | null
  layer: ObjectLayer | null
}

export function useObjectLayer(
  data: ObjectLayerData | null,
  config: ObjectRenderConfig | null
): UseObjectLayerResult {
  const [layer, setLayer] = useState<ObjectLayer | null>(null)
  const layerRef = useRef<ObjectLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new ObjectLayer()
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
