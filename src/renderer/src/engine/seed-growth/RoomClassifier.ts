/**
 * Room Classifier for Seed Growth Dungeon
 * 
 * Two approaches:
 * A) Flood Fill: Simple area-based classification
 * B) Thickness: Distance-based classification (more robust)
 */

import {
  SeedGrowthState,
  GridTile,
  GridCoord,
  Room,
  Corridor,
  Connection,
  RoomClassificationMode
} from './types'

export class RoomClassifier {
  
  /**
   * Classify tiles into rooms and corridors
   */
  public classify(
    state: SeedGrowthState,
    minRoomArea: number,
    maxCorridorWidth: number,
    mode: RoomClassificationMode
  ): { rooms: Room[]; corridors: Corridor[]; connections: Connection[] } {
    if (mode === 'thickness') {
      return this.classifyByThickness(state, minRoomArea, maxCorridorWidth)
    } else {
      return this.classifyByFloodFill(state, minRoomArea)
    }
  }

  // ===========================================================================
  // Approach A: Flood Fill (Simple)
  // ===========================================================================

  private classifyByFloodFill(
    state: SeedGrowthState,
    minRoomArea: number
  ): { rooms: Room[]; corridors: Corridor[]; connections: Connection[] } {
    const { grid } = state
    const height = grid.length
    const width = grid[0]?.length || 0

    const visited = new Set<string>()
    const rooms: Room[] = []
    const corridorTiles: GridCoord[] = []
    let roomIdCounter = 0

    // Find all floor tiles and flood fill contiguous regions
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x]
        const key = `${x},${y}`
        
