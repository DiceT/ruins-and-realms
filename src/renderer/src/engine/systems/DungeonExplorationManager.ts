/**
 * DungeonExplorationManager
 * 
 * Orchestrates player movement, visibility computation, and rendering updates.
 * Decouples the low-level systems (PlayerController, VisibilitySystem) from the main DungeonController.
 */

import { VisibilitySystem } from './VisibilitySystem'
import { PlayerController } from './PlayerController'
import { LIGHT_PROFILES, LightSourceType } from '../data/LightingData'
import { DungeonViewRenderer } from '../seed-growth'

export interface ExplorationOptions {
  gridWidth: number
  gridHeight: number
  startX: number
  startY: number
  walkableTiles: { x: number; y: number }[]
  renderer: DungeonViewRenderer
}

export class DungeonExplorationManager {
  private visibilitySystem: VisibilitySystem
  private playerController: PlayerController
  private renderer: DungeonViewRenderer
  
  private gridWidth: number
  private gridHeight: number
  private walkableSet: Set<string>
  
  private activeLight: LightSourceType = 'torch'
  private showPlayer: boolean = true

  constructor(options: ExplorationOptions) {
    this.gridWidth = options.gridWidth
    this.gridHeight = options.gridHeight
    this.renderer = options.renderer
    
    // Build walkable set for fast collision checks
    this.walkableSet = new Set(options.walkableTiles.map(t => `${t.x},${t.y}`))
    
    // Initialize Systems
    this.visibilitySystem = new VisibilitySystem(this.gridWidth, this.gridHeight)
    this.playerController = new PlayerController()
    
    this.playerController.init(
      options.startX, 
      options.startY,
      this.gridWidth,
      this.gridHeight,
      options.walkableTiles,
      (x, y) => this.handlePlayerMove(x, y)
    )
    
    // Initial visibility compute
    this.handlePlayerMove(options.startX, options.startY)
  }

  /**
   * Update the active light source and recompute visibility
   */
  public setActiveLight(light: LightSourceType): void {
    this.activeLight = light
    this.updateVisibility()
  }

  /**
   * Toggle player visibility/camera focus
   */
  public setShowPlayer(enabled: boolean): void {
    this.showPlayer = enabled
    this.renderer.setPlayerVisibility(enabled)
    if (enabled) {
      this.renderer.focusOnTile(this.playerController.x, this.playerController.y)
    }
  }

  public getPlayerPosition(): { x: number; y: number } {
    return { x: this.playerController.x, y: this.playerController.y }
  }

  /**
   * Internal handler for player movement
   */
  private handlePlayerMove(x: number, y: number): void {
    this.updateVisibility()
    
    // Camera focus
    if (this.showPlayer) {
      this.renderer.focusOnTile(x, y)
    }
  }

  /**
   * Recompute visibility and update renderer
   */
  public updateVisibility(): void {
    const lightProfile = LIGHT_PROFILES[this.activeLight]
    const isWall = (tx: number, ty: number) => !this.walkableSet.has(`${tx},${ty}`)
    
    this.visibilitySystem.computeVisibility(
      this.playerController.x, 
      this.playerController.y, 
      lightProfile.dimRadius, 
      isWall
    )
    
    this.renderer.updateVisibilityState(
      this.gridWidth,
      this.gridHeight,
      this.visibilitySystem.getGrid(),
      this.playerController.x,
      this.playerController.y,
      lightProfile
    )
  }

  /**
   * Cleanup listeners
   */
  public destroy(): void {
    this.playerController.destroy()
    this.walkableSet.clear()
  }
}
