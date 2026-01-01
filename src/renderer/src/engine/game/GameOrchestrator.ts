
import { Application, Container } from 'pixi.js'
import { GameLayout } from '../ui/GameLayout'

/**
 * GameOrchestrator
 * 
 * Singleton that manages the high-level game lifecycle, mode switching,
 * and holds references to the main PIXI App and GameLayout.
 */
export class GameOrchestrator {
  private static instance: GameOrchestrator
  private app: Application | null = null
  private layout: GameLayout | null = null
  
  // Container for the game view (middle panel)
  private viewContainer: Container | null = null
  
  private constructor() {}

  public static getInstance(): GameOrchestrator {
    if (!GameOrchestrator.instance) {
      GameOrchestrator.instance = new GameOrchestrator()
    }
    return GameOrchestrator.instance
  }

  /**
   * Initialize the Orchestrator with the PIXI App and Layout
   */
  public init(app: Application, layout: GameLayout): void {
    this.app = app
    this.layout = layout
    console.log('[GameOrchestrator] Initialized')
  }

  public getApp(): Application | null {
    return this.app
  }

  public getLayout(): GameLayout | null {
    return this.layout
  }

  // --- Mode Switching ---

  public setMode(mode: string): void {
    console.log(`[GameOrchestrator] Switching mode to: ${mode}`)
    // TODO: Implement actual mode switching logic (unload previous, load new)
  }

  /**
   * Cleanup method
   */
  public destroy(): void {
    this.app = null
    this.layout = null
    this.viewContainer = null
  }
}
