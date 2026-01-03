/**
 * Debug Layer
 * 
 * Renders debug overlays: heatmap and walkmap.
 * Z-Index: 90
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { ILayer, RoomRenderData, TilePosition } from './ILayer'

export interface DebugRenderData {
  rooms: RoomRenderData[]
  spineTiles: TilePosition[]
  walkableTiles?: Set<string>
  roomCosts?: Map<string, number>
  roomTraversals?: Map<string, number>
  doorTraversals?: Map<string, number>
}

export interface DebugRenderConfig {
  tileSize: number
  showHeatMap: boolean
  showWalkmap: boolean
}

export class DebugLayer implements ILayer {
  private _container: Container
  private heatMapLayer: Graphics
  private walkmapLayer: Container

  constructor() {
    this._container = new Container()
    this.heatMapLayer = new Graphics()
    this.walkmapLayer = new Container()
    
    this._container.addChild(this.heatMapLayer)
    this._container.addChild(this.walkmapLayer)
  }

  get container(): Container {
    return this._container
  }

  clear(): void {
    this.heatMapLayer.clear()
    this.walkmapLayer.removeChildren()
  }

  /**
   * Set visibility for sub-layers
   */
  setVisibility(heatMap: boolean, walkmap: boolean): void {
    this.heatMapLayer.visible = heatMap
    this.walkmapLayer.visible = walkmap
  }

  render(data: DebugRenderData, config: DebugRenderConfig): void {
    this.clear()

    const { rooms, spineTiles } = data
    const { tileSize, showHeatMap, showWalkmap } = config

    // Always render graphics (visibility controlled separately)
    this.renderHeatMap(rooms, spineTiles, tileSize)
    this.renderWalkmap(data, tileSize)

    this.setVisibility(showHeatMap, showWalkmap)
  }

  private renderHeatMap(rooms: RoomRenderData[], spineTiles: TilePosition[], size: number): void {
    const scores = this.calculateWallHeatScores(rooms, spineTiles)

    // Color scale helper
    const scoreToColor = (s: number): number => {
      if (s <= -20) return 0x00FF00 // Green (Best - Double Shared)
      if (s < -5) return 0x00FFFF   // Cyan (Good - Center/Edge)
      if (s < 5) return 0xFFFF00    // Yellow (Neutral)
      if (s < 50) return 0xFF8800   // Orange (Spine Adj)
      return 0xFF0000               // Red (Corner/Blocked)
    }

    for (const [key, score] of scores.entries()) {
      const [x, y] = key.split(',').map(Number)
      this.heatMapLayer.rect(x * size, y * size, size, size)
      this.heatMapLayer.fill({ color: scoreToColor(score), alpha: 0.5 })
    }
  }

  private calculateWallHeatScores(rooms: RoomRenderData[], spineTiles: TilePosition[]): Map<string, number> {
    const heatScores = new Map<string, number>()
    const spineSet = new Set<string>(spineTiles.map(t => `${t.x},${t.y}`))

    const checkSpineAdj = (x: number, y: number) => {
      return spineSet.has(`${x},${y - 1}`) ||
        spineSet.has(`${x},${y + 1}`) ||
        spineSet.has(`${x - 1},${y}`) ||
        spineSet.has(`${x + 1},${y}`)
    }

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds

      // North and South walls
      for (let dx = 0; dx < w; dx++) {
        const dist = Math.abs(dx - Math.floor((w - 1) / 2))
        const isEdge = dx === 0 || dx === w - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)

        // North
        const nKey = `${x + dx},${y - 1}`
        if (checkSpineAdj(x + dx, y - 1)) bonus += 20
        heatScores.set(nKey, (heatScores.get(nKey) || 0) + bonus)

        // South
        const sKey = `${x + dx},${y + h}`
        if (checkSpineAdj(x + dx, y + h)) bonus += 20
        heatScores.set(sKey, (heatScores.get(sKey) || 0) + bonus)
      }

      // West and East walls
      for (let dy = 0; dy < h; dy++) {
        const dist = Math.abs(dy - Math.floor((h - 1) / 2))
        const isEdge = dy === 0 || dy === h - 1
        let bonus = isEdge ? -5 : (dist === 0 ? -10 : 0)

        // West
        const wKey = `${x - 1},${y + dy}`
        if (checkSpineAdj(x - 1, y + dy)) bonus += 20
        heatScores.set(wKey, (heatScores.get(wKey) || 0) + bonus)

        // East
        const eKey = `${x + w},${y + dy}`
        if (checkSpineAdj(x + w, y + dy)) bonus += 20
        heatScores.set(eKey, (heatScores.get(eKey) || 0) + bonus)
      }

      // Diagonal corners (high penalty)
      const corners = [
        { x: x - 1, y: y - 1 },
        { x: x + w, y: y - 1 },
        { x: x - 1, y: y + h },
        { x: x + w, y: y + h }
      ]
      for (const c of corners) {
        const key = `${c.x},${c.y}`
        heatScores.set(key, (heatScores.get(key) || 0) + 100)
      }
    }

    return heatScores
  }

  private renderWalkmap(data: DebugRenderData, size: number): void {
    const { walkableTiles, roomCosts, rooms, roomTraversals, doorTraversals } = data

    if (!walkableTiles) return

    const graphics = new Graphics()
    graphics.fillStyle = { color: 0xADD8E6, alpha: 0.5 } // Light blue

    for (const key of walkableTiles) {
      const [x, y] = key.split(',').map(Number)
      graphics.rect(x * size, y * size, size, size)
      graphics.fill()
    }

    this.walkmapLayer.addChild(graphics)

    // Render labels
    const labelStyle: Partial<TextStyle> = {
      fontFamily: 'Arial',
      fontSize: Math.max(10, Math.floor(size / 2.5)),
      fontWeight: 'normal',
      fill: '#000000',
      align: 'center'
    }

    for (const room of rooms) {
      const cx = room.bounds.x + room.bounds.w / 2
      const cy = room.bounds.y + room.bounds.h / 2

      // Movement costs
      const cost = roomCosts?.get(room.id)
      if (cost !== undefined) {
        const text = new Text({ text: `(${cost})`, style: labelStyle })
        text.anchor.set(0.5)
        text.x = cx * size
        text.y = (cy - 0.5) * size
        this.walkmapLayer.addChild(text)
      }

      // Traversal counts
      const roomCount = roomTraversals?.get(room.id) ?? 0
      const doorCount = doorTraversals?.get(room.id) ?? 0
      const traversalLabel = new Text({
        text: `R:${roomCount} D:${doorCount}`,
        style: labelStyle
      })
      traversalLabel.anchor.set(0.5)
      traversalLabel.x = cx * size
      traversalLabel.y = (cy + 0.5) * size
      this.walkmapLayer.addChild(traversalLabel)
    }
  }

  destroy(): void {
    this.heatMapLayer.destroy()
    this.walkmapLayer.destroy({ children: true })
    this._container.destroy({ children: true })
  }
}
