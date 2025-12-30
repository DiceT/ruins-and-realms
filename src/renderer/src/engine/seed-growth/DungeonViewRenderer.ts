/**
 * Dungeon View Renderer
 * 
 * Renders the seed growth output as a proper dungeon visualization.
 * This is separate from the debug/growth visualization in SeedGrowthRenderer.
 * 
 * Usage: When "View as Dungeon" is enabled, this renderer takes over
 * and displays rooms, corridors, and walls in a dungeon style.
 */

import { Container, Graphics, FederatedPointerEvent, Text, TextStyle } from 'pixi.js'
import { SeedGrowthState, SeedGrowthSettings, Room, Corridor, Connection, DungeonData } from './types'
import { CorridorPathfinder } from './CorridorPathfinder'

// Dungeon theme colors
const THEME = {
  background: 0x0a0a0a,
  floor: 0xF9F6EE,
  roomFloor: 0xF9F6EE,
  wall: 0x444444, // Lighter grey for visibility
  corridorFloor: 0xC8CDD4, // Darker grey for visibility
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
  private heatMapLayer: Graphics    // Heat map debug layer
  private labelContainer: Container
  
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
    this.heatMapLayer = new Graphics()
    this.heatMapLayer.visible = false  // Default OFF
    this.labelContainer = new Container()
    
    this.contentContainer.addChild(this.backgroundLayer)
    this.contentContainer.addChild(this.floorLayer)
    this.contentContainer.addChild(this.wallLayer)
    this.contentContainer.addChild(this.heatMapLayer)  // Above walls
    this.contentContainer.addChild(this.gridLineLayer)
    this.contentContainer.addChild(this.overlayLayer)
    this.contentContainer.addChild(this.labelContainer)
    
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
  /**
   * Render the dungeon view from seed growth state OR DungeonData
   */
  public render(data: SeedGrowthState | DungeonData, settings: SeedGrowthSettings, showRoomNumbers: boolean = true): void {
    console.log('[DungeonViewRenderer] render called with showRoomNumbers:', showRoomNumbers)
    this.clear()
    
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize
    
    // 1. Background (Expanded by 2 tiles in all directions)
    // Origin at -2, -2
    const pad = 2
    this.backgroundLayer.rect(
        -pad * size, 
        -pad * size, 
        (gridWidth + pad * 2) * size, 
        (gridHeight + pad * 2) * size
    )
    this.backgroundLayer.fill({ color: THEME.background })

    let rooms: Room[] = []
    let corridorTiles: { x: number; y: number }[] = []

    // Check if we have Spine data (DungeonData) or Organic (SeedGrowthState)
    if ('spine' in data) {
        // --- SPINE MODE ---
        // Use passed rooms (already pruned)
        rooms = data.rooms
        
        // The spineTiles array only contains CENTER path tiles.
        const spineTiles = (data as any).spine || []
        
        // 0. Calculate Scores
        const heatScores = this.calculateWallHeatScores(rooms, spineTiles)
        
        // 1. Build Blocked Set (Room Floors)
        const blockedSet = new Set<string>()
        for (const room of rooms) {
            for (const tile of room.tiles) {
                blockedSet.add(`${tile.x},${tile.y}`)
            }
        }
        
        const spineWidth = data.spineWidth || 1
        let targetSet = new Set<string>()
        let renderedSpinePath: {x: number, y: number}[] = []

        if (spineWidth > 1) {
            // --- MODE A: SPINE CORRIDOR (Width 3, 5, 7) ---
            // Width Rule: Rendered Width = Input Width - 2.
            // Width 3 -> 1 Floor
            // Width 5 -> 3 Floor
            // Width 7 -> 5 Floor
            const effectiveWidth = Math.max(1, spineWidth - 2)
            const radius = Math.floor((effectiveWidth - 1) / 2)
            
            const fullSpineSet = new Set<string>()
            const fullSpineTiles: { x: number, y: number, dir: string }[] = []
            
            for (const t of spineTiles) {
                const key = `${t.x},${t.y}`
                if (!fullSpineSet.has(key)) {
                    fullSpineSet.add(key)
                    fullSpineTiles.push({ x: t.x, y: t.y, dir: t.direction || 'north' })
                }
                // Only expand if radius > 0 (Width >= 5 -> Eff 3 -> Radius 1)
                if (radius > 0) {
                    const dir = t.direction || 'north'
                    const perps = dir === 'north' || dir === 'south' 
                        ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
                        : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
                    for (let i = 1; i <= radius; i++) {
                        for (const p of perps) {
                            const px = t.x + p.x * i
                            const py = t.y + p.y * i
                            const pkey = `${px},${py}`
                            if (!fullSpineSet.has(pkey)) {
                                fullSpineSet.add(pkey)
                                fullSpineTiles.push({ x: px, y: py, dir })
                            }
                        }
                    }
                }
            }

            // Target Set = Walkable Path
            // Since we reduced by 2 to get the floor, this entire set IS the walkable floor.
            renderedSpinePath = fullSpineTiles.map(t => ({ x: t.x, y: t.y }))
            for (const t of renderedSpinePath) targetSet.add(`${t.x},${t.y}`)

        } else {
            // --- MODE B: NETWORK / ORGANIC SPINE (Width 1) ---
            // No rendered spine. 
            // Target = Lowest ID Room (Network Seed)
            if (rooms.length > 0) {
                const seedRoom = rooms.reduce((prev, curr) => (prev.id.localeCompare(curr.id) < 0 ? prev : curr))
                for (const tile of seedRoom.tiles) {
                    targetSet.add(`${tile.x},${tile.y}`)
                }
            }
        }

        // 3. Generate Tributary Corridors
        const pathfinder = new CorridorPathfinder()
        const tributaryTiles = pathfinder.generateSpineCorridors(
            data.gridWidth, 
            data.gridHeight, 
            rooms, 
            spineTiles, 
            heatScores,
            targetSet,
            blockedSet
        )

        // 4. Combine
        corridorTiles = [...renderedSpinePath, ...tributaryTiles]
        
        // 2. Render Heat Map (Visualization update)
        // We do this every frame? Or optimize? Doing it here is fine for prototype.
        this.renderHeatMap(heatScores, size)
        
        console.log('[DungeonView] Rendering Spine Mode:', { 
            rooms: rooms.length, 
            centerSpineTiles: spineTiles.length,
            visibleCorridorTiles: corridorTiles.length
        })

    } else {
        // --- ORGANIC MODE ---
        // @ts-ignore - Handle legacy state access
        rooms = data.rooms || []
        
        // Generate corridors using pathfinder
        const pathfinder = new CorridorPathfinder()
        // @ts-ignore
        corridorTiles = pathfinder.generate(data, rooms)
        console.log('[DungeonView] Rendering Organic Mode:', { rooms: rooms.length, generatedCorridors: corridorTiles.length })
    }
    
    // 3. Render ROOM floors
    for (const room of rooms) {
      this.renderRoomFloor(room, size)
    }
    
    // 4. Render corridor floors
    for (const pos of corridorTiles) {
      this.floorLayer.rect(pos.x * size, pos.y * size, size, size)
      this.floorLayer.fill({ color: THEME.corridorFloor })
    }
    
    // 5. Render walls (around rooms AND corridors)
    // We pass a composite object that mimics what renderWalls expects (rooms)
    this.renderWalls(rooms, settings, size, corridorTiles)
    
    // 6. Render door markers
    this.renderDoorMarkers(rooms, corridorTiles, size)
    
    // 7. Render grid lines
    this.renderGridLines(rooms, corridorTiles, size)
    
    // 8. Render room labels (only if enabled)
    if (showRoomNumbers) {
      this.renderRoomLabels(rooms, size)
    }
    
    // 9. Render heat map (always renders, visibility controlled by toggle)
    // 9. Render heat map (always renders, visibility controlled by toggle)
    // Use the center spine tiles (data.spine) for spine-adjacency checks
    // Cast data to any to check for spine property safely
    const spineTilesForHeat = (data as any).spine ? (data as any).spine : []
    this.renderHeatMap(rooms, spineTilesForHeat, size)
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
  
  private renderWalls(rooms: Room[], settings: SeedGrowthSettings, size: number, corridorTiles: { x: number; y: number }[] = []): void {
    const { gridWidth, gridHeight } = settings
    
    // Build a set of floor positions from room bounding boxes
    const floorSet = new Set<string>()
    
    for (const room of rooms) {
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
        
        // Relaxed bounds check for expanded border (padding 2)
        if (nx >= -2 && nx < gridWidth + 2 && ny >= -2 && ny < gridHeight + 2) {
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
   * Render room number labels at center of each room
   */
  private renderRoomLabels(rooms: Room[], size: number): void {
    // Clear previous labels
    this.labelContainer.removeChildren()
    
    const style = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 12,
      fill: 0x000000,
      fontWeight: 'bold'
    })
    
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i]
      if (!room.bounds) continue
      
      // Calculate center of room in pixels
      const centerX = (room.bounds.x + room.bounds.w / 2) * size
      const centerY = (room.bounds.y + room.bounds.h / 2) * size
      
      const label = new Text({ text: String(i + 1), style })
      label.anchor.set(0.5, 0.5)
      label.position.set(centerX, centerY)
      
      this.labelContainer.addChild(label)
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
    this.heatMapLayer.clear()
    this.overlayLayer.clear()
    this.labelContainer.removeChildren()
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
  
  /**
   * Toggle room number labels visibility
   */
  public setShowRoomNumbers(show: boolean): void {
    this.labelContainer.visible = show
  }
  
  /**
   * Toggle heat map visibility
   */
  public setShowHeatMap(show: boolean): void {
    console.log('[DungeonViewRenderer] setShowHeatMap:', show, 'Layer:', !!this.heatMapLayer)
    if (this.heatMapLayer) {
      this.heatMapLayer.visible = show
      console.log('[DungeonViewRenderer] Layer visible set to:', this.heatMapLayer.visible)
    }
  }

  /**
   * Calculate heat map scores for all room walls
   */
  public calculateWallHeatScores(rooms: Room[], spineTiles: { x: number; y: number }[]): Map<string, number> {
    const heatScores = new Map<string, number>()
    const spineSet = new Set<string>(spineTiles.map(t => `${t.x},${t.y}`))
    
    // Helper to check spine adjacency
    const checkSpineAdj = (x: number, y: number) => {
        return spineSet.has(`${x},${y-1}`) || 
               spineSet.has(`${x},${y+1}`) || 
               spineSet.has(`${x-1},${y}`) || 
               spineSet.has(`${x+1},${y}`)
    }

    // Helper to add score (Accumulate bonuses)
    const addScore = (x: number, y: number, val: number) => {
        const key = `${x},${y}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + val)
    }

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      
      // North wall (y-1)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y - 1
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        // Bonus: -10 Center, -5 Edge, 0 Other
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // South wall (y+h)
      for (let dx = 0; dx < w; dx++) {
        const wx = x + dx, wy = y + h
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // West wall (x-1)
      for (let dy = 0; dy < h; dy++) {
        const wx = x - 1, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }
      // East wall (x+w)
      for (let dy = 0; dy < h; dy++) {
        const wx = x + w, wy = y + dy
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)
        if (checkSpineAdj(wx, wy)) bonus += 20
        const key = `${wx},${wy}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + bonus)
      }

      // Diagonal corners = 500
       const corners = [
        { x: x - 1, y: y - 1 },
        { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h },
        { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        // heatScores.set(`${c.x},${c.y}`, 500)
        // Add huge penalty
        const key = `${c.x},${c.y}`
        const current = heatScores.get(key) || 0
        heatScores.set(key, current + 100)
      }
      
      // Also mark Room Floor tiles as 500 (or keep separate?)
      // Pathfinding treats Room Floor as cheap if traversing.
      // But visually? We only want to visualize "Proximity to Wall".
      // Let's NOT add room floors to heat map for visualization, 
      // but pathfinder logic handles its own "Room Floor" cost (1 if traversing).
      // However, we did say "Room tiles=500" in comments.
      // For now, let's leave room tiles OUT of heat map (or keep logic consistent).
      // Previous code added room tiles? No, just comments said so. 
      // Line 728 (below view) might iterate room tiles.
    }
    return heatScores
  }

  /**
   * Render heat map using pre-calculated scores
   * Scoring: Center wall=10, Far edge=15, Others=20, Diagonals=500, Spine-adjacent=+5
   */
  public renderHeatMap(scores: Map<string, number>, size: number): void {
    this.heatMapLayer.clear()
    
    // Color scale helper
     // Color scale helper for Additive Scores
    const scoreToColor = (s: number): number => {
        if (s <= -20) return 0x00FF00 // Green (Best - Double Shared)
        if (s < -5) return 0x00FFFF // Cyan (Good - Center/Edge)
        if (s < 5) return 0xFFFF00 // Yellow (Neutral)
        if (s < 50) return 0xFF8800 // Orange (Spine Adj)
        return 0xFF0000 // Red (Corner/Blocked)
    }

    for (const [key, score] of scores.entries()) {
        if (typeof key !== 'string') continue
        const [x, y] = key.split(',').map(Number)
        this.heatMapLayer.beginFill(scoreToColor(score), 0.5)
        this.heatMapLayer.drawRect(x * size, y * size, size, size)
        this.heatMapLayer.endFill()
    }
  }
      
  /**
   * Convert score to color
   * 500+ = Dark Red, 0-100 = Orange (low) to Blue (high)
   */
  private scoreToColor(score: number): number {
    if (score >= 500) {
      return 0x8B0000 // Dark red
    }
    
    // Clamp to 0-100 range
    const t = Math.min(1, Math.max(0, score / 100))
    
    // Orange (#FF8C00) to Blue (#0066FF)
    const r = Math.round(255 * (1 - t))
    const g = Math.round(140 * (1 - t) + 102 * t)
    const b = Math.round(255 * t)
    
    return (r << 16) | (g << 8) | b
  }
}
