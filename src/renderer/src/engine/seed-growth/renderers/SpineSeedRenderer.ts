/**
 * Spine-Seed Renderer
 * 
 * PixiJS rendering for spine-seed dungeon visualization.
 * 4-layer debug view: Spine, Seeds, Rectangles, Walls
 * Uses CameraController and InputController for pan/zoom.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { SpineSeedState, SpineSeedSettings } from '../types'
import { CameraController } from '../../systems/CameraController'
import { InputController } from '../../systems/InputController'

// Color palette for room seeds
const ROOM_COLORS = [
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

// Spine color
const SPINE_COLOR = 0x9b59b6 // Purple

// Seed marker color
const SEED_MARKER_COLOR = 0xf1c40f // Yellow

// Dead seed color
const DEAD_SEED_COLOR = 0x7f8c8d // Gray

// Wall seed color
const WALL_SEED_COLOR = 0x2c3e50 // Dark blue-gray

export class SpineSeedRenderer {
  private container: Container
  private contentContainer: Container
  private tileSize: number = 8
  
  // Camera and input controllers (unified system)
  private cameraController: CameraController
  private inputController: InputController
  
  // Graphics layers (4-layer system)
  private backgroundLayer: Graphics
  private spineLayer: Graphics      // Layer 1: Spine path
  private seedMarkerLayer: Graphics // Layer 2: Seed ejection points
  private roomLayer: Graphics       // Layer 3: Growing rectangles
  private wallLayer: Graphics       // Layer 4: Walls
  private collisionLayer: Graphics  // Debug: collision points
  private gridLineLayer: Graphics
  private statusText: Text

  // Grid line state
  private floorPositions: Set<string> = new Set()

  constructor(parentContainer: Container) {
    this.container = new Container()
    this.container.eventMode = 'static'
    parentContainer.addChild(this.container)

    // Content container for pan/zoom
    this.contentContainer = new Container()
    this.container.addChild(this.contentContainer)

    // Create layers in order (bottom to top)
    this.backgroundLayer = new Graphics()
    this.spineLayer = new Graphics()
    this.seedMarkerLayer = new Graphics()
    this.roomLayer = new Graphics()
    this.wallLayer = new Graphics()
    this.collisionLayer = new Graphics()
    this.gridLineLayer = new Graphics()
    
    this.contentContainer.addChild(this.backgroundLayer)
    this.contentContainer.addChild(this.spineLayer)
    this.contentContainer.addChild(this.seedMarkerLayer)
    this.contentContainer.addChild(this.roomLayer)
    this.contentContainer.addChild(this.wallLayer)
    this.contentContainer.addChild(this.collisionLayer)
    this.contentContainer.addChild(this.gridLineLayer)

    // Status text
    const style = new TextStyle({
      fontSize: 14,
      fill: 0xffffff,
      fontFamily: 'monospace'
    })
    this.statusText = new Text({ text: '', style })
    this.statusText.x = 10
    this.statusText.y = 10
    this.container.addChild(this.statusText)

    // Initialize camera controller
    this.cameraController = new CameraController(this.contentContainer, {
      minZoom: 0.05,
      maxZoom: 4.0,
      initialZoom: 0.25
    })
    this.cameraController.setOnZoomChange(() => this.updateGridLines())
    
    // Initialize input controller
    this.inputController = new InputController({
      container: this.container,
      onPanMove: (dx, dy) => this.cameraController.pan(dx, dy),
      onZoom: (delta) => this.cameraController.zoomToCenter(delta)
    })
  }

  /** Set tile render size */
  public setTileSize(size: number): void {
    this.tileSize = size
  }

  /** Get the container */
  public getContainer(): Container {
    return this.container
  }

  /** Center the view on the grid */
  public centerView(gridWidth: number, gridHeight: number, viewWidth: number, viewHeight: number): void {
    this.cameraController.setViewDimensions(viewWidth, viewHeight)
    this.cameraController.centerOnGrid(gridWidth, gridHeight, this.tileSize)
  }

  /** Reset zoom to 0.25 and center */
  public resetView(gridWidth: number, gridHeight: number, viewWidth: number, viewHeight: number): void {
    this.cameraController.setZoom(0.25)
    this.centerView(gridWidth, gridHeight, viewWidth, viewHeight)
  }

  /** Get current transform */
  public getTransform(): { x: number; y: number; scale: number } {
    return this.cameraController.getTransform()
  }

  /** Sync transform from another renderer */
  public syncTransform(x: number, y: number, scale: number): void {
    this.cameraController.syncFrom(x, y, scale)
  }

  /** Convert screen coordinates to grid coordinates */
  public screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    return this.cameraController.screenToTile(screenX, screenY, this.tileSize)
  }

  /** Full render of current state */
  public render(state: SpineSeedState, settings: SpineSeedSettings): void {
    this.clear()
    this.renderBackground(state, settings)
    
    if (settings.debug.showSpine) {
      this.renderSpine(state, settings)
    }
    
    if (settings.debug.showSeeds) {
      this.renderSeedMarkers(state)
    }
    
    if (settings.debug.showRoomGrowth) {
      this.renderRooms(state, settings)
    }
    
    if (settings.debug.showWalls) {
      this.renderWalls(state, settings)
    }
    
    if (settings.debug.showCollisions) {
      this.renderCollisions(state)
    }

    this.renderStatus(state, settings)
  }

  /** Clear all layers */
  public clear(): void {
    this.backgroundLayer.clear()
    this.spineLayer.clear()
    this.seedMarkerLayer.clear()
    this.roomLayer.clear()
    this.wallLayer.clear()
    this.collisionLayer.clear()
    this.gridLineLayer.clear()
  }

  /** Render background grid */
  private renderBackground(state: SpineSeedState, settings: SpineSeedSettings): void {
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize

    // Dark background
    this.backgroundLayer.rect(0, 0, gridWidth * size, gridHeight * size)
    this.backgroundLayer.fill({ color: 0x1a1a1a })

    // Build floor positions for grid lines
    this.floorPositions.clear()
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = state.grid[y]?.[x]
        if (tile?.state === 'floor') {
          this.floorPositions.add(`${x},${y}`)
        }
      }
    }


    this.updateGridLines()
  }

  /** Render spine tiles (Layer 1) */
  private renderSpine(state: SpineSeedState, settings: SpineSeedSettings): void {
    const size = this.tileSize
    const { gridWidth, gridHeight } = settings

    // Render all spine floor tiles (handling wide spine)
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = state.grid[y]?.[x]
        if (tile?.regionId === -1 && tile.state === 'floor') {
          this.spineLayer.rect(x * size, y * size, size, size)
          this.spineLayer.fill({ color: SPINE_COLOR, alpha: 0.8 })
        }
      }
    }

    // Render metadata from spine list (forks/loops)
    for (const spineTile of state.spineTiles) {
      // Fork point indicator
      if (spineTile.isForkPoint) {
        this.spineLayer.circle(
          spineTile.x * size + size / 2,
          spineTile.y * size + size / 2,
          size / 3
        )
        this.spineLayer.fill({ color: 0xe74c3c }) // Red dot for fork
      }

      // Loop point indicator
      if (spineTile.isLoopPoint) {
        this.spineLayer.circle(
          spineTile.x * size + size / 2,
          spineTile.y * size + size / 2,
          size / 3
        )
        this.spineLayer.fill({ color: 0x3498db }) // Blue dot for loop
      }
    }

    // Draw spine frontier
    for (const idx of state.spineFrontier) {
      const x = idx % settings.gridWidth
      const y = Math.floor(idx / settings.gridWidth)
      this.spineLayer.circle(x * size + size / 2, y * size + size / 2, 2)
      this.spineLayer.fill({ color: 0xffffff, alpha: 0.5 })
    }
  }

  /** Render seed ejection markers (Layer 2) */
  private renderSeedMarkers(state: SpineSeedState): void {
    const size = this.tileSize

    for (const seed of state.roomSeeds) {
      const x = seed.position.x * size + size / 2
      const y = seed.position.y * size + size / 2
      const radius = size / 2.5

      if (seed.isDead) {
        // Dead seed - gray X
        this.seedMarkerLayer.moveTo(x - radius, y - radius)
        this.seedMarkerLayer.lineTo(x + radius, y + radius)
        this.seedMarkerLayer.moveTo(x + radius, y - radius)
        this.seedMarkerLayer.lineTo(x - radius, y + radius)
        this.seedMarkerLayer.stroke({ width: 2, color: DEAD_SEED_COLOR })
      } else if (seed.isWallSeed) {
        // Wall seed - square
        this.seedMarkerLayer.rect(x - radius, y - radius, radius * 2, radius * 2)
        this.seedMarkerLayer.fill({ color: WALL_SEED_COLOR })
        this.seedMarkerLayer.stroke({ width: 1, color: 0xffffff })
      } else {
        // Room seed - circle
        this.seedMarkerLayer.circle(x, y, radius)
        this.seedMarkerLayer.fill({ color: SEED_MARKER_COLOR })
        this.seedMarkerLayer.stroke({ width: 1, color: 0xffffff })
      }

      // Draw line from seed to source spine tile
      const sx = seed.sourceSpineTile.x * size + size / 2
      const sy = seed.sourceSpineTile.y * size + size / 2
      this.seedMarkerLayer.moveTo(sx, sy)
      this.seedMarkerLayer.lineTo(x, y)
      this.seedMarkerLayer.stroke({ 
        width: 1, 
        color: seed.isDead ? DEAD_SEED_COLOR : SEED_MARKER_COLOR,
        alpha: 0.5
      })
    }
  }

  /** Render growing rectangular rooms (Layer 3) */
  private renderRooms(state: SpineSeedState, settings: SpineSeedSettings): void {
    const size = this.tileSize

    for (const seed of state.roomSeeds) {
      if (seed.isDead) continue

      const colorIdx = seed.birthOrder % ROOM_COLORS.length
      const color = seed.isWallSeed ? WALL_SEED_COLOR : ROOM_COLORS[colorIdx]
      const alpha = seed.isComplete ? 0.7 : 0.5

      // Render room tiles
      for (const tile of seed.tiles) {
        this.roomLayer.rect(tile.x * size, tile.y * size, size, size)
        this.roomLayer.fill({ color, alpha })
      }

      // Render target bounds outline (dashed effect via short segments)
      if (!seed.isComplete) {
        const bounds = seed.currentBounds
        this.roomLayer.rect(
          bounds.x * size,
          bounds.y * size,
          bounds.w * size,
          bounds.h * size
        )
        this.roomLayer.stroke({ width: 1, color: 0xffffff, alpha: 0.3 })

        // Target bounds (if different)
        if (seed.targetWidth > bounds.w || seed.targetHeight > bounds.h) {
          // Calculate target rectangle centered on current position
          const targetX = bounds.x - Math.floor((seed.targetWidth - bounds.w) / 2)
          const targetY = bounds.y - Math.floor((seed.targetHeight - bounds.h) / 2)
          this.roomLayer.rect(
            targetX * size,
            targetY * size,
            seed.targetWidth * size,
            seed.targetHeight * size
          )
          this.roomLayer.stroke({ width: 1, color, alpha: 0.3 })
        }
      }
    }
  }

  /** Render walls (Layer 4) - implicit walls at room edges */
  private renderWalls(state: SpineSeedState, settings: SpineSeedSettings): void {
    const { gridWidth, gridHeight } = settings
    const size = this.tileSize
    const wallColor = 0x2c3e50

    // Find wall positions (empty tiles adjacent to floor)
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = state.grid[y]?.[x]
        if (tile?.state === 'empty') {
          // Check if adjacent to floor
          let hasFloorNeighbor = false
          const neighbors = [
            { x: x - 1, y },
            { x: x + 1, y },
            { x, y: y - 1 },
            { x, y: y + 1 }
          ]
          for (const n of neighbors) {
            if (n.x >= 0 && n.x < gridWidth && n.y >= 0 && n.y < gridHeight) {
              const neighbor = state.grid[n.y]?.[n.x]
              if (neighbor?.state === 'floor' && neighbor.regionId !== -1) { // Only draw walls for rooms, not spine
                hasFloorNeighbor = true
                break
              }
            }
          }

          if (hasFloorNeighbor) {
            this.wallLayer.rect(x * size, y * size, size, size)
            this.wallLayer.fill({ color: wallColor, alpha: 0.6 })
          }
        }
      }
    }
  }

  /** Render collision points (debug) */
  private renderCollisions(state: SpineSeedState): void {
    const size = this.tileSize

    // Highlight completed rooms that stopped due to collision
    for (const seed of state.roomSeeds) {
      if (seed.isComplete && !seed.isDead && seed.tiles.length > 0) {
        // Check if room is smaller than target (likely hit collision)
        if (seed.currentBounds.w < seed.targetWidth || seed.currentBounds.h < seed.targetHeight) {
          // Draw red border around room
          this.collisionLayer.rect(
            seed.currentBounds.x * size,
            seed.currentBounds.y * size,
            seed.currentBounds.w * size,
            seed.currentBounds.h * size
          )
          this.collisionLayer.stroke({ width: 2, color: 0xe74c3c })
        }
      }
    }
  }

  /** Update grid lines */
  private updateGridLines(): void {
    this.gridLineLayer.clear()
    
    const size = this.tileSize
    const gridColor = 0x666666
    const gridAlpha = 0.3
    const lineWidth = 1 / this.zoom
    
    for (const key of this.floorPositions) {
      const [x, y] = key.split(',').map(Number)
      const px = x * size
      const py = y * size
      
      if (this.floorPositions.has(`${x + 1},${y}`)) {
        this.gridLineLayer.rect(px + size - lineWidth, py, lineWidth, size)
        this.gridLineLayer.fill({ color: gridColor, alpha: gridAlpha })
      }
      
      if (this.floorPositions.has(`${x},${y + 1}`)) {
        this.gridLineLayer.rect(px, py + size - lineWidth, size, lineWidth)
        this.gridLineLayer.fill({ color: gridColor, alpha: gridAlpha })
      }
    }
  }

  /** Render status text */
  private renderStatus(state: SpineSeedState, settings: SpineSeedSettings): void {
    const activeRooms = state.roomSeeds.filter(s => !s.isComplete && !s.isDead).length
    const lines = [
      `Phase: ${state.phase}`,
      `Spine: ${state.spineTiles.length} tiles | Forks: ${state.forkCount}/${settings.spine.maxForks}`,
      `Seeds: ${state.roomSeeds.length} (${activeRooms} active)`,
      `Tiles: ${state.tilesGrown} | Step: ${state.stepCount}`
    ]
    this.statusText.text = lines.join('\n')
  }

  /** Convert 0-1 value to heatmap color */
  private heatmapColor(t: number): number {
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
