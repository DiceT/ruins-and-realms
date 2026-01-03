/**
 * CameraController
 * 
 * Unified camera control system for pan, zoom, centering, and transform operations.
 * Provides a single source of truth for all camera transformations across the application.
 * 
 * Designed to work with PixiJS Container transforms.
 */

import { Container, Point } from 'pixi.js'

export interface CameraConfig {
  minZoom: number
  maxZoom: number
  initialZoom: number
  panLimit?: number  // Max distance from origin
}

export interface CameraState {
  x: number
  y: number
  scale: number
}

const DEFAULT_CONFIG: CameraConfig = {
  minZoom: 0.05,
  maxZoom: 4.0,
  initialZoom: 1.0,
  panLimit: 50000
}

export class CameraController {
  private contentContainer: Container
  private config: CameraConfig
  private zoom: number
  
  // View dimensions for centering calculations
  private viewWidth: number = 800
  private viewHeight: number = 600
  
  // Callbacks
  private onZoomChange?: (zoom: number) => void
  
  constructor(contentContainer: Container, config: Partial<CameraConfig> = {}) {
    this.contentContainer = contentContainer
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.zoom = this.config.initialZoom
    
    // Apply initial scale
    this.contentContainer.scale.set(this.zoom)
  }
  
  // ============================================
  // Configuration
  // ============================================
  
  /** Set callback for zoom level changes */
  public setOnZoomChange(callback: (zoom: number) => void): void {
    this.onZoomChange = callback
  }
  
  /** Update view dimensions (call on resize) */
  public setViewDimensions(width: number, height: number): void {
    this.viewWidth = width
    this.viewHeight = height
  }
  
  /** Get current view dimensions */
  public getViewDimensions(): { width: number; height: number } {
    return { width: this.viewWidth, height: this.viewHeight }
  }
  
  // ============================================
  // Pan Operations
  // ============================================
  
  /** Pan by delta (in screen pixels) */
  public pan(dx: number, dy: number): void {
    this.contentContainer.x += dx
    this.contentContainer.y += dy
    this.clampPosition()
  }
  
  /** Set absolute position */
  public setPosition(x: number, y: number): void {
    this.contentContainer.x = x
    this.contentContainer.y = y
    this.clampPosition()
  }
  
  private clampPosition(): void {
    if (!this.config.panLimit) return
    
    const limit = this.config.panLimit * this.zoom
    this.contentContainer.x = Math.max(-limit, Math.min(limit, this.contentContainer.x))
    this.contentContainer.y = Math.max(-limit, Math.min(limit, this.contentContainer.y))
  }
  
  // ============================================
  // Zoom Operations
  // ============================================
  
  /** Get current zoom level */
  public get currentZoom(): number {
    return this.zoom
  }
  
  /** 
   * Zoom towards a specific anchor point (in screen coordinates)
   * @param delta - Positive = zoom out, Negative = zoom in
   * @param anchorX - Screen X coordinate to zoom towards
   * @param anchorY - Screen Y coordinate to zoom towards
   */
  public zoom_towards(delta: number, anchorX: number, anchorY: number): void {
    const zoomFactor = delta > 0 ? 0.9 : 1.1
    const newZoom = this.clampZoom(this.zoom * zoomFactor)
    
    if (newZoom !== this.zoom) {
      // Calculate point in world space under anchor before zoom
      const beforeWorld = this.toWorld(anchorX, anchorY)
      
      this.zoom = newZoom
      this.contentContainer.scale.set(this.zoom)
      
      // Adjust position to keep anchor point stable
      const afterScreen = this.toScreen(beforeWorld.x, beforeWorld.y)
      this.contentContainer.x -= afterScreen.x - anchorX
      this.contentContainer.y -= afterScreen.y - anchorY
      
      this.clampPosition()
      this.onZoomChange?.(this.zoom)
    }
  }
  
  /** 
   * Zoom towards the center of the view
   * @param delta - Positive = zoom out, Negative = zoom in
   */
  public zoomToCenter(delta: number): void {
    this.zoom_towards(delta, this.viewWidth / 2, this.viewHeight / 2)
  }
  
  /** Set zoom level directly */
  public setZoom(level: number): void {
    const newZoom = this.clampZoom(level)
    if (newZoom !== this.zoom) {
      const centerWorld = this.toWorld(this.viewWidth / 2, this.viewHeight / 2)
      
      this.zoom = newZoom
      this.contentContainer.scale.set(this.zoom)
      
      // Re-center on the same world point
      this.centerAt(centerWorld.x, centerWorld.y)
      this.onZoomChange?.(this.zoom)
    }
  }
  
