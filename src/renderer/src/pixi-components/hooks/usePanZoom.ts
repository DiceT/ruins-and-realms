/**
 * usePanZoom Hook
 * 
 * Manages camera and input controllers for pan/zoom functionality within React.
 * Provides a unified interface for viewport manipulation.
 * 
 * This is a higher-level hook that combines:
 * - CameraController for transform operations
 * - InputController for user input handling
 * 
 * @example
 * const canvasRef = useRef<HTMLCanvasElement>(null)
 * const { camera, inputController, contentContainer } = usePanZoom({
 *   canvasRef,
 *   initialZoom: 0.25,
 *   onZoomChange: (zoom) => console.log('Zoom:', zoom)
 * })
 * 
 * // Center on grid after generation
 * useEffect(() => {
 *   camera?.centerOnGrid(gridWidth, gridHeight, tileSize)
 * }, [dungeonData])
 */

import { useEffect, useRef, useMemo, useCallback, RefObject } from 'react'
import { Container } from 'pixi.js'
import { CameraController, CameraConfig, CameraState } from '@/engine/systems/CameraController'
import { InputController, InputControllerOptions } from '@/engine/systems/InputController'

export interface UsePanZoomConfig {
  /** Reference to the canvas element for wheel events */
  canvasRef?: RefObject<HTMLCanvasElement | null>
  
  /** Container to attach pan/zoom input events to (interaction layer) */
  interactionContainer?: Container
  
  /** Container to apply transforms to (content layer) */
  contentContainer?: Container
  
  /** Camera configuration */
  cameraConfig?: Partial<CameraConfig>
  
  /** View dimensions for centering calculations */
  viewWidth?: number
  viewHeight?: number
  
  /** Callback when zoom level changes */
  onZoomChange?: (zoom: number) => void
  
  /** Callback when click occurs (non-pan) */
  onClick?: (x: number, y: number, button: number) => void
}

export interface UsePanZoomResult {
  /** The CameraController instance for transform operations */
  camera: CameraController | null
  
  /** The InputController instance for input handling */
  inputController: InputController | null
  
  /** Current zoom level */
  zoom: number
  
  /** Current transform state */
  transform: CameraState
  
  /** Center the view on a grid */
  centerOnGrid: (gridWidth: number, gridHeight: number, tileSize: number) => void
  
  /** Center the view on a specific tile */
  centerOnTile: (tileX: number, tileY: number, tileSize: number) => void
  
  /** Fit world bounds into view */
  fitToView: (worldWidth: number, worldHeight: number, padding?: number) => void
  
  /** Reset camera to initial state */
  reset: () => void
}

/**
 * Hook that manages pan/zoom functionality.
 * 
 * @param config - Pan/zoom configuration
 * @returns Camera controller, input controller, and convenience methods
 */
export function usePanZoom(config: UsePanZoomConfig): UsePanZoomResult {
  const {
    canvasRef,
    interactionContainer,
    contentContainer,
    cameraConfig,
    viewWidth = 800,
    viewHeight = 600,
    onZoomChange,
    onClick
  } = config

  const cameraRef = useRef<CameraController | null>(null)
  const inputRef = useRef<InputController | null>(null)
  const zoomRef = useRef<number>(cameraConfig?.initialZoom ?? 1.0)

  // Create camera controller when content container is available
  useEffect(() => {
    if (!contentContainer) return

    cameraRef.current = new CameraController(contentContainer, cameraConfig)
    cameraRef.current.setViewDimensions(viewWidth, viewHeight)
    
    if (onZoomChange) {
      cameraRef.current.setOnZoomChange((zoom) => {
        zoomRef.current = zoom
        onZoomChange(zoom)
      })
    }

    return () => {
      cameraRef.current?.destroy()
      cameraRef.current = null
    }
  }, [contentContainer])

  // Update view dimensions when they change
  useEffect(() => {
    cameraRef.current?.setViewDimensions(viewWidth, viewHeight)
  }, [viewWidth, viewHeight])

  // Create input controller when interaction container is available
  useEffect(() => {
    if (!interactionContainer) return

    const inputOptions: InputControllerOptions = {
      container: interactionContainer,
      canvas: canvasRef?.current ?? undefined,
      onPanMove: (dx, dy) => {
        cameraRef.current?.pan(dx, dy)
      },
      onZoom: (delta, _mouseX, _mouseY) => {
        // Use center-based zoom for now
        // TODO: Implement zoom-towards-mouse-position using mouseX, mouseY
        cameraRef.current?.zoomToCenter(delta)
      },
      onClick
    }

    inputRef.current = new InputController(inputOptions)

    return () => {
      inputRef.current?.destroy()
      inputRef.current = null
    }
  }, [interactionContainer, canvasRef?.current, onClick])

  // Convenience methods
  const centerOnGrid = useCallback((gridWidth: number, gridHeight: number, tileSize: number) => {
    cameraRef.current?.centerOnGrid(gridWidth, gridHeight, tileSize)
  }, [])

  const centerOnTile = useCallback((tileX: number, tileY: number, tileSize: number) => {
    cameraRef.current?.centerOnTile(tileX, tileY, tileSize)
  }, [])

  const fitToView = useCallback((worldWidth: number, worldHeight: number, padding: number = 0) => {
    cameraRef.current?.fitToView(worldWidth, worldHeight, padding)
  }, [])

  const reset = useCallback(() => {
    cameraRef.current?.reset()
  }, [])

  return useMemo(() => ({
    camera: cameraRef.current,
    inputController: inputRef.current,
    zoom: zoomRef.current,
    transform: cameraRef.current?.getTransform() ?? { x: 0, y: 0, scale: 1 },
    centerOnGrid,
    centerOnTile,
    fitToView,
    reset
  }), [cameraRef.current, inputRef.current, centerOnGrid, centerOnTile, fitToView, reset])
}
