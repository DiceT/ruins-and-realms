import { Graphics, Text, TextStyle } from 'pixi.js'
import { BaseGridSystem } from './BaseGridSystem'
import { MapEngine } from '../MapEngine'

/**
 * Square Grid System - Draws a rectangular grid of squares.
 * Uses same drawing approach as Plough Map Engine.
 */
export class SquareGridSystem extends BaseGridSystem {
  private liveGraphics: Graphics
  private deadGraphics: Graphics
  private activeGraphics: Graphics
  private wallGraphics: Graphics
  private interactionGraphics: Graphics
  private hoverHighlight: Graphics
  private tooltipBg: Graphics
  private tooltipText: Text

  constructor(engine: MapEngine) {
    super(engine)

    this.liveGraphics = new Graphics()
    this.engine.layers.live.addChild(this.liveGraphics)

    this.deadGraphics = new Graphics()
    this.engine.layers.dead.addChild(this.deadGraphics)

    this.activeGraphics = new Graphics()
    this.engine.layers.active.addChild(this.activeGraphics)

    this.wallGraphics = new Graphics()
    this.engine.layers.wall.addChild(this.wallGraphics)

    this.interactionGraphics = new Graphics()
    this.engine.layers.interaction.addChild(this.interactionGraphics)

    // Room hover highlight
    this.hoverHighlight = new Graphics()
    this.engine.layers.interaction.addChild(this.hoverHighlight)

    // Tooltip background and text
    this.tooltipBg = new Graphics()
    this.engine.layers.interaction.addChild(this.tooltipBg)

    const tooltipStyle = new TextStyle({
      fontFamily: 'serif',
      fontSize: 14,
      fill: '#bcd3d2',
      align: 'center'
    })
    this.tooltipText = new Text({ text: '', style: tooltipStyle })
    this.engine.layers.interaction.addChild(this.tooltipText)

    // Interaction Listeners (Handled by MapEngine ticker now)
  }

  public getGridCoords(x: number, y: number): { x: number; y: number } {
    const tileSize = this.config.size
    const tx = Math.floor(x / tileSize)
    const ty = Math.floor(y / tileSize)
    return { x: tx, y: ty }
  }

  public draw(): void {
    // Dungeon-specific rendering removed - now handled by SeedGrowthRenderer
    // This method now only draws a basic grid for overworld/debug purposes
    
    const tileSize = this.config.size
    const app = this.engine.app
    const camera = this.engine.camera
    const tl = camera.toWorld(0, 0)
    const br = camera.toWorld(app.screen.width, app.screen.height)

    // Pad to avoid flickering at edges
    const pad = tileSize * 2
    this.drawBackground(tl.x - pad, tl.y - pad, br.x - tl.x + pad * 2, br.y - tl.y + pad * 2)

    this.graphics.clear()
    this.liveGraphics.clear()
    this.deadGraphics.clear()
    this.activeGraphics.clear()
    this.wallGraphics.clear()
    this.interactionGraphics.clear()
    this.hoverHighlight.clear()
    this.tooltipBg.clear()
    this.tooltipText.text = ''

    // Draw a simple grid for debugging/overworld
    const startX = Math.max(0, Math.floor(tl.x / tileSize))
    const startY = Math.max(0, Math.floor(tl.y / tileSize))
    const endX = Math.ceil(br.x / tileSize) + 1
    const endY = Math.ceil(br.y / tileSize) + 1

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const wx = x * tileSize
        const wy = y * tileSize
        this.graphics.rect(wx, wy, tileSize, tileSize)
      }
    }

    this.graphics.stroke({
      width: this.config.thickness,
      color: this.config.gridColor,
      alpha: this.config.gridAlpha
    })
  }
  public getPixelCoords(col: number, row: number): { x: number; y: number } {
    const size = this.config.size
    const x = col * size + size / 2
    const y = row * size + size / 2
    return { x, y }
  }
}
