/**
 * Label Layer
 * 
 * Renders room number labels and other text overlays.
 * Z-Index: 100
 */

import { Container, Text, TextStyle } from 'pixi.js'
import { ILayer, RoomRenderData } from './ILayer'

export interface FurthestRoomInfo {
  roomId: string
  distance: number
  rank: number
}

export interface LabelRenderData {
  rooms: RoomRenderData[]
  furthestMap?: Map<string, FurthestRoomInfo>
  totalFurthest?: number
}

export interface LabelRenderConfig {
  tileSize: number
  showRoomNumbers?: boolean
}

export class LabelLayer implements ILayer {
  private _container: Container

  constructor() {
    this._container = new Container()
  }

  get container(): Container {
    return this._container
  }

  clear(): void {
    this._container.removeChildren()
  }

  setVisible(visible: boolean): void {
    this._container.visible = visible
  }

  render(data: LabelRenderData, config: LabelRenderConfig): void {
    this.clear()

    const { rooms, furthestMap, totalFurthest = 0 } = data
    const { tileSize, showRoomNumbers = true } = config

    if (!showRoomNumbers) return

    const baseStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: Math.max(10, Math.floor(tileSize / 1.5)),
      fontWeight: 'bold',
      fill: '#FFFFFF',
      stroke: { color: '#000000', width: 2 },
      align: 'center'
    })

    for (const room of rooms) {
      const { x, y, w, h } = room.bounds
      const centerX = (x + w / 2) * tileSize
      const centerY = (y + h / 2) * tileSize

      // Extract pouchId for label (strip _L/_R suffixes)
      let displayLabel = room.id
      const match = room.id.match(/^(\d+[a-z]?)/)
      if (match) {
        displayLabel = match[1]
      }

      // Skip "copied_seed" or similar internal labels
      if (displayLabel.includes('copied') || displayLabel.includes('seed')) {
        continue
      }

      // Check if this is a "furthest" room for special styling
      const furthestInfo = furthestMap?.get(room.id)
      
      let style = baseStyle
      if (furthestInfo && totalFurthest > 0) {
        // Gold for rank 1, silver for rank 2, bronze for rank 3
        const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']
        const color = rankColors[Math.min(furthestInfo.rank - 1, 2)] || '#FFFFFF'
        style = new TextStyle({
          ...baseStyle,
          fill: color
        })
      }

      const text = new Text({
        text: displayLabel,
        style
      })
      text.anchor.set(0.5)
      text.x = centerX
      text.y = centerY

      this._container.addChild(text)
    }
  }

  destroy(): void {
    this._container.destroy({ children: true })
  }
}
