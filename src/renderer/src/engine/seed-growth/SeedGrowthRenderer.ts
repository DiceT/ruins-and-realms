/**
 * Seed Growth Renderer
 * 
 * PixiJS rendering for seed growth dungeon visualization.
 * Supports debug overlays for regions, frontier, rooms, corridors, and symmetry.
 * Includes pan and zoom controls.
 */

import { Container, Graphics, Text, TextStyle, FederatedPointerEvent } from 'pixi.js'
import { SeedGrowthState, SeedGrowthSettings } from './types'

// Color palette for regions (HSL-based for distinct colors)
const REGION_COLORS = [
  0x4a90d9, // Blue
  0xd94a4a, // Red
  0x4ad94a, // Green
  0xd9d94a, // Yellow
  0xd94ad9, // Magenta
  0x4ad9d9, // Cyan
  0xd9904a, // Orange
  0x904ad9, // Purple
  0x4a904a, // Dark Green
  0x904a4a, // Dark Red
  0x4a4a90, // Dark Blue
  0x909090  // Gray
]

export class SeedGrowthRenderer {
  private container: Container
  private contentContainer: Container // Contains all renderable content, for pan/zoom
  private tileSize: number = 8
  
  // Pan/zoom state
  private isPanning: boolean = false
  private lastPanPos: { x: number; y: number } = { x: 0, y: 0 }
  private zoom: number = 1.0
  private readonly minZoom = 0.25
  private readonly maxZoom = 4.0
  
  // Graphics layers
  private gridLayer: Graphics
  private regionLayer: Graphics
  private frontierLayer: Graphics
  private roomBoundsLayer: Graphics
  private corridorLayer: Graphics
  private symmetryLayer: Graphics
  private statusText: Text

  constructor(parentContainer: Container) {
    this.container = new Container()
    this.container.eventMode = 'static'
    parentContainer.addChild(this.container)

    // Content container for pan/zoom transformations
    this.contentContainer = new Container()
    this.container.addChild(this.contentContainer)

    // Create layers in order (bottom to top)
    this.gridLayer = new Graphics()
    this.regionLayer = new Graphics()
    this.corridorLayer = new Graphics()
    this.frontierLayer = new Graphics()
    this.roomBoundsLayer = new Graphics()
    this.symmetryLayer = new Graphics()
    
    this.contentContainer.addChild(this.gridLayer)
    this.contentContainer.addChild(this.regionLayer)
    this.contentContainer.addChild(this.corridorLayer)
    this.contentContainer.addChild(this.frontierLayer)
    this.contentContainer.addChild(this.roomBoundsLayer)
    this.contentContainer.addChild(this.symmetryLayer)

    // Status text (fixed position, not affected by pan/zoom)
    const style = new TextStyle({
      fontSize: 14,
      fill: 0xffffff,
      fontFamily: 'monospace'
    })
    this.statusText = new Text({ text: '', style })
    this.statusText.x = 10
    this.statusText.y = 10
    this.container.addChild(this.statusText)

    // Setup pan/zoom event handlers
    this.setupPanZoom()
  }

