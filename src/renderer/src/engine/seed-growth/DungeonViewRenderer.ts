/**
 * Dungeon View Renderer
 * 
 * Renders the seed growth output as a proper dungeon visualization.
 * This is separate from the debug/growth visualization in SeedGrowthRenderer.
 * 
 * Usage: When "View as Dungeon" is enabled, this renderer takes over
 * and displays rooms, corridors, and walls in a dungeon style.
 */

import { Container, Graphics, FederatedPointerEvent } from 'pixi.js'
import { SeedGrowthState, SeedGrowthSettings, Room, Corridor, Connection } from './types'
import { CorridorPathfinder } from './CorridorPathfinder'

// Dungeon theme colors
const THEME = {
  background: 0x0a0a0a,
  floor: 0xF9F6EE,
  roomFloor: 0xF9F6EE,
  wall: 0x1a1a1a,
  corridorFloor: 0xF0F3FA,
  doorway: 0x6a5a4a,
  grid: 0x1a1a1a,
  gridAlpha: 0.5
}

export interface DungeonViewOptions {
  tileSize?: number
  showGrid?: boolean
  showRoomLabels?: boolean
}

export class DungeonViewRenderer {
  private container: Container
  private contentContainer: Container
  private tileSize: number = 8
  
  // Pan/zoom state
  private isPanning: boolean = false
  private lastPanPos: { x: number; y: number } = { x: 0, y: 0 }
  private zoom: number = 1.0
  private readonly minZoom = 0.25
  private readonly maxZoom = 4.0
  
  // Layers
  private backgroundLayer: Graphics
  private floorLayer: Graphics
  private wallLayer: Graphics
  private gridLineLayer: Graphics  // Separate layer for grid lines (re-rendered on zoom)
  private overlayLayer: Graphics
  
  // View state
  private viewWidth: number = 800
  private viewHeight: number = 600
  
  // Grid line state (stored for re-rendering on zoom)
  private floorPositions: Set<string> = new Set()
  
  constructor(parentContainer: Container, options: DungeonViewOptions = {}) {
    this.container = new Container()
    this.container.eventMode = 'static'
    parentContainer.addChild(this.container)
    
    this.contentContainer = new Container()
    this.container.addChild(this.contentContainer)
    
    // Create layers
    this.backgroundLayer = new Graphics()
    this.floorLayer = new Graphics()
    this.wallLayer = new Graphics()
    this.gridLineLayer = new Graphics()
    this.overlayLayer = new Graphics()
    
    this.contentContainer.addChild(this.backgroundLayer)
    this.contentContainer.addChild(this.floorLayer)
    this.contentContainer.addChild(this.wallLayer)
    this.contentContainer.addChild(this.gridLineLayer)
    this.contentContainer.addChild(this.overlayLayer)
    
    if (options.tileSize) {
      this.tileSize = options.tileSize
    }
    
    // Setup pan/zoom
    this.setupPanZoom()
  }
  
  private setupPanZoom(): void {
    // Hit area for events
    this.container.hitArea = { contains: () => true }
    
    // Pan: right mouse or middle mouse drag
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
    
    // Zoom: mouse wheel - zoom towards VIEW CENTER
    this.container.on('wheel', (e: WheelEvent) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * zoomFactor))
      
