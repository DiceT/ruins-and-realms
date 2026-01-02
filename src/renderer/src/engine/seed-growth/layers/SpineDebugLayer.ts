/**
 * SpineDebugLayer
 * 
 * Renders debug overlay for spine-seed generation:
 * - Spine tiles (purple path)
 * - Seed markers (yellow circles with connecting lines)
 * - Room bounds (colored rectangles)
 * 
 * Toggle-able overlay for DungeonViewRenderer
 */

import { Container, Graphics } from 'pixi.js'
import { SpineSeedState, RoomSeed } from '../types'

// Colors
const SPINE_COLOR = 0x9b59b6       // Purple
const SEED_MARKER_COLOR = 0xf1c40f // Yellow
const DEAD_SEED_COLOR = 0x7f8c8d   // Gray
const WALL_SEED_COLOR = 0x2c3e50   // Dark blue-gray

const ROOM_COLORS = [
  0x4a90d9, 0xd94a4a, 0x4ad94a, 0xd9d94a,
  0xd94ad9, 0x4ad9d9, 0xd9904a, 0x904ad9,
  0x4a904a, 0x904a4a, 0x4a4a90, 0x909090
]

export class SpineDebugLayer {
  public containerNode: Container
  
  private spineLayer: Graphics
  private seedLayer: Graphics
  private roomLayer: Graphics
  
  private visible: boolean = false
  
  constructor() {
    this.containerNode = new Container()
    
    this.roomLayer = new Graphics()
    this.spineLayer = new Graphics()
    this.seedLayer = new Graphics()
    
    this.containerNode.addChild(this.roomLayer)
    this.containerNode.addChild(this.spineLayer)
    this.containerNode.addChild(this.seedLayer)
    
    this.containerNode.visible = false
  }
  
  public setVisible(visible: boolean): void {
    this.visible = visible
    this.containerNode.visible = visible
  }
  
  public isVisible(): boolean {
    return this.visible
  }
  
  public clear(): void {
    this.spineLayer.clear()
    this.seedLayer.clear()
    this.roomLayer.clear()
  }
  
  /**
   * Render the debug overlay
   */
  public render(
    state: SpineSeedState | null,
    options: { tileSize: number }
  ): void {
    this.clear()
    if (!state || !this.visible) return
    
    const { tileSize } = options
    
    this.renderSpine(state, tileSize)
    this.renderRooms(state, tileSize)
    this.renderSeedMarkers(state, tileSize)
  }
  
  /**
   * Render spine tiles as purple overlay
   */
  private renderSpine(state: SpineSeedState, size: number): void {
    for (const tile of state.spineTiles) {
      this.spineLayer.rect(tile.x * size, tile.y * size, size, size)
      this.spineLayer.fill({ color: SPINE_COLOR, alpha: 0.5 })
      
      // Fork point indicator
      if (tile.isForkPoint) {
        this.spineLayer.circle(
          tile.x * size + size / 2,
          tile.y * size + size / 2,
          size / 3
        )
        this.spineLayer.fill({ color: 0xe74c3c }) // Red
      }
    }
  }
  
  /**
   * Render room bounds as colored rectangles
   */
  private renderRooms(state: SpineSeedState, size: number): void {
    for (const seed of state.roomSeeds) {
      if (seed.isDead) continue
      
      const colorIdx = seed.birthOrder % ROOM_COLORS.length
      const color = seed.isWallSeed ? WALL_SEED_COLOR : ROOM_COLORS[colorIdx]
      
      // Draw bounds outline
      const bounds = seed.currentBounds
      this.roomLayer.rect(
        bounds.x * size,
        bounds.y * size,
        bounds.w * size,
        bounds.h * size
      )
      this.roomLayer.stroke({ width: 2, color, alpha: 0.8 })
      
      // Light fill
      this.roomLayer.rect(
        bounds.x * size,
        bounds.y * size,
        bounds.w * size,
        bounds.h * size
      )
      this.roomLayer.fill({ color, alpha: 0.15 })
    }
  }
  
  /**
   * Render seed markers with lines from spine
   */
  private renderSeedMarkers(state: SpineSeedState, size: number): void {
    for (const seed of state.roomSeeds) {
      const x = seed.position.x * size + size / 2
      const y = seed.position.y * size + size / 2
      const radius = size / 2
      
      // Line from spine to seed
      const sx = seed.sourceSpineTile.x * size + size / 2
      const sy = seed.sourceSpineTile.y * size + size / 2
      this.seedLayer.moveTo(sx, sy)
      this.seedLayer.lineTo(x, y)
      this.seedLayer.stroke({ 
        width: 2, 
        color: seed.isDead ? DEAD_SEED_COLOR : SEED_MARKER_COLOR,
        alpha: 0.7
      })
      
      // Seed marker
      if (seed.isDead) {
        // Dead seed - gray X
        this.seedLayer.moveTo(x - radius, y - radius)
        this.seedLayer.lineTo(x + radius, y + radius)
        this.seedLayer.moveTo(x + radius, y - radius)
        this.seedLayer.lineTo(x - radius, y + radius)
        this.seedLayer.stroke({ width: 3, color: DEAD_SEED_COLOR })
      } else if (seed.isWallSeed) {
        // Wall seed - square
        this.seedLayer.rect(x - radius, y - radius, radius * 2, radius * 2)
        this.seedLayer.fill({ color: WALL_SEED_COLOR })
        this.seedLayer.stroke({ width: 2, color: 0xffffff })
      } else {
        // Room seed - circle
        this.seedLayer.circle(x, y, radius)
        this.seedLayer.fill({ color: SEED_MARKER_COLOR })
        this.seedLayer.stroke({ width: 2, color: 0xffffff })
      }
    }
  }
}
