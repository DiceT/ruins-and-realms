import { BaseGridSystem } from './BaseGridSystem'
import { MapEngine } from '../MapEngine'

/**
 * Hex Grid System - Draws a pointy-top hexagonal grid.
 */
export class HexGridSystem extends BaseGridSystem {
  constructor(engine: MapEngine) {
    super(engine)
  }

  public draw(): void {
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

    // SAFETY: Prevent infinite loops if camera math goes wrong
    // Max 500x500 hexes visible at once (plenty for any zoom level)
    const maxDimension = 500
    if (endCol - startCol > maxDimension || endRow - startRow > maxDimension) {
      // console.warn('HexGridSystem: Too many hexes to draw. Skipping frame.')
      return
    }

    // Gap / Edge Spacing Calculation
    // Use inset radius. Reduce radius by fixed amount to create requested larger gap.
    const gap = 5
    const drawR = R - gap

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const offset = r % 2 !== 0 ? w / 2 : 0
        const cx = c * w + offset
        const cy = r * vert
      this.drawHex(cx, cy, drawR > 0 ? drawR : 1) // Prevent negative radius
      }
    }

    // Stroke
    this.graphics.stroke({
      width: this.config.thickness,
      color: 0x333333,
      alpha: 1.0
    })

    // Override background color to match 'LIVE' tiles from SquareGridSystem (0xf5f8f7)
    this.background.clear()
    this.background.rect(startX, startY, endX - startX, endY - startY).fill(0xf5f8f7)

    // --- GHOST RENDERING ---
    this.drawGhost(w, vert)
  }

  public getGridCoords(x: number, y: number): { x: number; y: number } {
    const size = this.config.size

    // 1. Pixel to Axial (Floating Point)
    // https://www.redblobgames.com/grids/hexagons/#pixel-to-hex
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size
    const r = (2 / 3 * y) / size

    // 2. Round to nearest Hex (Cube Coordinates)
    return this.hexRound(q, r)
  }

  /**
   * Rounds fractional axial coordinates (q, r) to the nearest integer hex (col, row).
   * Uses Cube Rounding algorithm to handle edge cases correctly.
   */
  private hexRound(fracQ: number, fracR: number): { x: number; y: number } {
    let q = Math.round(fracQ)
    let r = Math.round(fracR)
    let s = Math.round(-fracQ - fracR)

    const q_diff = Math.abs(q - fracQ)
    const r_diff = Math.abs(r - fracR)
    const s_diff = Math.abs(s - (-fracQ - fracR))

    if (q_diff > r_diff && q_diff > s_diff) {
      q = -r - s
    } else if (r_diff > s_diff) {
      r = -q - s
    } else {
      s = -q - r
    }

    // 3. Convert Axial (q, r) to Offset (Odd-R)
    // "Odd-R" convention: odd rows are shoved right by +0.5 w
    // col = q + (r - (r&1)) / 2
    // row = r
    const col = q + (r - (r & 1)) / 2
    const row = r

    return { x: col, y: row }
  }

  /**
   * Returns the center pixel coordinates (x, y) for a given hex (col, row).
   * Uses Odd-R offset convention.
   */
  public getPixelCoords(col: number, row: number): { x: number; y: number } {
      const size = this.config.size
      const w = Math.sqrt(3) * size
      const h = 2 * size
      const vert = h * 0.75
      
      const offset = row % 2 !== 0 ? w / 2 : 0
      const cx = col * w + offset
      const cy = row * vert
      
      return { x: cx, y: cy }
  }

  private drawGhost(w: number, vert: number): void {
    const { mode, hoveredTile } = this.engine.interactionState
    if (Number.isNaN(hoveredTile.x)) return

    if (mode === 'placing_city' || mode === 'placing_terrain') {
        const c = hoveredTile.x
        const row = hoveredTile.y
        
        const offset = row % 2 !== 0 ? w / 2 : 0
        const cx = c * w + offset
        const cy = row * vert
        
        this.graphics.moveTo(cx, cy) // Just to ensure context
        
        // Check validity if callback provided
        let isValid = true
        if (this.engine.options.onValidatePlacement) {
            isValid = this.engine.options.onValidatePlacement(c, row)
        }

        // Draw filled hex at alpha
        // Color: Valid = CYAN/GREEN, Invalid = RED
        let color = mode === 'placing_city' ? 0x00FFFF : 0x00FF00
        if (!isValid) {
            color = 0xFF0000 
        }

        this.graphics.poly(this.getHexPoly(cx, cy, this.config.size - 5))
        this.graphics.fill({ color, alpha: 0.5 })
    }
  }

  private getHexPoly(cx: number, cy: number, r: number): number[] {
      const points: number[] = []
      const angleOffset = Math.PI / 6
      for (let i = 0; i < 6; i++) {
        const angle = angleOffset + (i * Math.PI) / 3
        points.push(cx + r * Math.cos(angle))
        points.push(cy + r * Math.sin(angle))
      }
      return points
  }

  private drawHex(cx: number, cy: number, r: number): void {
    // Pointy-top hex: starts at 30 degrees
    // Draw broken grid (corners only)
    const angleOffset = Math.PI / 6
    const corners: { x: number; y: number }[] = []

    // 1. Calculate vertices
    for (let i = 0; i < 6; i++) {
      const angle = angleOffset + (i * Math.PI) / 3
      corners.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      })
    }

    // 2. Draw "V" shape at each corner (25% of edge length)
    const breakRatio = 0.25

    for (let i = 0; i < 6; i++) {
      const curr = corners[i]
      const prev = corners[(i + 5) % 6]
      const next = corners[(i + 1) % 6]

      // Vector from prev -> curr
      const dx1 = curr.x - prev.x
      const dy1 = curr.y - prev.y
      
      // Vector from curr -> next
      const dx2 = next.x - curr.x
      const dy2 = next.y - curr.y

      // Start of "V" segment (backwards along previous edge)
      const startX = curr.x - dx1 * breakRatio
      const startY = curr.y - dy1 * breakRatio

      // End of "V" segment (forwards along next edge)
      const endX = curr.x + dx2 * breakRatio
      const endY = curr.y + dy2 * breakRatio

      // Draw the corner
      this.graphics.moveTo(startX, startY)
      this.graphics.lineTo(curr.x, curr.y)
      this.graphics.lineTo(endX, endY)
    }
  }
}
