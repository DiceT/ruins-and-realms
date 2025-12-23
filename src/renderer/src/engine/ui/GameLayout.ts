import { Container, Rectangle, Graphics, Application } from 'pixi.js'

export interface GameLayoutOptions {
  panelWidth: number
  collapsedWidth: number
}

/**
 * GameLayout
 *
 * Manages the physical layout of the screen:
 * [ LEFT PANEL ] [    MIDDLE (MAP/WORLD)    ] [ RIGHT PANEL ]
 *
 * - Handles the "physical" animation of panels sliding in/out.
 * - resize() must be called when the window resizes.
 * - Calculates the exact viewport for the Middle pane so the Camera knows where to center.
 */
export class GameLayout {
  private app: Application

  // Containers
  public readonly root: Container
  public readonly leftPanel: Container
  public readonly rightPanel: Container
  public readonly middlePanel: Container

  // Mask for the middle panel (clips the map)
  private middleMask: Graphics

  // State
  private _leftOpen: boolean = true
  private _rightOpen: boolean = true

  // Config
  private options: GameLayoutOptions

  // Animation
  private leftTargetX: number = 0
  private rightTargetX: number = 0

  // Helper graphics for panels (in case we want to debug visualize them)
  // In production, these containers will just hold the actual UI sprites

  constructor(
    app: Application,
    options: GameLayoutOptions = { panelWidth: 300, collapsedWidth: 58 }
  ) {
    this.app = app
    this.options = options

    this.root = new Container()
    this.root.label = 'GameLayout_Root'
    this.app.stage.addChild(this.root)

    // 1. Middle Panel (The internal "World" Viewport)
    this.middlePanel = new Container()
    this.middlePanel.label = 'Panel_Middle'
    this.middlePanel.eventMode = 'static'
    this.root.addChild(this.middlePanel)

    this.middleMask = new Graphics()
    this.middlePanel.mask = this.middleMask
    this.middlePanel.addChild(this.middleMask)

    // 2. Left Panel
    this.leftPanel = new Container()
    this.leftPanel.label = 'Panel_Left'
    this.root.addChild(this.leftPanel)

    // 3. Right Panel
    this.rightPanel = new Container()
    this.rightPanel.label = 'Panel_Right'
    this.root.addChild(this.rightPanel)

    // Initialize positions
    this.resize()

    // Add specific layout ticker if needed, or rely on a tween library.
    // For now, we'll use a simple lerp in the global ticker for smoothness if animating.
    this.app.ticker.add(this.update, this)
  }

  public get state() {
    return {
      leftOpen: this._leftOpen,
      rightOpen: this._rightOpen
    }
  }

  public setLeftOpen(isOpen: boolean) {
    this._leftOpen = isOpen
    this.animateLayout()
  }

  public setRightOpen(isOpen: boolean) {
    this._rightOpen = isOpen
    this.animateLayout()
  }

  public destroy() {
    this.app.ticker.remove(this.update, this)
    this.root.destroy({ children: true })
  }

  /**
   * Main resize handler. Called when window size changes.
   * Snaps everything to current state instantly (no animation).
   */
  public resize(): void {
    const { width } = this.app.screen
    const { panelWidth, collapsedWidth } = this.options

    // 1. Calculate Target Positions based on State
    // Left Panel Visual Edge = LeftPanel.x + PanelWidth
    // However, if the panel design intends it to slide OFF screen, we might change this.
    // Based on current design: "Panel slides from 0 to -(WIDTH-GUTTER)"
    // If collapsed, x should be -(panelWidth - collapsedWidth)
    this.leftTargetX = this._leftOpen ? 0 : -(panelWidth - collapsedWidth)

    this.rightTargetX = this._rightOpen ? width - panelWidth : width - collapsedWidth

    // Snap logic for resize (don't animate during window resize, it looks laggy)
    this.leftPanel.x = this.leftTargetX
    this.rightPanel.x = this.rightTargetX

    this.updateMiddleLayout()
  }

  private animateLayout(): void {
    const { width } = this.app.screen
    const { panelWidth, collapsedWidth } = this.options

    // Recalculate targets
    this.leftTargetX = this._leftOpen ? 0 : -(panelWidth - collapsedWidth)
    this.rightTargetX = this._rightOpen ? width - panelWidth : width - collapsedWidth
  }

  /**
   * Ticker loop for smooth animation
   */
  private update(): void {
    // Simple Lerp for smoothness
    const speed = 0.2

    if (Math.abs(this.leftPanel.x - this.leftTargetX) > 0.5) {
      this.leftPanel.x += (this.leftTargetX - this.leftPanel.x) * speed
      this.updateMiddleLayout() // Middle depends on exact panel positions
    } else {
      this.leftPanel.x = this.leftTargetX
    }

    if (Math.abs(this.rightPanel.x - this.rightTargetX) > 0.5) {
      this.rightPanel.x += (this.rightTargetX - this.rightPanel.x) * speed
      this.updateMiddleLayout()
    } else {
      this.rightPanel.x = this.rightTargetX
    }
  }

  /**
   * Recalculates the Middle Panel's position and mask based on CURRENT visual positions of side panels.
   * This ensures the map "squeezes" or "expands" in real-time during animations.
   */
  private updateMiddleLayout(): void {
    const { height } = this.app.screen
    const { panelWidth } = this.options

    // Calculate the "Visual Edge" of the panels
    // Left Panel Visual Edge = LeftPanel.x + PanelWidth
    const leftEdge = this.leftPanel.x + panelWidth

    // Right Panel Visual Edge = RightPanel.x
    const rightEdge = this.rightPanel.x

    const gapWidth = rightEdge - leftEdge

    // Safety check
    if (gapWidth < 0) return

    // Position Middleware
    this.middlePanel.x = leftEdge
    this.middlePanel.y = 0

    // Update Mask
    this.middleMask.clear().rect(0, 0, gapWidth, height).fill(0xffffff)

    // Hit Area for pointer events (crucial for map dragging)
    // Ensure at least 1px to capture events if gap is tiny?
    // Realistically gap matches visual.
    this.middlePanel.hitArea = new Rectangle(0, 0, Math.max(1, gapWidth), height)
  }

  /**
   * Returns the current dimensions of the "World Viewport"
   */
  public getMiddleBounds(): Rectangle {
    // The mask defines the visible area
    // We need global coordinates or local?
    // Usually MapEngine needs to know the width/height to center the camera.
    const { width, height } = this.middlePanel.hitArea as Rectangle
    return new Rectangle(this.middlePanel.x, this.middlePanel.y, width, height)
  }
}