        if (tile.state === 'floor' && !visited.has(key)) {
          // Flood fill to find contiguous area
          const blob = this.floodFill(grid, x, y, visited)
          
          if (blob.length >= minRoomArea) {
            // This is a room
            const room = this.createRoom(blob, tile.regionId || 0, roomIdCounter++)
            rooms.push(room)
            
            // Mark tiles as belonging to this room
            for (const pos of blob) {
              grid[pos.y][pos.x].roomId = room.id
              grid[pos.y][pos.x].isCorridor = false
            }
          } else {
            // Too small, classify as corridor
            corridorTiles.push(...blob)
            for (const pos of blob) {
              grid[pos.y][pos.x].isCorridor = true
              grid[pos.y][pos.x].roomId = null
            }
          }
        }
      }
    }

    // Group corridor tiles by region
    const corridors = this.groupCorridorsByRegion(corridorTiles, grid)

    // Build connections
    const connections = this.buildConnections(rooms, corridors, grid, width, height)

    return { rooms, corridors, connections }
  }

  private floodFill(grid: GridTile[][], startX: number, startY: number, visited: Set<string>): GridCoord[] {
    const result: GridCoord[] = []
    const stack: GridCoord[] = [{ x: startX, y: startY }]
    const height = grid.length
    const width = grid[0]?.length || 0

    while (stack.length > 0) {
      const pos = stack.pop()!
      const key = `${pos.x},${pos.y}`
      
      if (visited.has(key)) continue
      if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) continue
      
      const tile = grid[pos.y][pos.x]
      if (tile.state !== 'floor') continue
      
      visited.add(key)
      result.push(pos)
      
      // Add 4-neighbors
      stack.push({ x: pos.x + 1, y: pos.y })
      stack.push({ x: pos.x - 1, y: pos.y })
      stack.push({ x: pos.x, y: pos.y + 1 })
      stack.push({ x: pos.x, y: pos.y - 1 })
    }

    return result
  }

  // ===========================================================================
  // Approach B: Thickness-Based (Robust)
  // ===========================================================================

  private classifyByThickness(
    state: SeedGrowthState,
    minRoomArea: number,
    maxCorridorWidth: number
  ): { rooms: Room[]; corridors: Corridor[]; connections: Connection[] } {
    const { grid } = state
    const height = grid.length
    const width = grid[0]?.length || 0

    // Step 1: Calculate thickness for each floor tile
    this.calculateThickness(grid, width, height)

    // Step 2: Classify tiles based on thickness
    const roomTiles: GridCoord[] = []
    const corridorTiles: GridCoord[] = []

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x]
        if (tile.state === 'floor') {
          const thickness = tile.thickness || 0
          if (thickness > maxCorridorWidth) {
            roomTiles.push({ x, y })
            tile.isCorridor = false
          } else {
            corridorTiles.push({ x, y })
            tile.isCorridor = true
          }
        }
      }
    }

    // Step 3: Flood fill room tiles into room blobs
    const visited = new Set<string>()
    const rooms: Room[] = []
    let roomIdCounter = 0

    for (const pos of roomTiles) {
      const key = `${pos.x},${pos.y}`
      if (visited.has(key)) continue

      // Flood fill only room tiles
      const blob = this.floodFillRoomTiles(grid, pos.x, pos.y, visited, maxCorridorWidth)
      
      if (blob.length >= minRoomArea) {
        const tile = grid[pos.y][pos.x]
        const room = this.createRoom(blob, tile.regionId || 0, roomIdCounter++)
        rooms.push(room)
        
        for (const p of blob) {
          grid[p.y][p.x].roomId = room.id
        }
      } else {
        // Too small, reclassify as corridor
        for (const p of blob) {
          grid[p.y][p.x].isCorridor = true
          grid[p.y][p.x].roomId = null
          corridorTiles.push(p)
        }
      }
    }

    // Group corridors
    const corridors = this.groupCorridorsByRegion(corridorTiles, grid)

    // Build connections
    const connections = this.buildConnections(rooms, corridors, grid, width, height)

    return { rooms, corridors, connections }
  }

  private calculateThickness(grid: GridTile[][], width: number, height: number): void {
    // Distance transform: for each floor tile, compute distance to nearest non-floor
    // Using simple iterative approach (could use proper distance transform for perf)
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x]
        if (tile.state === 'floor') {
          tile.thickness = this.distanceToWall(grid, x, y, width, height)
        }
      }
    }
  }

  private distanceToWall(grid: GridTile[][], x: number, y: number, width: number, height: number): number {
    // BFS to find nearest non-floor tile
    const visited = new Set<string>()
    const queue: { x: number; y: number; dist: number }[] = [{ x, y, dist: 0 }]

    while (queue.length > 0) {
      const current = queue.shift()!
      const key = `${current.x},${current.y}`

      if (visited.has(key)) continue
      visited.add(key)

      // Check if this is a wall/empty
      if (current.x < 0 || current.x >= width || current.y < 0 || current.y >= height) {
        return current.dist
      }
      if (grid[current.y][current.x].state !== 'floor') {
        return current.dist
      }

      // Add neighbors
      queue.push({ x: current.x + 1, y: current.y, dist: current.dist + 1 })
      queue.push({ x: current.x - 1, y: current.y, dist: current.dist + 1 })
      queue.push({ x: current.x, y: current.y + 1, dist: current.dist + 1 })
      queue.push({ x: current.x, y: current.y - 1, dist: current.dist + 1 })
    }

    return 0
  }

  private floodFillRoomTiles(
    grid: GridTile[][],
    startX: number,
    startY: number,
    visited: Set<string>,
    maxCorridorWidth: number
  ): GridCoord[] {
    const result: GridCoord[] = []
    const stack: GridCoord[] = [{ x: startX, y: startY }]
    const height = grid.length
    const width = grid[0]?.length || 0

    while (stack.length > 0) {
      const pos = stack.pop()!
      const key = `${pos.x},${pos.y}`
      
      if (visited.has(key)) continue
      if (pos.x < 0 || pos.x >= width || pos.y < 0 || pos.y >= height) continue
      
      const tile = grid[pos.y][pos.x]
      if (tile.state !== 'floor') continue
      if ((tile.thickness || 0) <= maxCorridorWidth) continue // Only room tiles
      
      visited.add(key)
      result.push(pos)
      
      stack.push({ x: pos.x + 1, y: pos.y })
      stack.push({ x: pos.x - 1, y: pos.y })
      stack.push({ x: pos.x, y: pos.y + 1 })
      stack.push({ x: pos.x, y: pos.y - 1 })
    }

    return result
  }

  // ===========================================================================
  // Shared Helpers
  // ===========================================================================

  private createRoom(tiles: GridCoord[], regionId: number, idNum: number): Room {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let sumX = 0, sumY = 0

    for (const t of tiles) {
      minX = Math.min(minX, t.x)
      minY = Math.min(minY, t.y)
      maxX = Math.max(maxX, t.x)
      maxY = Math.max(maxY, t.y)
      sumX += t.x
      sumY += t.y
    }

    return {
      id: `room_${idNum}`,
      regionId,
      tiles,
      bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      area: tiles.length,
      centroid: { x: Math.round(sumX / tiles.length), y: Math.round(sumY / tiles.length) }
    }
  }

  private groupCorridorsByRegion(tiles: GridCoord[], grid: GridTile[][]): Corridor[] {
    const byRegion = new Map<number, GridCoord[]>()
    
    for (const pos of tiles) {
      const regionId = grid[pos.y][pos.x].regionId || 0
      if (!byRegion.has(regionId)) {
        byRegion.set(regionId, [])
      }
      byRegion.get(regionId)!.push(pos)
    }

    const corridors: Corridor[] = []
    let idCounter = 0
    for (const [regionId, regionTiles] of byRegion) {
      corridors.push({
        id: `corridor_${idCounter++}`,
        regionId,
        tiles: regionTiles
      })
    }

    return corridors
  }

  private buildConnections(
    rooms: Room[],
    _corridors: Corridor[],
    grid: GridTile[][],
    width: number,
    height: number
  ): Connection[] {
    const connections: Connection[] = []
    const seen = new Set<string>()

    // Check each room for adjacency to corridors and other rooms
    for (const room of rooms) {
      for (const pos of room.tiles) {
        // Check neighbors
        const neighbors = [
          { x: pos.x + 1, y: pos.y },
          { x: pos.x - 1, y: pos.y },
          { x: pos.x, y: pos.y + 1 },
          { x: pos.x, y: pos.y - 1 }
        ]

        for (const n of neighbors) {
          if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue
          const nTile = grid[n.y][n.x]
          
          // Check if neighbor is a different room
          if (nTile.roomId && nTile.roomId !== room.id) {
            const key = [room.id, nTile.roomId].sort().join('-')
            if (!seen.has(key)) {
              seen.add(key)
              connections.push({ roomA: room.id, roomB: nTile.roomId })
            }
          }
          
          // Check if neighbor is a corridor (connection via corridor)
          if (nTile.isCorridor) {
            // Find which rooms this corridor connects to
            // (simplified: just note the corridor connection)
          }
        }
      }
    }

    return connections
  }
}
