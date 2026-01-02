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
} from '../types'

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
          
          console.log(`[RoomClassifier] Found blob size: ${blob.length}, minRoomArea: ${minRoomArea}, isRoom: ${blob.length >= minRoomArea}`)

          // Check for immunity
          let isImmune = false
          if (tile.regionId && tile.regionId > 0 && state.roomSeeds && state.roomSeeds[tile.regionId - 1]) {
            const seed = state.roomSeeds[tile.regionId - 1]
            if (seed.content?.immuneToPruning) isImmune = true
          }
          
          if (blob.length >= minRoomArea || isImmune) {
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

    // Merge overlapping rooms
    const mergedRooms = this.mergeOverlappingRooms(rooms)

    // Build connections
    const connections = this.buildConnections(mergedRooms, corridors, grid, width, height)

    return { rooms: mergedRooms, corridors, connections }
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
      
      // Check for immunity
      const tile = grid[pos.x][pos.y] // Wait, pos is {x,y}
      // Actually iterate blob or just pick one tile? They should share regionId.
      let isImmune = false
      const firstTile = grid[blob[0].y][blob[0].x]
      if (firstTile.regionId && firstTile.regionId > 0 && state.roomSeeds && state.roomSeeds[firstTile.regionId - 1]) {
         const seed = state.roomSeeds[firstTile.regionId - 1]
         if (seed.content?.immuneToPruning) isImmune = true
      }

      if (blob.length >= minRoomArea || isImmune) {
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

    // Merge overlapping rooms
    const mergedRooms = this.mergeOverlappingRooms(rooms)

    // Build connections
    const connections = this.buildConnections(mergedRooms, corridors, grid, width, height)

    return { rooms: mergedRooms, corridors, connections }
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

    const w = maxX - minX + 1
    const h = maxY - minY + 1

    // Circular rooms disabled for now
    const isCircular = false

    return {
      id: `room_${idNum}`,
      regionId,
      tiles,
      bounds: { x: minX, y: minY, w, h },
      area: tiles.length,
      centroid: { x: Math.round(sumX / tiles.length), y: Math.round(sumY / tiles.length) },
      isCircular
    }
  }

  /**
   * Merge rooms with overlapping or adjacent bounding boxes
   * Preserves original rooms in subRooms array
   */
  private mergeOverlappingRooms(rooms: Room[]): Room[] {
    if (rooms.length < 2) return rooms

    // Helper to check if two bounds overlap OR are adjacent (touching)
    const boundsOverlapOrAdjacent = (a: Room['bounds'], b: Room['bounds']): boolean => {
      // Overlap: bounds intersect
      // Adjacent: bounds touch at an edge (no gap between them)
      // Use < instead of <= to include adjacency (when edges touch exactly)
      return !(a.x + a.w < b.x || b.x + b.w < a.x || 
               a.y + a.h < b.y || b.y + b.h < a.y)
    }

    // Union-find for merging rooms
    const parent = new Map<string, string>()
    for (const room of rooms) {
      parent.set(room.id, room.id)
    }

    const find = (id: string): string => {
      if (parent.get(id) !== id) {
        parent.set(id, find(parent.get(id)!))
      }
      return parent.get(id)!
    }

    const union = (a: string, b: string): void => {
      const rootA = find(a)
      const rootB = find(b)
      if (rootA !== rootB) {
        parent.set(rootB, rootA)
      }
    }

    // Find overlapping or adjacent pairs and union them
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (boundsOverlapOrAdjacent(rooms[i].bounds, rooms[j].bounds)) {
          union(rooms[i].id, rooms[j].id)
        }
      }
    }

    // Group rooms by their root
    const groups = new Map<string, Room[]>()
    for (const room of rooms) {
      const root = find(room.id)
      if (!groups.has(root)) {
        groups.set(root, [])
      }
      groups.get(root)!.push(room)
    }

    // Create merged rooms
    const mergedRooms: Room[] = []
    let mergedIdCounter = 0

    for (const [_root, groupRooms] of groups) {
      if (groupRooms.length === 1) {
        // No merge needed
        mergedRooms.push(groupRooms[0])
      } else {
        // Merge these rooms
        const allTiles: GridCoord[] = []
        const tileSet = new Set<string>()
        
        for (const room of groupRooms) {
          for (const tile of room.tiles) {
            const key = `${tile.x},${tile.y}`
            if (!tileSet.has(key)) {
              tileSet.add(key)
              allTiles.push(tile)
            }
          }
        }

        // Calculate merged bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        let sumX = 0, sumY = 0

        for (const t of allTiles) {
          minX = Math.min(minX, t.x)
          minY = Math.min(minY, t.y)
          maxX = Math.max(maxX, t.x)
          maxY = Math.max(maxY, t.y)
          sumX += t.x
          sumY += t.y
        }

        const w = maxX - minX + 1
        const h = maxY - minY + 1

        const mergedRoom: Room = {
          id: `merged_room_${mergedIdCounter++}`,
          regionId: groupRooms[0].regionId, // Use first room's region
          tiles: allTiles,
          bounds: { x: minX, y: minY, w, h },
          area: allTiles.length,
          centroid: { x: Math.round(sumX / allTiles.length), y: Math.round(sumY / allTiles.length) },
          isCircular: false, // Merged rooms can't be circular
          subRooms: groupRooms,
          isMerged: true
        }

        mergedRooms.push(mergedRoom)
      }
    }

    return mergedRooms
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