  private setupPanZoom(): void {
    // Hit area for the container (so we can receive events)
    this.container.hitArea = { contains: () => true }
    
    // Pan: mouse/touch drag
    this.container.on('pointerdown', (e: FederatedPointerEvent) => {
      if (e.button === 0 || e.button === 1) { // Left or middle mouse
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

    // Zoom: mouse wheel
    this.container.on('wheel', (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * zoomFactor))
      
      if (newZoom !== this.zoom) {
        // Zoom towards mouse position
        const mouseX = e.offsetX
        const mouseY = e.offsetY
        
        const beforeZoomX = (mouseX - this.contentContainer.x) / this.zoom
        const beforeZoomY = (mouseY - this.contentContainer.y) / this.zoom
        
        this.zoom = newZoom
        this.contentContainer.scale.set(this.zoom)
        
        // Adjust position to keep mouse position stable
        this.contentContainer.x = mouseX - beforeZoomX * this.zoom
        this.contentContainer.y = mouseY - beforeZoomY * this.zoom
      }
    })
  }

  /** Set tile render size */
  public setTileSize(size: number): void {
    this.tileSize = size
  }

  /** Get the container for camera positioning */
  public getContainer(): Container {
    return this.container
  }

  /** Center the view on the grid */
  public centerView(gridWidth: number, gridHeight: number, viewWidth: number, viewHeight: number): void {
    const contentWidth = gridWidth * this.tileSize * this.zoom
    const contentHeight = gridHeight * this.tileSize * this.zoom
    
    this.contentContainer.x = (viewWidth - contentWidth) / 2
    this.contentContainer.y = (viewHeight - contentHeight) / 2
  }

  /** Reset zoom to 1.0 and center */
  public resetView(gridWidth: number, gridHeight: number, viewWidth: number, viewHeight: number): void {
    this.zoom = 1.0
    this.contentContainer.scale.set(1.0)
    this.centerView(gridWidth, gridHeight, viewWidth, viewHeight)
  }

  /** Full render of current state */
  public render(state: SeedGrowthState, settings: SeedGrowthSettings): void {
    this.clear()
    this.renderGrid(state, settings)
    
    if (settings.debug.showRegions) {
      this.renderRegions(state)
    }
    
    if (settings.debug.showCorridors) {
      this.renderCorridors(state)
    }
    
    if (settings.debug.showFrontier) {
      this.renderFrontier(state, settings)
    }
    
    if (settings.debug.showRoomBounds) {
      this.renderRoomBounds(state)
    }
    
    if (settings.debug.showSymmetryAxis) {
      this.renderSymmetryAxis(settings)
    }

    this.renderStatus(state, settings)
  }

  /** Clear all layers */
  public clear(): void {
    this.gridLayer.clear()
    this.regionLayer.clear()
    this.frontierLayer.clear()
    this.roomBoundsLayer.clear()
    this.corridorLayer.clear()
    this.symmetryLayer.clear()
  }

  /** Render base grid (floor and empty tiles) */
  private renderGrid(state: SeedGrowthState, settings: SeedGrowthSettings): void {
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize

    // Background (empty tiles)
    this.gridLayer.rect(0, 0, gridWidth * size, gridHeight * size)
    this.gridLayer.fill({ color: 0x1a1a1a })

    // Floor tiles
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = state.grid[y]?.[x]
        if (!tile) continue

        if (tile.state === 'floor') {
          // Base floor color
          let color = 0x3a3a3a

          // If showing growth order (heatmap)
          if (settings.debug.showGrowthOrder && tile.growthOrder !== null) {
            const t = tile.growthOrder / Math.max(state.tilesGrown, 1)
            color = this.heatmapColor(t)
          }

          this.gridLayer.rect(x * size, y * size, size - 1, size - 1)
          this.gridLayer.fill({ color })
        }
      }
    }
  }

  /** Render colored regions overlay */
  private renderRegions(state: SeedGrowthState): void {
    const size = this.tileSize

    for (const row of state.grid) {
      for (const tile of row) {
        if (tile.state === 'floor' && tile.regionId !== null) {
          const colorIdx = (tile.regionId - 1) % REGION_COLORS.length
          const color = REGION_COLORS[colorIdx]
          
          this.regionLayer.rect(tile.x * size, tile.y * size, size - 1, size - 1)
          this.regionLayer.fill({ color, alpha: 0.6 })
        }
      }
    }
  }

  /** Render frontier tiles as dots */
  private renderFrontier(state: SeedGrowthState, settings: SeedGrowthSettings): void {
    const size = this.tileSize
    const halfSize = size / 2

    for (const region of state.regions.values()) {
      const colorIdx = (region.id - 1) % REGION_COLORS.length
      const color = REGION_COLORS[colorIdx]
      
      for (const idx of region.frontier) {
        const x = idx % settings.gridWidth
        const y = Math.floor(idx / settings.gridWidth)
        
        this.frontierLayer.circle(x * size + halfSize, y * size + halfSize, 3)
        this.frontierLayer.fill({ color })
        this.frontierLayer.stroke({ width: 1, color: 0xffffff })
      }
    }
  }

  /** Render room bounds as rectangles */
  private renderRoomBounds(state: SeedGrowthState): void {
    const size = this.tileSize

    for (const room of state.rooms) {
      const { bounds } = room
      
      this.roomBoundsLayer.rect(
        bounds.x * size,
        bounds.y * size,
        bounds.w * size,
        bounds.h * size
      )
      this.roomBoundsLayer.stroke({ width: 2, color: 0x00ff00 })
    }
  }

  /** Render corridor tiles */
  private renderCorridors(state: SeedGrowthState): void {
    const size = this.tileSize

    for (const corridor of state.corridors) {
      for (const pos of corridor.tiles) {
        this.corridorLayer.rect(pos.x * size, pos.y * size, size - 1, size - 1)
        this.corridorLayer.fill({ color: 0xffaa00, alpha: 0.4 })
      }
    }
  }

  /** Render symmetry axis line */
  private renderSymmetryAxis(settings: SeedGrowthSettings): void {
    const { gridWidth, gridHeight, symmetryAxis } = settings
    const size = this.tileSize

    if (symmetryAxis === 'vertical') {
      const x = (gridWidth / 2) * size
      this.symmetryLayer.moveTo(x, 0)
      this.symmetryLayer.lineTo(x, gridHeight * size)
    } else {
      const y = (gridHeight / 2) * size
      this.symmetryLayer.moveTo(0, y)
      this.symmetryLayer.lineTo(gridWidth * size, y)
    }
    this.symmetryLayer.stroke({ width: 2, color: 0xff00ff, alpha: 0.5 })
  }

  /** Render status text */
  private renderStatus(state: SeedGrowthState, settings: SeedGrowthSettings): void {
    const lines = [
      `Tiles: ${state.tilesGrown} / ${settings.tileBudget}`,
      `Regions: ${state.regions.size}`,
      `Step: ${state.stepCount}`,
      `Status: ${state.completionReason}`
    ]
    this.statusText.text = lines.join('\n')
  }

  /** Convert 0-1 value to heatmap color */
  private heatmapColor(t: number): number {
    // Blue -> Cyan -> Green -> Yellow -> Red
    const r = Math.floor(255 * Math.min(1, 2 * t))
    const g = Math.floor(255 * Math.min(1, 2 * (1 - Math.abs(t - 0.5))))
    const b = Math.floor(255 * Math.max(0, 1 - 2 * t))
    return (r << 16) | (g << 8) | b
  }

  /** Destroy and cleanup */
  public destroy(): void {
    this.container.destroy({ children: true })
  }
}
