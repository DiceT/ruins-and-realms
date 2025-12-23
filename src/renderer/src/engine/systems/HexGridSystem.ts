import { BaseGridSystem } from './BaseGridSystem'
import { MapEngine } from '../MapEngine'

/**
 * Hex Grid System - Draws a pointy-top hexagonal grid.
 */
export class HexGridSystem extends BaseGridSystem {
  constructor(engine: MapEngine) {
    super(engine)
  }

  public draw() {
    const app = this.engine.app
    const camera = this.engine.camera

    // Calculate visible world bounds using camera.toWorld (same as Plough)
    const tl = camera.toWorld(0, 0)
    const br = camera.toWorld(app.screen.width, app.screen.height)

    // Add padding to prevent pop-in
    const pad = this.config.size * 2
    const startX = tl.x - pad
    const endX = br.x + pad
    const startY = tl.y - pad
    const endY = br.y + pad

    // Draw background
    this.drawBackground(startX, startY, endX - startX, endY - startY)

    // Draw hex grid
    this.graphics.clear()

    const R = this.config.size
    const w = Math.sqrt(3) * R
    const h = 2 * R
    const horiz = w
    const vert = h * 0.75

    const startCol = Math.floor(startX / horiz)
    const endCol = Math.ceil(endX / horiz)
    const startRow = Math.floor(startY / vert)
    const endRow = Math.ceil(endY / vert)

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const offset = r % 2 !== 0 ? w / 2 : 0
        const cx = c * w + offset
        const cy = r * vert
        this.drawHex(cx, cy, R)
      }
    }

    // Stroke
    this.graphics.stroke({
      width: this.config.thickness,
      color: this.config.gridColor,
      alpha: this.config.gridAlpha
    })
  }

  private drawHex(cx: number, cy: number, r: number) {
    // Pointy-top hex: starts at 30 degrees
    const angleOffset = Math.PI / 6

    this.graphics.moveTo(cx + r * Math.cos(angleOffset), cy + r * Math.sin(angleOffset))

    for (let i = 1; i <= 6; i++) {
      const angle = angleOffset + (i * Math.PI) / 3
      this.graphics.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }
  }
}
