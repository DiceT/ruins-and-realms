import { EngineCore } from './core/EngineCore'
import type { DiceTheme, RollResult } from './types'
import { DiceColors } from './DiceColors'

export type RollEventHandler = (result: RollResult) => void

export class DiceEngine {
  private engineCore: EngineCore | null = null
  private container: HTMLElement | null = null
  private listeners: { [key: string]: Function[] } = {}
  private _pendingRollResolve: ((results: RollResult) => void) | null = null
  private _pendingOptions: { meta?: any } | undefined

  constructor() {
    // Pre-load colors/textures if needed, or wait for initialize
    new DiceColors()
  }

  public getEngineCore(): EngineCore | null {
    return this.engineCore
  }

  /**
   * Initialize the 3D Engine into the given container.
   */
  public initialize(container: HTMLElement) {
    if (this.engineCore) {
      // If already initialized, just update the container if it changed
      if (this.container !== container) {
        console.log('DiceEngine re-parenting to new container.')
        this.container = container
        // Move the canvas to the new container
        if (this.engineCore.getRenderer().domElement.parentElement !== container) {
          container.appendChild(this.engineCore.getRenderer().domElement)
        }
        // Trigger resize to fit new container
        this.engineCore.handleResize(container)
      }
      return
    }
    this.container = container
    this.engineCore = new EngineCore(container)

    // Hook internal events
    this.engineCore.rollController.onRollComplete = (results) => {
      // Attach pending options if any (handled structurally by merging)
      const augmentedResults = this._pendingOptions
        ? { ...results, meta: this._pendingOptions.meta }
        : results

      this.emit('rollComplete', augmentedResults)

      if (this._pendingRollResolve) {
        this._pendingRollResolve(augmentedResults)
        this._pendingRollResolve = null
      }
      this._pendingOptions = undefined
    }

    this.engineCore.start()
    console.log('DiceEngine initialized.')
  }

  /**
   * Roll dice based on notation (e.g., "2d20", "4d6").
   * Returns a Promise that resolves with the results when the roll settles.
   */
  /**
   * Roll dice based on notation (e.g., "2d20", "4d6") or a list of options.
   * Returns a Promise that resolves with the results when the roll settles.
   */
  public async roll(
    request: string | import('./types').DiceRollRequest[],
    options?: { meta?: any }
  ): Promise<RollResult> {
    if (!this.engineCore) throw new Error('Engine not initialized')

    return new Promise((resolve) => {
      // Cancel previous pending if any?
      if (this._pendingRollResolve) {
        this._pendingRollResolve({ total: 0, notation: 'Cancelled', breakdown: [], modifier: 0 })
      }
      this._pendingRollResolve = resolve
      this._pendingOptions = options

      // Pass options through event if needed, or just store for complete
      this.emit('rollStart', { request, options })

      this.engineCore!.rollController.roll(request)
    })
  }

  /**
   * Reposition dice to specific world coordinates and rotations.
   */
  public async repositionDice(targets: import('./types').DiePositionRequest[], duration?: number) {
    if (this.engineCore) {
      await this.engineCore.rollController.repositionDice(targets, duration)
    }
  }

  /**
   * Clear all dice from the table.
   */
  public clear() {
    if (this.engineCore) {
      this.engineCore.rollController.clear()
    }
  }

  public getWorldPosition(
    screenX: number,
    screenY: number
  ): { x: number; y: number; z: number } | null {
    if (!this.engineCore || !this.container) return null

    const rect = this.container.getBoundingClientRect()
    // Normalize coordinates to -1 to +1, with inverted Y
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1

    const vec = this.engineCore.getWorldPosition(ndcX, ndcY)
    return { x: vec.x, y: vec.y, z: vec.z }
  }

  /**
   * Update the visual theme of the dice.
   */
  public setTheme(theme: Partial<DiceTheme>) {
    if (this.engineCore) {
      // We need the full settings object structure for EngineCore currently,
      // or we update just the theme part.
      // EngineCore.updateSettings takes AppSettings.
      // This is a bit of a mismatch. We should expose updateTheme on EngineCore or access rollController directly.

      // For now, let's access rollController directly as EngineCore exposes it.
      // But we need to merge with existing defaults if partial.
      // Actually EngineCore.updateSettings re-sets everything.

      // Let's rely on the App passing full settings for now,
      // OR we implement a specific method in EngineCore.

      // Allow direct access for granular updates:
      // This requires the current full theme state.
      // The Engine doesn't store state, the App does.
      // So this method might be state-less (just applies to current dice).

      // Ideally the App manages state. Use `updateTheme` to push changes.
      // For this API, we assume the caller tracks state.
      this.engineCore.rollController.updateTheme(theme as DiceTheme) // Cast for now, controller handles it?
    }
  }

  public resize() {
    if (this.engineCore && this.container) {
      // Trigger resize on EngineCore
      this.engineCore.handleResize(this.container)
      // Also update physics bounds to match new visible area
      this.engineCore.fitBoundsToScreen()
    }
  }

  public destroy() {
    if (this.engineCore) {
      this.engineCore.destroy()
      this.engineCore = null
    }
  }

  // --- Event Emitter ---
  public on(event: 'rollStart' | 'rollComplete', fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }

  public off(event: 'rollStart' | 'rollComplete', fn: Function) {
    if (!this.listeners[event]) return
    this.listeners[event] = this.listeners[event].filter((f) => f !== fn)
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => fn(data))
    }
  }
}

// Export a singleton instance for simplicity
export const diceEngine = new DiceEngine()
