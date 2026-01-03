/**
 * PanZoomController
 * 
 * Thin wrapper around CameraController and InputController for the seed-growth system.
 * Maintains backward compatibility with existing API while delegating to unified systems.
 */

import { Container } from 'pixi.js'
import { CameraController, CameraState, CameraConfig } from '../../systems/CameraController'
import { InputController } from '../../systems/InputController'

export interface PanZoomConfig {
  minZoom: number
  maxZoom: number
  initialZoom: number
}

export type Transform = CameraState

export class PanZoomController {
  private cameraController: CameraController
  private inputController: InputController
  
  constructor(
    interactionContainer: Container, 
    contentContainer: Container,
    config: PanZoomConfig = { minZoom: 0.05, maxZoom: 4.0, initialZoom: 0.25 }
  ) {
    // Initialize camera controller
    const cameraConfig: CameraConfig = {
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      initialZoom: config.initialZoom
    }
    this.cameraController = new CameraController(contentContainer, cameraConfig)
    
    // Initialize input controller
    this.inputController = new InputController({
      container: interactionContainer,
      onPanMove: (dx, dy) => this.cameraController.pan(dx, dy),
      onZoom: (delta, mouseX, mouseY) => {
        // Use center-based zoom (existing behavior)
        this.cameraController.zoomToCenter(delta)
      }
    })
  }

  /**
   * Register a callback for when zoom level changes
   */
  public setOnZoomChange(callback: (zoom: number) => void): void {
    this.cameraController.setOnZoomChange(callback)
  }

  /**
   * Set view dimensions used for centering calculations
   */
  public setViewDimensions(width: number, height: number): void {
    this.cameraController.setViewDimensions(width, height)
  }

  /**
   * Center the view on a specific world coordinate (in tiles)
   */
  public centerView(tileX: number, tileY: number, tileSize: number): void {
    this.cameraController.centerOnTile(tileX, tileY, tileSize)
  }

  /**
   * Sync position and zoom from another source (direct values)
   */
  public syncTransform(x: number, y: number, scale: number): void {
    this.cameraController.syncFrom(x, y, scale)
  }

  /**
   * Get current transform state
   */
  public getTransform(): Transform {
    return this.cameraController.getTransform()
  }

  /**
   * Get current zoom level
   */
  public get currentZoom(): number {
    return this.cameraController.currentZoom
  }

  /**
   * Cleanup event listeners
   */
  public destroy(): void {
    this.inputController.destroy()
    this.cameraController.destroy()
  }
}