      if (newZoom !== this.zoom) {
        const centerX = this.viewWidth / 2
        const centerY = this.viewHeight / 2
        
        const beforeZoomX = (centerX - this.contentContainer.x) / this.zoom
        const beforeZoomY = (centerY - this.contentContainer.y) / this.zoom
        
        this.zoom = newZoom
        this.contentContainer.scale.set(this.zoom)
        
        this.contentContainer.x = centerX - beforeZoomX * this.zoom
        this.contentContainer.y = centerY - beforeZoomY * this.zoom
        
        // Re-render grid lines with constant screen-space width
        this.updateGridLines()
      }
    })
  }
  
  /**
   * Set view dimensions for centering
   */
  public setViewDimensions(width: number, height: number): void {
    this.viewWidth = width
    this.viewHeight = height
  }
  
  /**
   * Sync position and zoom from another renderer's content container
   */
  public syncTransform(x: number, y: number, scale: number): void {
    this.contentContainer.x = x
    this.contentContainer.y = y
    this.zoom = scale
    this.contentContainer.scale.set(scale)
  }
  
  /**
   * Get current transform for syncing to another renderer
   */
  public getTransform(): { x: number; y: number; scale: number } {
    return {
      x: this.contentContainer.x,
      y: this.contentContainer.y,
      scale: this.zoom
    }
  }
  
  /**
   * Center the view on the dungeon
   */
  public centerView(gridWidth: number, gridHeight: number): void {
    const contentWidth = gridWidth * this.tileSize * this.zoom
    const contentHeight = gridHeight * this.tileSize * this.zoom
    
    this.contentContainer.x = (this.viewWidth - contentWidth) / 2
    this.contentContainer.y = (this.viewHeight - contentHeight) / 2
  }
  
  /**
   * Render the dungeon view from seed growth state
   * Floors are created based on Room tiles only (not corridors or raw floor tiles)
   */
  public render(state: SeedGrowthState, settings: SeedGrowthSettings): void {
    this.clear()
    
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize
    
    // Debug: log rooms and corridors
    console.log('[DungeonView] Rendering with:', {
      roomsCount: state.rooms?.length ?? 0,
      corridorsCount: state.corridors?.length ?? 0,
      firstRoomTiles: state.rooms?.[0]?.tiles?.length ?? 0
    })
    
    // 1. Background
    this.backgroundLayer.rect(0, 0, gridWidth * size, gridHeight * size)
    this.backgroundLayer.fill({ color: THEME.background })
    
    // 2. Generate and render corridors connecting rooms
    const pathfinder = new CorridorPathfinder()
    const corridorTiles = pathfinder.generate(state, state.rooms)
    
    // 3. Render ROOM floors (full tiles, no gap)
    for (const room of state.rooms) {
      this.renderRoomFloor(room, size)
    }
    
    // 4. Render corridor floors (full tiles, no gap)
    for (const pos of corridorTiles) {
      this.floorLayer.rect(pos.x * size, pos.y * size, size, size)
      this.floorLayer.fill({ color: THEME.corridorFloor })
    }
    
    // 5. Render walls (around rooms AND corridors)
    this.renderWalls(state, settings, size, corridorTiles)
    
    // 6. Render door markers (small squares on doorway tiles)
    this.renderDoorMarkers(state.rooms, corridorTiles, size)
    
    // 7. Render grid lines over floor areas (only between adjacent floor tiles)
    this.renderGridLines(state.rooms, corridorTiles, size)
  }

  /**
   * Render door markers - small wall-colored squares on corridor tiles adjacent to rooms
   */
  private renderDoorMarkers(rooms: Room[], corridorTiles: { x: number; y: number }[], size: number): void {
    // Build set of room floor positions
    const roomFloors = new Set<string>()
    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          roomFloors.add(`${x + dx},${y + dy}`)
        }
      }
    }
    
    // Find corridor tiles adjacent to room tiles (doorways)
    const doorMarkerSize = size * 0.35 // 35% of tile size
    const offset = (size - doorMarkerSize) / 2
    
    for (const pos of corridorTiles) {
      // Check if this corridor tile is adjacent to any room tile
      const neighbors = [
        { x: pos.x, y: pos.y - 1 },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x + 1, y: pos.y },
      ]
      
      const isAdjacentToRoom = neighbors.some(n => roomFloors.has(`${n.x},${n.y}`))
      
      if (isAdjacentToRoom) {
        // Draw small wall-colored square centered on the tile
        this.floorLayer.rect(
          pos.x * size + offset,
          pos.y * size + offset,
          doorMarkerSize,
          doorMarkerSize
        )
        this.floorLayer.fill({ color: THEME.wall })
      }
    }
  }
  
  private renderGridLines(rooms: Room[], corridorTiles: { x: number; y: number }[], size: number): void {
    // Build and store set of all floor positions
    this.floorPositions.clear()
    
    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.floorPositions.add(`${x + dx},${y + dy}`)
        }
      }
    }
    
    for (const pos of corridorTiles) {
      this.floorPositions.add(`${pos.x},${pos.y}`)
    }
    
    // Draw grid lines
    this.updateGridLines()
  }
  
  /**
   * Update grid lines with constant 1-screen-pixel width
   * Called after zoom changes to maintain constant visual weight
   */
  private updateGridLines(): void {
    this.gridLineLayer.clear()
    
    const size = this.tileSize
    // Line width in world space = 1 screen pixel / zoom
    const lineWidth = 1 / this.zoom
    
    // Draw grid lines ONLY between adjacent floor tiles (not at edges)
    for (const key of this.floorPositions) {
      const [x, y] = key.split(',').map(Number)
      const px = x * size
      const py = y * size
      
      // Right edge - only draw if there's a floor tile to the right
      if (this.floorPositions.has(`${x + 1},${y}`)) {
        this.gridLineLayer.rect(px + size - lineWidth, py, lineWidth, size)
        this.gridLineLayer.fill({ color: THEME.grid, alpha: THEME.gridAlpha })
      }
      
      // Bottom edge - only draw if there's a floor tile below
      if (this.floorPositions.has(`${x},${y + 1}`)) {
        this.gridLineLayer.rect(px, py + size - lineWidth, size, lineWidth)
        this.gridLineLayer.fill({ color: THEME.grid, alpha: THEME.gridAlpha })
      }
    }
  }
  
  /**
   * Room Floor rendering
   */
  private renderRoomFloor(room: Room, size: number): void {
    const { x, y, w, h } = room.bounds
    console.log('[DungeonView] Rendering room:', { id: room.id, x, y, w, h, isCircular: room.isCircular })
    
    if (room.isCircular) {
      // Draw wall-colored bounding box first (corners will show as walls)
      // Draw on floorLayer so it's under the circle but above the background
      this.floorLayer.rect(x * size, y * size, w * size, h * size)
      this.floorLayer.fill({ color: THEME.wall })
      
      // Draw circular room on top (same layer, so it covers the center)
      const centerX = (x + w / 2) * size
      const centerY = (y + h / 2) * size
      const radius = (w / 2) * size
      
      this.floorLayer.circle(centerX, centerY, radius)
      this.floorLayer.fill({ color: THEME.roomFloor })
    } else {
      // Draw rectangular room (full tiles, grid lines drawn separately)
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          this.floorLayer.rect((x + dx) * size, (y + dy) * size, size, size)
          this.floorLayer.fill({ color: THEME.roomFloor })
        }
      }
    }
  }
  
  private renderCorridorFloor(corridor: Corridor, size: number): void {
    for (const pos of corridor.tiles) {
      this.floorLayer.rect(pos.x * size, pos.y * size, size - 1, size - 1)
      this.floorLayer.fill({ color: THEME.corridorFloor })
    }
  }
  
  private renderWalls(state: SeedGrowthState, settings: SeedGrowthSettings, size: number, corridorTiles: { x: number; y: number }[] = []): void {
    const { gridWidth, gridHeight } = settings
    
    // Build a set of floor positions from room bounding boxes
    const floorSet = new Set<string>()
    
    for (const room of state.rooms) {
      const { x, y, w, h } = room.bounds
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          floorSet.add(`${x + dx},${y + dy}`)
        }
      }
    }
    
    // Add corridor tiles to floor set
    for (const pos of corridorTiles) {
      floorSet.add(`${pos.x},${pos.y}`)
    }
    
    // Find all tiles adjacent to floor that are not floor themselves
    const wallSet = new Set<string>()
    const neighbors = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
      [-1, -1], [1, -1], [-1, 1], [1, 1]
    ]
    
    for (const key of floorSet) {
      const [x, y] = key.split(',').map(Number)
      
      for (const [dx, dy] of neighbors) {
        const nx = x + dx
        const ny = y + dy
        const neighborKey = `${nx},${ny}`
        
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
          if (!floorSet.has(neighborKey)) {
            wallSet.add(neighborKey)
          }
        }
      }
    }
    
    // Render walls
    for (const key of wallSet) {
      const [x, y] = key.split(',').map(Number)
      this.wallLayer.rect(x * size, y * size, size, size)
      this.wallLayer.fill({ color: THEME.wall })
    }
  }
  
  /**
   * Clear all layers
   */
  public clear(): void {
    this.backgroundLayer.clear()
    this.floorLayer.clear()
    this.wallLayer.clear()
    this.gridLineLayer.clear()
    this.overlayLayer.clear()
  }
  
  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    this.container.destroy({ children: true })
  }
  
  /**
   * Get the container
   */
  public getContainer(): Container {
    return this.container
  }
  
  /**
   * Get the content container (for accessing transform)
   */
  public getContentContainer(): Container {
    return this.contentContainer
  }
}
