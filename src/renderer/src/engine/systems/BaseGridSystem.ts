import { Graphics } from 'pixi.js'
import { MapEngine } from '../MapEngine'

export interface GridConfig {
  bgColor: number
  gridColor: number
  gridAlpha: number
  thickness: number
  size: number
}

/**
 * Base class for all grid systems.
 * Each map has ONE grid type, determined at creation time.
 */
export abstract class BaseGridSystem {
  protected engine: MapEngine
  protected graphics: Graphics
  protected background: Graphics

  public config: GridConfig = {
    bgColor: 0x354e50,
    gridColor: 0xbcd3d2,
    gridAlpha: 0.5,
    thickness: 1.5,
    size: 50
  }

  constructor(engine: MapEngine) {
    this.engine = engine

    // Background layer
    this.background = new Graphics()
    this.engine.layers.background.addChild(this.background)

    // Grid layer
    this.graphics = new Graphics()
    this.engine.layers.grid.addChild(this.graphics)
  }

  /**
   * Called each frame to redraw the grid based on visible area.
   */
  public abstract draw(): void

  /**
   * Common background drawing logic.
   */
  protected drawBackground(startX: number, startY: number, width: number, height: number): void {
    this.background.clear()
    this.background.rect(startX, startY, width, height)
    this.background.fill(this.config.bgColor)
  }
}
