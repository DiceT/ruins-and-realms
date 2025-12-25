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
  }

  public getGridCoords(x: number, y: number): { x: number; y: number } {
    const tileSize = this.config.size
    const tx = Math.floor(x / tileSize)
    const ty = Math.floor(y / tileSize)
    return { x: tx, y: ty }
  }

  public draw(): void {
    const dungeonState = this.engine.dungeon.getState()
    const tileSize = this.config.size

    // Draw background (cover everything with base color)
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

    // Determine visible tile range to optimize drawing
    const startX = Math.max(0, Math.floor(tl.x / tileSize))
    const startY = Math.max(0, Math.floor(tl.y / tileSize))
    const endX = Math.min(dungeonState.width, Math.ceil(br.x / tileSize) + 1)
    const endY = Math.min(dungeonState.height, Math.ceil(br.y / tileSize) + 1)

    // Colors
    const colorDead = 0x293738
    const colorLive = 0xf5f8f7
    const colorActive = 0xdee9e9

    // Pass 1: Draw Fills
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const row = dungeonState.tiles[y]
        if (!row) continue
        const tile = row[x]
        if (!tile) continue

        const wx = x * tileSize
        const wy = y * tileSize

        if (tile.type === 'dead') {
          this.deadGraphics.rect(wx, wy, tileSize, tileSize).fill(colorDead)
        } else if (tile.type === 'live') {
          this.liveGraphics.rect(wx, wy, tileSize, tileSize).fill(colorLive)
          // Also draw grid lines for live area
          this.graphics.rect(wx, wy, tileSize, tileSize)
        } else if (tile.type === 'active') {
          // Active tiles: check if it's an exit (show green if unused)
          let isExit = false
          let isUsedExit = false
          for (const r of dungeonState.rooms) {
            const exit = r.exits.find((e) => e.x === x && e.y === y)
            if (exit) {
              isExit = true
              if (exit.connectedRoomId) isUsedExit = true
              break
            }
          }
          
          if (isExit && !isUsedExit) {
            // Unused exit: green #6cb456
            this.activeGraphics.rect(wx, wy, tileSize, tileSize).fill(0x6cb456)
          } else {
            // Regular active tile or used exit
            this.activeGraphics.rect(wx, wy, tileSize, tileSize).fill(colorActive)
          }
          // Also draw grid lines for active area
          this.graphics.rect(wx, wy, tileSize, tileSize)
        }
      }
    }

    // Pass 2: Draw Walls (Rule: Barrier between ACTIVE and DEAD)
    this.wallGraphics.setStrokeStyle({ width: 5, color: 0x000000 })

    for (let y = startY; y < endY; y++) {
      const row = dungeonState.tiles[y]
      if (!row) continue
      for (let x = startX; x < endX; x++) {
        const tile = row[x]
        if (!tile) continue
        // Only draw walls around active tiles
        if (tile.type !== 'active') continue

        const wx = x * tileSize
        const wy = y * tileSize

        // Check 4 neighbors
        const neighbors = [
          { nx: x, ny: y - 1, x1: wx, y1: wy, x2: wx + tileSize, y2: wy, edge: 'top' }, // top
          { nx: x, ny: y + 1, x1: wx, y1: wy + tileSize, x2: wx + tileSize, y2: wy + tileSize, edge: 'bottom' }, // bottom
          { nx: x - 1, ny: y, x1: wx, y1: wy, x2: wx, y2: wy + tileSize, edge: 'left' }, // left
          { nx: x + 1, ny: y, x1: wx + tileSize, y1: wy, x2: wx + tileSize, y2: wy + tileSize, edge: 'right' } // right
        ]

        for (const n of neighbors) {
          if (n.ny < 0 || n.ny >= dungeonState.height || n.nx < 0 || n.nx >= dungeonState.width) continue
          
          const neighborTile = dungeonState.tiles[n.ny][n.nx]
          if (neighborTile.type === 'dead') {
            // Rule: "The only exception is the ENTRANCE" (dungeon entrance tile on bottom)
            const isEntranceTile = x === dungeonState.entrance.x && y === dungeonState.entrance.y
            if (isEntranceTile && n.edge === 'bottom') continue
            this.wallGraphics.moveTo(n.x1, n.y1).lineTo(n.x2, n.y2)
          }
        }
      }
    }

    this.wallGraphics.stroke()

    // Pass 3: Interaction Hologram (50% Alpha Red/Green)
    const { mode, hoveredTile, pendingRoomSize } = this.engine.interactionState
    if (mode === 'placing_entrance' && hoveredTile.x !== -1) {
      const isValid = this.engine.dungeon.isValidEntrancePosition(hoveredTile.x, hoveredTile.y)
      const color = isValid ? 0x00ff00 : 0xff0000 // Green vs Red
      
      const wx = hoveredTile.x * tileSize
      const wy = hoveredTile.y * tileSize
      
      this.interactionGraphics.rect(wx, wy, tileSize, tileSize).fill({ color, alpha: 0.5 })
    } else if (mode === 'placing_room' && hoveredTile.x !== -1) {
      const { w, h } = pendingRoomSize
      // Check validation
      const isValidBounds = this.engine.dungeon.canPlaceRoom(hoveredTile.x, hoveredTile.y, w, h)
      
      const entrance = this.engine.dungeon.getState().entrance
      const touchesEntranceRow = (hoveredTile.y + h === entrance.y)
      const spansEntrance = (entrance.x >= hoveredTile.x && entrance.x < hoveredTile.x + w)
      
      const trulyValid = isValidBounds && touchesEntranceRow && spansEntrance
      const color = trulyValid ? 0x00ff00 : 0xff0000

      const wx = hoveredTile.x * tileSize
      const wy = hoveredTile.y * tileSize
      
      this.interactionGraphics.rect(wx, wy, w * tileSize, h * tileSize).fill({ color, alpha: 0.5 })
    } else if (mode === 'placing_exit' && hoveredTile.x !== -1) {
      const activeRoomId = this.engine.interactionState.activeRoomId
      if (activeRoomId) {
         const isValid = this.engine.dungeon.isValidExitPosition(hoveredTile.x, hoveredTile.y, activeRoomId)
         const color = isValid ? 0x00ff00 : 0xff0000

         const wx = hoveredTile.x * tileSize
         const wy = hoveredTile.y * tileSize
         
         this.interactionGraphics.rect(wx, wy, tileSize, tileSize).fill({ color, alpha: 0.5 })
      }
    } else if (mode === 'placing_new_room' && hoveredTile.x !== -1) {
      // New room placement hologram anchored to exit
      const { w, h } = this.engine.interactionState.pendingRoomSize
      const activeExitId = this.engine.interactionState.activeExitId
      
      const wx = hoveredTile.x * tileSize
      const wy = hoveredTile.y * tileSize
      
      // Simple validation: check if all tiles in the rectangle are void
      let isValid = true
      for (let dx = 0; dx < w && isValid; dx++) {
        for (let dy = 0; dy < h && isValid; dy++) {
          const tx = hoveredTile.x + dx
          const ty = hoveredTile.y + dy
          if (tx < 0 || ty < 0 || tx >= dungeonState.width || ty >= dungeonState.height) {
            isValid = false
          } else {
            const tile = dungeonState.tiles[ty][tx]
            if (tile.type !== 'live') isValid = false
          }
        }
      }
      
      // Also check room must touch the exit tile
      if (activeExitId && isValid) {
        let touchesExit = false
        let exitX = -1
        let exitY = -1
        
        // Find the exit by ID
        for (const room of dungeonState.rooms) {
          const exit = room.exits.find((e) => e.id === activeExitId)
          if (exit) {
            exitX = exit.x
            exitY = exit.y
            break
          }
        }
        
        if (exitX !== -1) {
          // Check if any tile of the proposed room is adjacent to or overlaps the exit
          for (let dx = 0; dx < w && !touchesExit; dx++) {
            for (let dy = 0; dy < h && !touchesExit; dy++) {
              const tx = hoveredTile.x + dx
              const ty = hoveredTile.y + dy
              // Check adjacency (directly next to exit) or overlap (on exit tile)
              const xDiff = Math.abs(tx - exitX)
              const yDiff = Math.abs(ty - exitY)
              if ((xDiff === 0 && yDiff <= 1) || (yDiff === 0 && xDiff <= 1)) {
                touchesExit = true
              }
            }
          }
        }
        if (!touchesExit) isValid = false
      }
      
      const color = isValid ? 0x00ff00 : 0xff0000
      this.interactionGraphics.rect(wx, wy, w * tileSize, h * tileSize).fill({ color, alpha: 0.5 })
    }

    // Pass 4: Room Hover Highlight & Tooltip
    this.hoverHighlight.clear()
    this.tooltipBg.clear()
    this.tooltipText.text = ''

    const hoveredRoomId = this.engine.interactionState.hoveredRoomId

    if (mode === 'idle' && hoveredTile.x >= 0 && hoveredTile.y >= 0) {
      // Check for special single tiles first (Entrance/Exit)
      const tile = dungeonState.tiles[hoveredTile.y]?.[hoveredTile.x]
      
      let highlightType: 'entrance' | 'exit' | 'room' | null = null
      let tooltipLabel = ''

      if (tile?.isEntrance) {
        highlightType = 'entrance'
        tooltipLabel = 'Dungeon Entrance'
      } else if (tile?.isExit) {
        highlightType = 'exit'
        tooltipLabel = 'Exit'
      } else if (hoveredRoomId) {
        highlightType = 'room'
        // Room tooltip logic
        const hoveredRoom = dungeonState.rooms.find((r) => r.id === hoveredRoomId)
        if (hoveredRoom) {
          const classificationLabels: Record<string, string> = {
            'entrance': 'Dungeon Entrance',
            'starter': 'Starter Room',
            'corridor': 'Corridor',
            'small': 'Small Room',
            'medium': 'Medium Room',
            'large': 'Large Room',
            'exit': 'Exit'
          }
          tooltipLabel = classificationLabels[hoveredRoom.classification] || 'Room'
        }
      }

      // Draw Highlight & Tooltip
      if (highlightType && tooltipLabel) {
        const highlightColor = 0x48acf6
        const wx = hoveredTile.x * tileSize
        const wy = hoveredTile.y * tileSize

        if (highlightType === 'room' && hoveredRoomId) {
           const hoveredRoom = dungeonState.rooms.find((r) => r.id === hoveredRoomId)
           if (hoveredRoom) {
              for (let ry = 0; ry < hoveredRoom.height; ry++) {
                for (let rx = 0; rx < hoveredRoom.width; rx++) {
                  const rwx = (hoveredRoom.x + rx) * tileSize
                  const rwy = (hoveredRoom.y + ry) * tileSize
                  this.hoverHighlight.rect(rwx, rwy, tileSize, tileSize).fill({ color: highlightColor, alpha: 0.75 })
                }
              }
           }
        } else {
          // Single tile highlight for Entrance/Exit
          this.hoverHighlight.rect(wx, wy, tileSize, tileSize).fill({ color: highlightColor, alpha: 0.75 })
        }

        // Draw Tooltip
        this.tooltipText.text = tooltipLabel
        
        // Position tooltip above the hovered tile
        const tooltipX = wx
        const tooltipY = wy - 30

        const textWidth = this.tooltipText.width + 16
        const textHeight = this.tooltipText.height + 8
        this.tooltipBg.roundRect(tooltipX - 8, tooltipY - 4, textWidth, textHeight, 4)
          .fill({ color: 0x2e3f41, alpha: 0.95 })
          .stroke({ width: 1, color: 0xbcd3d2 })
        
        this.tooltipText.x = tooltipX
        this.tooltipText.y = tooltipY
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
