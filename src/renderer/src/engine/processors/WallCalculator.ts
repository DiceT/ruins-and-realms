/**
 * Wall Calculator
 * 
 * Computes wall positions based on room and corridor floor tiles.
 * This is dungeon generation logic, separated from rendering.
 */

import { RoomRenderData, TilePosition } from '../layers/ILayer'

export interface WallCalculatorInput {
  rooms: RoomRenderData[]
  corridorTiles: TilePosition[]
  gridWidth: number
  gridHeight: number
}

export interface WallCalculatorOutput {
  floorSet: Set<string>
  wallSet: Set<string>
}

/**
 * Build a set of all floor positions from rooms and corridors
 */
export function buildFloorSet(rooms: RoomRenderData[], corridorTiles: TilePosition[]): Set<string> {
  const floorSet = new Set<string>()

  for (const room of rooms) {
    const { x, y, w, h } = room.bounds
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        floorSet.add(`${x + dx},${y + dy}`)
      }
    }
  }

  for (const pos of corridorTiles) {
    floorSet.add(`${pos.x},${pos.y}`)
  }

  return floorSet
}

/**
 * Find wall positions (tiles adjacent to floor but not floor themselves)
 */
export function findWallPositions(floorSet: Set<string>, gridWidth: number, gridHeight: number): Set<string> {
  const wallSet = new Set<string>()
  const neighbors = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [1, -1], [-1, 1], [1, 1]
  ]

  for (const key of floorSet) {
    const [x, y] = key.split(',').map(Number)

    for (const [dx, dy] of neighbors) {
      const nx = x + dx
      const ny = y + dy
      const neighborKey = `${nx},${ny}`

      // Relaxed bounds for border padding
      if (nx >= -2 && nx < gridWidth + 2 && ny >= -2 && ny < gridHeight + 2) {
        if (!floorSet.has(neighborKey)) {
          wallSet.add(neighborKey)
        }
      }
    }
  }

  return wallSet
}

/**
 * Calculate both floor and wall sets from input data
 */
export function calculateWalls(input: WallCalculatorInput): WallCalculatorOutput {
  const { rooms, corridorTiles, gridWidth, gridHeight } = input
  const floorSet = buildFloorSet(rooms, corridorTiles)
  const wallSet = findWallPositions(floorSet, gridWidth, gridHeight)
  return { floorSet, wallSet }
}
