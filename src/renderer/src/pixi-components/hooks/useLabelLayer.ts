/**
 * useLabelLayer Hook
 * 
 * Manages the LabelLayer class lifecycle within React.
 * Renders room number labels with optional "furthest room" highlighting.
 * 
 * @example
 * const { container } = useLabelLayer(
 *   { rooms: roomData, furthestMap: furthestRooms },
 *   { tileSize: 8, showRoomNumbers: true }
 * )
 */

import { useEffect, useState, useRef } from 'react'
import { Container } from 'pixi.js'
import { LabelLayer, LabelRenderData, LabelRenderConfig } from '@/engine/systems/layers/LabelLayer'

export interface UseLabelLayerResult {
  /** The PixiJS Container to add to your scene */
  container: Container | null
  /** Direct access to the layer instance (for setVisible) */
  layer: LabelLayer | null
}

/**
 * Hook that manages a LabelLayer instance.
 * 
 * @param data - Label render data (rooms and optional furthest room info)
 * @param config - Render configuration (tile size, visibility toggle)
 * @returns Container and layer reference
 */
export function useLabelLayer(
  data: LabelRenderData | null,
  config: LabelRenderConfig | null
): UseLabelLayerResult {
  const [layer, setLayer] = useState<LabelLayer | null>(null)
  const layerRef = useRef<LabelLayer | null>(null)

  // Create layer instance once
  useEffect(() => {
    const newLayer = new LabelLayer()
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
      // Clear the layer when disabled
      layerRef.current.clear()
    }
  }, [data, config])

  return {
    container: layer?.container ?? null,
    layer
  }
}
