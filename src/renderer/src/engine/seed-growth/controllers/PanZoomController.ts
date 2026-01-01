import { Container, FederatedPointerEvent } from 'pixi.js'

export interface PanZoomConfig {
  minZoom: number
  maxZoom: number
  initialZoom: number
}

export type Transform = { x: number; y: number; scale: number }

export class PanZoomController {
  private container: Container
  private contentContainer: Container
  
  // State
  private isPanning: boolean = false
  private lastPanPos: { x: number; y: number } = { x: 0, y: 0 }
  private zoom: number
  
  // Config
  private readonly minZoom: number
  private readonly maxZoom: number
  
  // View dimensions (for centering)
  private viewWidth: number = 800
  private viewHeight: number = 600

  // Callbacks
  private onZoomChange?: (zoom: number) => void

  constructor(
    interactionContainer: Container, 
    contentContainer: Container,
    config: PanZoomConfig = { minZoom: 0.05, maxZoom: 4.0, initialZoom: 0.25 }
  ) {
    this.container = interactionContainer
    this.contentContainer = contentContainer
    this.minZoom = config.minZoom
    this.maxZoom = config.maxZoom
    this.zoom = config.initialZoom

    this.setupInteractions()
  }

  /**
   * Register a callback for when zoom level changes
   * (Useful for updating grid lines or other zoom-dependent visuals)
   */
  public setOnZoomChange(callback: (zoom: number) => void): void {
    this.onZoomChange = callback
  }

  /**
   * Setup event listeners for pan and zoom
   */
  private setupInteractions(): void {
    // Hit area for events must be defined on the interaction container
    // Assuming parent has set hitArea, or we ensure it here if it's safe
    if (!this.container.hitArea) {
        this.container.hitArea = { contains: () => true }
    }
    
    // Pan: right mouse (2) or middle mouse (1) drag
    this.container.on('pointerdown', (e: FederatedPointerEvent) => {
      if (e.button === 2 || e.button === 1) {
        this.isPanning = true
        this.lastPanPos = { x: e.globalX, y: e.globalY }
      }
    })
    
    this.container.on('pointermove', (e: FederatedPointerEvent) => {
      if (this.isPanning) {
        const dx = e.globalX - this.lastPanPos.x
        const dy = e.globalY - this.lastPanPos.y
        this.contentContainer.x += dx
        this.contentContainer.y += dy
        this.lastPanPos = { x: e.globalX, y: e.globalY }
      }
    })
    
    this.container.on('pointerup', () => {
      this.isPanning = false
    })
    
    this.container.on('pointerupoutside', () => {
      this.isPanning = false
    })
    
    // Zoom: mouse wheel - zoom towards mouse pointer (standard) or view center (existing)
    // Existing logic used VIEW CENTER zooming. Preserving that behavior.
    this.container.on('wheel', (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * zoomFactor))
      
      if (newZoom !== this.zoom) {
        // Zoom towards center of view
        const centerX = this.viewWidth / 2
        const centerY = this.viewHeight / 2
        
        // Calculate point in world space under the center
        const beforeZoomX = (centerX - this.contentContainer.x) / this.zoom
        const beforeZoomY = (centerY - this.contentContainer.y) / this.zoom
        
        this.zoom = newZoom
        this.contentContainer.scale.set(this.zoom)
        
        // Adjust position to keep that world point centered
        this.contentContainer.x = centerX - beforeZoomX * this.zoom
        this.contentContainer.y = centerY - beforeZoomY * this.zoom
        
        // Notify
        if (this.onZoomChange) this.onZoomChange(this.zoom)
      }
    })
  }

  /**
   * Set view dimensions used for centering calculations
   */
  public setViewDimensions(width: number, height: number): void {
    this.viewWidth = width
    this.viewHeight = height
  }

  /**
   * Center the view on a specific world coordinate (in tiles)
   */
  public centerView(tileX: number, tileY: number, tileSize: number): void {
    const worldX = (tileX + 0.5) * tileSize
    const worldY = (tileY + 0.5) * tileSize
    
    this.contentContainer.x = (this.viewWidth / 2) - (worldX * this.zoom)
    this.contentContainer.y = (this.viewHeight / 2) - (worldY * this.zoom)
  }

  /**
   * Sync position and zoom from another source (direct values)
   */
  public syncTransform(x: number, y: number, scale: number): void {
    this.contentContainer.x = x
    this.contentContainer.y = y
    this.zoom = scale
    this.contentContainer.scale.set(scale)
    
    // Notify, as scale (zoom) might have changed
    if (this.onZoomChange) this.onZoomChange(this.zoom)
  }

  /**
   * Get current transform state
   */
  public getTransform(): Transform {
    return {
      x: this.contentContainer.x,
      y: this.contentContainer.y,
      scale: this.zoom
    }
  }

  /**
   * Get current zoom level
   */
  public get currentZoom(): number {
    return this.zoom
  }

  /**
   * Cleanup event listeners
   */
  public destroy(): void {
    this.container.removeAllListeners('pointerdown')
    this.container.removeAllListeners('pointermove')
    this.container.removeAllListeners('pointerup')
    this.container.removeAllListeners('pointerupoutside')
    this.container.removeAllListeners('wheel')
  }
}