  private clampZoom(value: number): number {
    return Math.max(this.config.minZoom, Math.min(this.config.maxZoom, value))
  }
  
  // ============================================
  // Centering Operations
  // ============================================
  
  /** Center the view on a world coordinate */
  public centerAt(worldX: number, worldY: number): void {
    this.contentContainer.x = (this.viewWidth / 2) - (worldX * this.zoom)
    this.contentContainer.y = (this.viewHeight / 2) - (worldY * this.zoom)
    this.clampPosition()
  }
  
  /** Center the view on a specific tile */
  public centerOnTile(tileX: number, tileY: number, tileSize: number): void {
    const worldX = (tileX + 0.5) * tileSize
    const worldY = (tileY + 0.5) * tileSize
    this.centerAt(worldX, worldY)
  }
  
  /** Center the view on a grid (center of grid) */
  public centerOnGrid(gridWidth: number, gridHeight: number, tileSize: number): void {
    const contentWidth = gridWidth * tileSize * this.zoom
    const contentHeight = gridHeight * tileSize * this.zoom
    
    this.contentContainer.x = (this.viewWidth - contentWidth) / 2
    this.contentContainer.y = (this.viewHeight - contentHeight) / 2
    this.clampPosition()
  }
  
  /** Fit entire world bounds into view with optional padding */
  public fitToView(worldWidth: number, worldHeight: number, padding: number = 0): void {
    // Calculate required scale to fit
    const scaleX = (this.viewWidth - padding * 2) / worldWidth
    const scaleY = (this.viewHeight - padding * 2) / worldHeight
    
    const newZoom = this.clampZoom(Math.min(scaleX, scaleY))
    this.zoom = newZoom
    this.contentContainer.scale.set(this.zoom)
    
    // Center on the world
    this.centerAt(worldWidth / 2, worldHeight / 2)
    this.onZoomChange?.(this.zoom)
  }
  
  // ============================================
  // Coordinate Conversion
  // ============================================
  
  /** Convert screen coordinates to world coordinates */
  public toWorld(screenX: number, screenY: number): Point {
    return this.contentContainer.toLocal(new Point(screenX, screenY))
  }
  
  /** Convert world coordinates to screen coordinates */
  public toScreen(worldX: number, worldY: number): Point {
    return this.contentContainer.toGlobal(new Point(worldX, worldY))
  }
  
  /** Convert screen coordinates to grid tile coordinates */
  public screenToTile(screenX: number, screenY: number, tileSize: number): { x: number; y: number } {
    const world = this.toWorld(screenX, screenY)
    return {
      x: Math.floor(world.x / tileSize),
      y: Math.floor(world.y / tileSize)
    }
  }
  
  // ============================================
  // Transform Sync
  // ============================================
  
  /** Get current transform state for syncing */
  public getTransform(): CameraState {
    return {
      x: this.contentContainer.x,
      y: this.contentContainer.y,
      scale: this.zoom
    }
  }
  
  /** Apply transform from another camera */
  public syncTransform(state: CameraState): void {
    this.contentContainer.x = state.x
    this.contentContainer.y = state.y
    this.zoom = state.scale
    this.contentContainer.scale.set(this.zoom)
    this.onZoomChange?.(this.zoom)
  }
  
  /** Sync from a { x, y, scale } object (convenience) */
  public syncFrom(x: number, y: number, scale: number): void {
    this.syncTransform({ x, y, scale })
  }
  
  // ============================================
  // Getters
  // ============================================
  
  /** Get the world position at the center of the screen */
  public get center(): Point {
    return this.toWorld(this.viewWidth / 2, this.viewHeight / 2)
  }
  
  /** Get current scale */
  public get scale(): number {
    return this.zoom
  }
  
  // ============================================
  // Lifecycle
  // ============================================
  
  /** Reset to initial state */
  public reset(): void {
    this.zoom = this.config.initialZoom
    this.contentContainer.scale.set(this.zoom)
    this.contentContainer.x = 0
    this.contentContainer.y = 0
    this.onZoomChange?.(this.zoom)
  }
  
  /** No explicit destroy needed - just stop using the controller */
  public destroy(): void {
    // Nothing to clean up - Container is managed externally
  }
}
