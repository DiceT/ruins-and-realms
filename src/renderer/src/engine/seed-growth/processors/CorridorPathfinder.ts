import { GridCoord, Room, SeedGrowthState, Direction } from '../types'
import { SeededRNG } from '../../../utils/SeededRNG'

interface PathNode {
  x: number
  y: number
  dir: Direction | null
  g: number // Cost from start
  h: number // Heuristic cost to end
  parent: PathNode | null
}

// Direction offsets for navigation
const DIR_OFFSETS: { [key in Direction]: { dx: number; dy: number } } = {
  north: { dx: 0, dy: -1 },
  south: { dx: 0, dy: 1 },
  east: { dx: 1, dy: 0 },
  west: { dx: -1, dy: 0 }
}

// Opposite directions
const OPPOSITE_DIR: { [key in Direction]: Direction } = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east'
}

export class CorridorPathfinder {
  // Base costs
  private readonly BASE_COST = 10
  private readonly TURN_PENALTY = 40
  private readonly ROOM_INTERIOR_PENALTY = 500
  private readonly ADJACENT_ROOM_PENALTY = 10
  private readonly CORRIDOR_ON_BONUS = -15
  private readonly CORRIDOR_ADJ_BONUS = -5
  private readonly CORNER_PENALTY = 500

  // Addendum: Anti-hug and Runway
  private readonly HUG_PENALTY = 60
  private readonly RUNWAY_LENGTH = 2

  // Door negotiation
  private readonly ALIGNMENT_CHANCE = 0.75 // 75% preference for aligned entry lines

  private width: number = 0
  private height: number = 0
  private reservedCorridors: Set<string> = new Set()
  private roomTiles: Set<string> = new Set()
  private cornerTiles: Set<string> = new Set()
  private roomBoundaryTiles: Set<string> = new Set()
  private circularEdgeTiles: Set<string> = new Set() // Edge tiles of circular rooms (for +500 penalty)
  
  // Negotiated door positions: Map<"roomId:targetRoomId", GridCoord>
  private negotiatedDoors: Map<string, GridCoord> = new Map()
  private rng: SeededRNG

  constructor(seed: string = 'default') {
    this.rng = new SeededRNG(seed)
  }

  /**
   * Main entry point to generate corridors for the dungeon
   */
  public generate(state: SeedGrowthState, rooms: Room[]): { x: number; y: number }[] {
    if (rooms.length < 2) return []

    this.width = state.grid[0].length
    this.height = state.grid.length
    this.reservedCorridors.clear()
    this.roomTiles.clear()
    this.cornerTiles.clear()
    this.roomBoundaryTiles.clear()
    this.circularEdgeTiles.clear()
    this.negotiatedDoors.clear()

    // 1. Precompute room tiles, corner penalties, and boundary tiles
    for (const room of rooms) {
      for (const tile of room.tiles) {
        this.roomTiles.add(`${tile.x},${tile.y}`)
      }
      this.identifyCornerPenalties(room)
      this.identifyRoomBoundary(room)
      if (room.isCircular) {
        this.identifyCircularEdgeTiles(room)
      }
    }

    // 2. Build MST to decide which rooms to connect
    const mstEdges = this.buildRoomMST(rooms)
    
    // 3. Find potential loop edges (close rooms that create cycles)
    const loopEdges = this.findLoopEdges(rooms, mstEdges)
    
    // 4. Combine MST and loop edges
    const allEdges = [...mstEdges, ...loopEdges]

    // 5. Negotiate door positions for all rooms (including loops)
    this.negotiateDoorPositions(rooms, allEdges)

    // 6. Route each edge sequentially using negotiated doors
    const allCorridorTiles: { x: number; y: number }[] = []
    
    // Sort edges by distance (descending) to encourage long spines first
    allEdges.sort((a, b) => b.distance - a.distance)

    for (const edge of allEdges) {
      const path = this.routeCorridorWithNegotiatedDoors(edge.from, edge.to)
      if (path) {
        for (const pos of path) {
          const key = `${pos.x},${pos.y}`
          // Skip tiles that are inside rooms or already reserved
          if (this.roomTiles.has(key)) continue
          if (!this.reservedCorridors.has(key)) {
            this.reservedCorridors.add(key)
            allCorridorTiles.push(pos)
          }
        }
      }
    }

    return allCorridorTiles
  }

  /**
   * Find potential loop edges beyond the MST
   * Only considers close rooms (gap <= 5 tiles) with 50% chance
   */
  private findLoopEdges(
    rooms: Room[], 
    mstEdges: { from: Room; to: Room; distance: number }[]
  ): { from: Room; to: Room; distance: number }[] {
    const LOOP_CHANCE = 0.5 // 50% chance for eligible pairs
    const MAX_GAP = 5 // Only consider rooms within 5 tiles of each other
    
    // Build set of already-connected room pairs
    const connected = new Set<string>()
    for (const edge of mstEdges) {
      connected.add(`${edge.from.id}:${edge.to.id}`)
      connected.add(`${edge.to.id}:${edge.from.id}`)
    }
    
    const loopEdges: { from: Room; to: Room; distance: number }[] = []
    
    // Consider all room pairs not already connected
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const roomA = rooms[i]
        const roomB = rooms[j]
        const key = `${roomA.id}:${roomB.id}`
        
        if (connected.has(key)) continue
        
        // Check if rooms are close enough for a loop
        const gap = this.getRoomGap(roomA, roomB)
        if (gap > MAX_GAP) continue
        
        // Roll 50% chance for loop
        if (this.rng.next() < LOOP_CHANCE) {
          const distance = this.distance(roomA.centroid, roomB.centroid)
          loopEdges.push({ from: roomA, to: roomB, distance })
          
          // Mark as connected to avoid duplicate loops
          connected.add(key)
          connected.add(`${roomB.id}:${roomA.id}`)
        }
      }
    }
    
    return loopEdges
  }

  /**
   * Get the gap (in tiles) between two rooms
   * Returns 0 if overlapping/adjacent, or the minimum gap distance
   */
  private getRoomGap(roomA: Room, roomB: Room): number {
    const a = roomA.bounds
    const b = roomB.bounds
    
    const horizontalGap = this.getHorizontalGap(a, b)
    const verticalGap = this.getVerticalGap(a, b)
    
    // If one gap is 0 (overlapping on that axis), return the other
    if (horizontalGap === 0) return verticalGap
    if (verticalGap === 0) return horizontalGap
    
    // Diagonal - return Manhattan distance of gaps
    return horizontalGap + verticalGap
  }

  /**
   * Negotiate door positions for all rooms based on their connections
   * Implements shared entry line preference (75% alignment)
   */
  private negotiateDoorPositions(rooms: Room[], edges: { from: Room; to: Room; distance: number }[]): void {
    // Build a map of room connections: roomId -> list of connected rooms
    const roomConnections = new Map<string, Room[]>()
    
    for (const room of rooms) {
      roomConnections.set(room.id, [])
    }
    
    for (const edge of edges) {
      roomConnections.get(edge.from.id)!.push(edge.to)
      roomConnections.get(edge.to.id)!.push(edge.from)
    }

    // For each room, determine door positions based on number of connections
    for (const room of rooms) {
      const connections = roomConnections.get(room.id)!
      if (connections.length === 0) continue

      if (connections.length === 1) {
        // Single connection: use centered door (75%) or any position (25%)
        this.negotiateSingleDoor(room, connections[0])
      } else {
        // Multiple connections: try to create shared entry line
        this.negotiateMultiDoors(room, connections)
      }
    }
  }

  /**
   * Negotiate door position for a room with a single connection
   */
  private negotiateSingleDoor(room: Room, target: Room): void {
    const facingWall = this.getFacingWall(room, target)
    const { x, y, w, h } = room.bounds
    
    let doorPos: GridCoord
    
    if (this.rng.next() < this.ALIGNMENT_CHANCE) {
      // 75%: Use center of facing wall
      doorPos = this.getCenterDoorPosition(room, facingWall)
    } else {
      // 25%: Use any valid position on facing wall
      doorPos = this.getRandomDoorPosition(room, facingWall)
    }
    
    this.negotiatedDoors.set(`${room.id}:${target.id}`, doorPos)
  }

  /**
   * Negotiate door positions for a room with multiple connections
   * Tries to create a shared entry line
   */
  private negotiateMultiDoors(room: Room, targets: Room[]): void {
    // Group targets by facing wall
    const wallGroups = new Map<Direction, Room[]>()
    
    for (const target of targets) {
      const wall = this.getFacingWall(room, target)
      if (!wallGroups.has(wall)) {
        wallGroups.set(wall, [])
      }
      wallGroups.get(wall)!.push(target)
    }

    // Determine if we can create a shared entry line (75% chance)
    const useSharedEntryLine = this.rng.next() < this.ALIGNMENT_CHANCE
    
    if (useSharedEntryLine) {
      // Calculate the optimal entry line based on connection directions
      const entryLine = this.calculateSharedEntryLine(room, wallGroups)
      
      // Place all doors aligned to this entry line
      for (const [wall, wallTargets] of wallGroups) {
        for (const target of wallTargets) {
          const doorPos = this.getAlignedDoorPosition(room, wall, entryLine)
          this.negotiatedDoors.set(`${room.id}:${target.id}`, doorPos)
        }
      }
    } else {
      // 25%: Place doors independently (no alignment)
      for (const target of targets) {
        const wall = this.getFacingWall(room, target)
        const doorPos = this.getRandomDoorPosition(room, wall)
        this.negotiatedDoors.set(`${room.id}:${target.id}`, doorPos)
      }
    }
  }

  /**
   * Determine which wall of roomA faces roomB
   */
  private getFacingWall(roomA: Room, roomB: Room): Direction {
    const dx = roomB.centroid.x - roomA.centroid.x
    const dy = roomB.centroid.y - roomA.centroid.y
    
    // Choose the dominant direction
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'east' : 'west'
    } else {
      return dy > 0 ? 'south' : 'north'
    }
  }

  /**
   * Get the center door position for a wall
   */
  private getCenterDoorPosition(room: Room, wall: Direction): GridCoord {
    const { x, y, w, h } = room.bounds
    
    switch (wall) {
      case 'north': return { x: x + Math.floor(w / 2), y: y - 1 }
      case 'south': return { x: x + Math.floor(w / 2), y: y + h }
      case 'west': return { x: x - 1, y: y + Math.floor(h / 2) }
      case 'east': return { x: x + w, y: y + Math.floor(h / 2) }
    }
  }

  /**
   * Get a random valid door position for a wall
   */
  private getRandomDoorPosition(room: Room, wall: Direction): GridCoord {
    const { x, y, w, h } = room.bounds
    
    switch (wall) {
      case 'north': return { x: x + Math.floor(this.rng.next() * w), y: y - 1 }
      case 'south': return { x: x + Math.floor(this.rng.next() * w), y: y + h }
      case 'west': return { x: x - 1, y: y + Math.floor(this.rng.next() * h) }
      case 'east': return { x: x + w, y: y + Math.floor(this.rng.next() * h) }
    }
  }

  /**
   * Calculate the shared entry line position based on wall connections
   * Returns either an X coordinate (for N/S walls sharing a column) or Y coordinate (for E/W walls sharing a row)
   */
  private calculateSharedEntryLine(room: Room, wallGroups: Map<Direction, Room[]>): { type: 'row' | 'column'; value: number } {
    const { x, y, w, h } = room.bounds
    const walls = Array.from(wallGroups.keys())
    
    // Check for perpendicular walls that can share an entry line
    const hasNorth = walls.includes('north')
    const hasSouth = walls.includes('south')
    const hasEast = walls.includes('east')
    const hasWest = walls.includes('west')
    
    // Prefer entry line that accommodates the most connections
    if ((hasNorth || hasSouth) && (hasEast || hasWest)) {
      // Perpendicular connections - pick a corner area
      if (hasNorth && hasWest) {
        return { type: 'row', value: y } // Top-left entry line
      } else if (hasNorth && hasEast) {
        return { type: 'row', value: y } // Top-right entry line
      } else if (hasSouth && hasWest) {
        return { type: 'row', value: y + h - 1 } // Bottom-left entry line
      } else {
        return { type: 'row', value: y + h - 1 } // Bottom-right entry line
      }
    } else if (hasNorth || hasSouth) {
      // Only N/S walls - use center column
      return { type: 'column', value: x + Math.floor(w / 2) }
    } else {
      // Only E/W walls - use center row
      return { type: 'row', value: y + Math.floor(h / 2) }
    }
  }

  /**
   * Get door position aligned to the shared entry line
   */
  private getAlignedDoorPosition(room: Room, wall: Direction, entryLine: { type: 'row' | 'column'; value: number }): GridCoord {
    const { x, y, w, h } = room.bounds
    
    if (entryLine.type === 'row') {
      // Entry line is a row - doors on N/S walls use this row's X, E/W doors use this row
      switch (wall) {
        case 'north': return { x: x + Math.floor(w / 2), y: y - 1 }
        case 'south': return { x: x + Math.floor(w / 2), y: y + h }
        case 'west': return { x: x - 1, y: entryLine.value }
        case 'east': return { x: x + w, y: entryLine.value }
      }
    } else {
      // Entry line is a column - doors on E/W walls use this column's Y, N/S doors use this column
      switch (wall) {
        case 'north': return { x: entryLine.value, y: y - 1 }
        case 'south': return { x: entryLine.value, y: y + h }
        case 'west': return { x: x - 1, y: y + Math.floor(h / 2) }
        case 'east': return { x: x + w, y: y + Math.floor(h / 2) }
      }
    }
  }

  /**
   * Route a corridor using pre-negotiated door positions
   */
  private routeCorridorWithNegotiatedDoors(startRoom: Room, endRoom: Room): GridCoord[] | null {
    // FAST PATH: Check if rooms are 1-2 tiles apart - skip negotiation entirely
    const directCorridor = this.getDirectCorridorIfClose(startRoom, endRoom)
    if (directCorridor) {
      return directCorridor
    }

    // Get negotiated door positions
    const startDoorKey = `${startRoom.id}:${endRoom.id}`
    const endDoorKey = `${endRoom.id}:${startRoom.id}`
    
    let startDoor = this.negotiatedDoors.get(startDoorKey)
    let endDoor = this.negotiatedDoors.get(endDoorKey)
    
    // Fallback to old method if no negotiated position
    if (!startDoor || !endDoor) {
      return this.routeCorridor(startRoom, endRoom)
    }
    
    // If doors are the same tile, return single tile
    if (startDoor.x === endDoor.x && startDoor.y === endDoor.y) {
      return [startDoor]
    }
    
    // Check if tiles are adjacent (no routing needed)
    const dx = Math.abs(startDoor.x - endDoor.x)
    const dy = Math.abs(startDoor.y - endDoor.y)
    if (dx + dy === 1) {
      return [startDoor, endDoor]
    }
    
    // A* route between negotiated doors
    const startDir = this.getDoorExitDirection(startRoom, startDoor)
    const path = this.routeAStar(startDoor, endDoor, startDir)
    
    return path
  }

  /**
   * Check if rooms are 1-2 tiles apart and return a direct straight corridor
   * Skips negotiation entirely for close rooms
   */
  private getDirectCorridorIfClose(roomA: Room, roomB: Room): GridCoord[] | null {
    const a = roomA.bounds
    const b = roomB.bounds

    // Check vertical separation (A above B or B above A)
    const verticalGap = this.getVerticalGap(a, b)
    if (verticalGap >= 1 && verticalGap <= 2) {
      // Find X overlap
      const overlapStart = Math.max(a.x, b.x)
      const overlapEnd = Math.min(a.x + a.w, b.x + b.w)
      if (overlapStart < overlapEnd) {
        // Use center of overlap
        const midX = Math.floor((overlapStart + overlapEnd) / 2)
        const corridor: GridCoord[] = []
        
        if (a.y + a.h <= b.y) {
          // A is above B
          for (let ty = a.y + a.h; ty < b.y; ty++) {
            corridor.push({ x: midX, y: ty })
          }
        } else {
          // B is above A
          for (let ty = b.y + b.h; ty < a.y; ty++) {
            corridor.push({ x: midX, y: ty })
          }
        }
        return corridor
      }
    }

    // Check horizontal separation (A left of B or B left of A)
    const horizontalGap = this.getHorizontalGap(a, b)
    if (horizontalGap >= 1 && horizontalGap <= 2) {
      // Find Y overlap
      const overlapStart = Math.max(a.y, b.y)
      const overlapEnd = Math.min(a.y + a.h, b.y + b.h)
      if (overlapStart < overlapEnd) {
        // Use center of overlap
        const midY = Math.floor((overlapStart + overlapEnd) / 2)
        const corridor: GridCoord[] = []
        
        if (a.x + a.w <= b.x) {
          // A is left of B
          for (let tx = a.x + a.w; tx < b.x; tx++) {
            corridor.push({ x: tx, y: midY })
          }
        } else {
          // B is left of A
          for (let tx = b.x + b.w; tx < a.x; tx++) {
            corridor.push({ x: tx, y: midY })
          }
        }
        return corridor
      }
    }

    return null // Not close enough for direct corridor
  }

  /**
   * Get vertical gap between two room bounds (0 if overlapping or adjacent)
   */
  private getVerticalGap(a: Room['bounds'], b: Room['bounds']): number {
    if (a.y + a.h <= b.y) {
      return b.y - (a.y + a.h)
    } else if (b.y + b.h <= a.y) {
      return a.y - (b.y + b.h)
    }
    return 0 // Overlapping or adjacent
  }

  /**
   * Get horizontal gap between two room bounds (0 if overlapping or adjacent)
   */
  private getHorizontalGap(a: Room['bounds'], b: Room['bounds']): number {
    if (a.x + a.w <= b.x) {
      return b.x - (a.x + a.w)
    } else if (b.x + b.w <= a.x) {
      return a.x - (b.x + b.w)
    }
    return 0 // Overlapping or adjacent
  }

  /**
   * Determine the exit direction from a room based on door position
   */
  private getDoorExitDirection(room: Room, door: GridCoord): Direction {
    const { x, y, w, h } = room.bounds
    
    if (door.y < y) return 'north'
    if (door.y >= y + h) return 'south'
    if (door.x < x) return 'west'
    if (door.x >= x + w) return 'east'
    
    return 'north' // Fallback
  }

  /**
   * Identify the specific diagonal tiles outside room corners
   */
  private identifyCornerPenalties(room: Room): void {
    const { x, y, w, h } = room.bounds
    const corners = [
      { x: x - 1, y: y - 1 },
      { x: x + w, y: y - 1 },
      { x: x - 1, y: y + h },
      { x: x + w, y: y + h }
    ]
    for (const c of corners) {
      this.cornerTiles.add(`${c.x},${c.y}`)
    }
  }

  /**
   * Identify tiles immediately adjacent (1 tile) to room boundary
   */
  private identifyRoomBoundary(room: Room): void {
    const { x, y, w, h } = room.bounds
    // Top and bottom edges
    for (let dx = 0; dx < w; dx++) {
      this.roomBoundaryTiles.add(`${x + dx},${y - 1}`)
      this.roomBoundaryTiles.add(`${x + dx},${y + h}`)
    }
    // Left and right edges
    for (let dy = 0; dy < h; dy++) {
      this.roomBoundaryTiles.add(`${x - 1},${y + dy}`)
      this.roomBoundaryTiles.add(`${x + w},${y + dy}`)
    }
  }

  /**
   * Identify all tiles in and around circular room bounding box that are NOT door candidates
   * These get +500 penalty to prevent non-cardinal entry and keep corridors away from circle walls
   */
  private identifyCircularEdgeTiles(room: Room): void {
    const { x, y, w, h } = room.bounds
    const centerX = x + Math.floor(w / 2)
    const centerY = y + Math.floor(h / 2)
    
    // Door candidate positions (4 cardinal directions at center of each edge)
    const doorPositions = new Set<string>([
      `${centerX},${y - 1}`,      // North
      `${centerX},${y + h}`,      // South
      `${x - 1},${centerY}`,      // West
      `${x + w},${centerY}`,      // East
    ])
    
    // Mark ALL tiles in the bounding box plus 1-tile border, except door candidates
    for (let dy = -1; dy <= h; dy++) {
      for (let dx = -1; dx <= w; dx++) {
        const tx = x + dx
        const ty = y + dy
        const key = `${tx},${ty}`
        
        // Skip interior room tiles (they already have room interior penalty)
        if (dx >= 0 && dx < w && dy >= 0 && dy < h) continue
        
        // Skip door candidates
        if (doorPositions.has(key)) continue
        
        this.circularEdgeTiles.add(key)
      }
    }
  }

  /**
   * Build a Minimum Spanning Tree of rooms
   */
  private buildRoomMST(rooms: Room[]): { from: Room; to: Room; distance: number }[] {
    const edges: { from: Room; to: Room; distance: number }[] = []
    const connected = new Set<string>([rooms[0].id])
    const unconnected = new Set<string>(rooms.slice(1).map(r => r.id))
    const roomMap = new Map<string, Room>(rooms.map(r => [r.id, r]))

    while (unconnected.size > 0) {
      let bestDist = Infinity
      let bestFrom: Room | null = null
      let bestTo: Room | null = null

      for (const connectedId of connected) {
        const from = roomMap.get(connectedId)!
        for (const unconnectedId of unconnected) {
          const to = roomMap.get(unconnectedId)!
          const dist = Math.abs(from.centroid.x - to.centroid.x) + Math.abs(from.centroid.y - to.centroid.y)
          if (dist < bestDist) {
            bestDist = dist
            bestFrom = from
            bestTo = to
          }
        }
      }

      if (bestFrom && bestTo) {
        edges.push({ from: bestFrom, to: bestTo, distance: bestDist })
        connected.add(bestTo.id)
        unconnected.delete(bestTo.id)
      } else break
    }
    return edges
  }

  /**
   * Route a corridor directly from door approach to door approach
   */
  private routeCorridor(startRoom: Room, endRoom: Room): GridCoord[] | null {
    // Check if rooms share a wall (only 1 tile separation)
    const sharedApproach = this.findSharedWallApproach(startRoom, endRoom)
    if (sharedApproach) {
      // Rooms are adjacent with 1-tile gap - just return that single tile
      return [sharedApproach]
    }

    // Get door approach candidates (closest to target room)
    const startApproach = this.getDoorApproach(startRoom, endRoom.centroid)
    const endApproach = this.getDoorApproach(endRoom, startRoom.centroid)

    if (!startApproach || !endApproach) return null

    // If approaches are the same tile, return single tile
    if (startApproach.cell.x === endApproach.cell.x && startApproach.cell.y === endApproach.cell.y) {
      return [startApproach.cell]
    }

    // A* from start approach to end approach, with initial direction to prevent jitter
    const path = this.routeAStar(startApproach.cell, endApproach.cell, startApproach.dir)
    if (!path) return null

    return path
  }

  /**
   * Check if two rooms share a wall (1 tile gap between them)
   * Returns the shared wall tile if they do, null otherwise
   */
  private findSharedWallApproach(roomA: Room, roomB: Room): GridCoord | null {
    const a = roomA.bounds
    const b = roomB.bounds

    // Check vertical separation (A above B or B above A)
    if (a.y + a.h === b.y - 1) {
      // A is above B with 1 row gap
      const overlapStart = Math.max(a.x, b.x)
      const overlapEnd = Math.min(a.x + a.w, b.x + b.w)
      if (overlapStart < overlapEnd) {
        // Use middle of overlap
        const midX = Math.floor((overlapStart + overlapEnd) / 2)
        return { x: midX, y: a.y + a.h }
      }
    }
    if (b.y + b.h === a.y - 1) {
      // B is above A with 1 row gap
      const overlapStart = Math.max(a.x, b.x)
      const overlapEnd = Math.min(a.x + a.w, b.x + b.w)
      if (overlapStart < overlapEnd) {
        const midX = Math.floor((overlapStart + overlapEnd) / 2)
        return { x: midX, y: b.y + b.h }
      }
    }

    // Check horizontal separation (A left of B or B left of A)
    if (a.x + a.w === b.x - 1) {
      // A is left of B with 1 column gap
      const overlapStart = Math.max(a.y, b.y)
      const overlapEnd = Math.min(a.y + a.h, b.y + b.h)
      if (overlapStart < overlapEnd) {
        const midY = Math.floor((overlapStart + overlapEnd) / 2)
        return { x: a.x + a.w, y: midY }
      }
    }
    if (b.x + b.w === a.x - 1) {
      // B is left of A with 1 column gap
      const overlapStart = Math.max(a.y, b.y)
      const overlapEnd = Math.min(a.y + a.h, b.y + b.h)
      if (overlapStart < overlapEnd) {
        const midY = Math.floor((overlapStart + overlapEnd) / 2)
        return { x: b.x + b.w, y: midY }
      }
    }

    return null
  }

  /**
   * Standard A* routing between two points
   * @param initialDir - Optional forced direction for the first step (prevents jitter)
   */
  private routeAStar(start: GridCoord, end: GridCoord, initialDir?: Direction): GridCoord[] | null {
    const openList: PathNode[] = [{
      ...start,
      dir: initialDir || null, // Use initial direction as the "current" direction for first node
      g: 0,
      h: this.distance(start, end) * 10,
      parent: null
    }]
    const closedList = new Map<string, number>()
    
    // Track if this is the first step (from start node)
    const startKey = `${start.x},${start.y}`

    while (openList.length > 0) {
      openList.sort((a, b) => (a.g + a.h) - (b.g + b.h))
      const current = openList.shift()!

      const key = `${current.x},${current.y},${current.dir}`
      if (closedList.has(key) && closedList.get(key)! <= current.g) continue
      closedList.set(key, current.g)

      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(current)
      }

      const neighbors = [
        { x: current.x, y: current.y - 1, dir: 'north' as Direction },
        { x: current.x, y: current.y + 1, dir: 'south' as Direction },
        { x: current.x + 1, y: current.y, dir: 'east' as Direction },
        { x: current.x - 1, y: current.y, dir: 'west' as Direction },
      ]

      for (const n of neighbors) {
        if (!this.inBounds(n.x, n.y)) continue

        // First step constraint: if initialDir is set and this is the first step,
        // ONLY allow moving in the initialDir direction
        const isFirstStep = `${current.x},${current.y}` === startKey
        if (isFirstStep && initialDir && n.dir !== initialDir) {
          continue // Skip non-straight first moves entirely
        }

        const moveCost = this.calculateCost(current, n)
        if (moveCost === Infinity) continue

        const g = current.g + moveCost
        const h = this.distance(n, end) * 10
        openList.push({ ...n, g, h, parent: current })
      }
    }

    return null
  }

  /**
   * Calculate movement cost including anti-hug penalty
   */
  private calculateCost(current: PathNode, next: { x: number; y: number; dir: Direction }): number {
    let cost = this.BASE_COST

    // Turn Penalty
    if (current.dir && current.dir !== next.dir) {
      cost += this.TURN_PENALTY
    }

    const key = `${next.x},${next.y}`

    // Room Interior - completely impassable (corridors must never pass through rooms)
    if (this.roomTiles.has(key)) {
      return Infinity
    }
    
    // Adjacent to Room Interior (soft walls)
    if (this.isAdjacentToRoom(next.x, next.y)) {
      cost += this.ADJACENT_ROOM_PENALTY
    }

    // Corridor merging incentives
    if (this.reservedCorridors.has(key)) {
      cost += this.CORRIDOR_ON_BONUS
    } else if (this.isAdjacentToCorridor(next.x, next.y)) {
      cost += this.CORRIDOR_ADJ_BONUS
    }

    // Corner Penalty
    if (this.cornerTiles.has(key)) {
      cost += this.CORNER_PENALTY
    }

    // Anti-Hug Penalty: If adjacent to room and moving tangent to wall
    if (this.isHuggingRoom(next.x, next.y, next.dir)) {
      cost += this.HUG_PENALTY
    }

    // Circular Edge Penalty: Non-door edges of circular rooms
    if (this.circularEdgeTiles.has(key)) {
      cost += this.CORNER_PENALTY // Reuse +500 penalty
    }

    return Math.max(1, cost)
  }

  /**
   * Check if a move at (x,y) in direction dir is "hugging" a room wall
   * (moving tangent/parallel to an adjacent room wall)
   */
  private isHuggingRoom(x: number, y: number, moveDir: Direction): boolean {
    // Check each cardinal direction for adjacent room
    const adjacentDirs: { dir: Direction; nx: number; ny: number }[] = [
      { dir: 'north', nx: x, ny: y - 1 },
      { dir: 'south', nx: x, ny: y + 1 },
      { dir: 'east', nx: x + 1, ny: y },
      { dir: 'west', nx: x - 1, ny: y },
    ]

    for (const adj of adjacentDirs) {
      const adjKey = `${adj.nx},${adj.ny}`
      if (this.roomTiles.has(adjKey) || this.roomBoundaryTiles.has(`${x},${y}`)) {
        // Room is adjacent in this direction. Check if move is tangent.
        // If room is E/W, tangent moves are N/S
        // If room is N/S, tangent moves are E/W
        if ((adj.dir === 'east' || adj.dir === 'west') && (moveDir === 'north' || moveDir === 'south')) {
          return true
        }
        if ((adj.dir === 'north' || adj.dir === 'south') && (moveDir === 'east' || moveDir === 'west')) {
          return true
        }
      }
    }
    return false
  }

  /**
   * Get a door approach cell (tile outside room boundary)
   */
  private getDoorApproach(room: Room, target: GridCoord): { cell: GridCoord; dir: Direction } | null {
    const { x, y, w, h } = room.bounds
    const candidates: { cell: GridCoord; dir: Direction }[] = []

    // For circular rooms, only 4 door candidates at cardinal directions
    if (room.isCircular) {
      const centerX = x + Math.floor(w / 2)
      const centerY = y + Math.floor(h / 2)
      
      candidates.push(
        { cell: { x: centerX, y: y - 1 }, dir: 'north' },
        { cell: { x: centerX, y: y + h }, dir: 'south' },
        { cell: { x: x - 1, y: centerY }, dir: 'west' },
        { cell: { x: x + w, y: centerY }, dir: 'east' }
      )
    } else {
      // Rectangular rooms: all edge tiles
      for (let dx = 0; dx < w; dx++) {
        candidates.push({ cell: { x: x + dx, y: y - 1 }, dir: 'north' })
        candidates.push({ cell: { x: x + dx, y: y + h }, dir: 'south' })
      }
      for (let dy = 0; dy < h; dy++) {
        candidates.push({ cell: { x: x - 1, y: y + dy }, dir: 'west' })
        candidates.push({ cell: { x: x + w, y: y + dy }, dir: 'east' })
      }
    }

    // Filter out candidates that are out of bounds or inside other rooms
    const validCandidates = candidates.filter(c => {
      if (!this.inBounds(c.cell.x, c.cell.y)) return false
      if (this.roomTiles.has(`${c.cell.x},${c.cell.y}`)) return false
      return true
    })

    if (validCandidates.length === 0) return null

    // Pick closest to target
    validCandidates.sort((a, b) => this.distance(a.cell, target) - this.distance(b.cell, target))
    return validCandidates[0]
  }

  /**
   * Get door approach with runway validation
   */
  private getDoorApproachWithRunway(room: Room, target: GridCoord): { approachCell: GridCoord; runwayStart: GridCoord; dir: Direction } | null {
    const { x, y, w, h } = room.bounds
    const candidates: { approachCell: GridCoord; runwayStart: GridCoord; dir: Direction }[] = []

    // For circular rooms, only 4 door candidates at cardinal directions (center of each edge)
    if (room.isCircular) {
      const centerX = x + Math.floor(w / 2)
      const centerY = y + Math.floor(h / 2)
      
      const circularCandidates = [
        { approach: { x: centerX, y: y - 1 }, dir: 'north' as Direction },
        { approach: { x: centerX, y: y + h }, dir: 'south' as Direction },
        { approach: { x: x - 1, y: centerY }, dir: 'west' as Direction },
        { approach: { x: x + w, y: centerY }, dir: 'east' as Direction },
      ]
      
      for (const c of circularCandidates) {
        const runway = this.getRunwayStart(c.approach, c.dir)
        if (runway && this.isValidRunway(c.approach, c.dir)) {
          candidates.push({ approachCell: c.approach, runwayStart: runway, dir: c.dir })
        }
      }
    } else {
      // Rectangular rooms: all edge tiles including corners
      // Top edge (includes corners)
      for (let dx = 0; dx < w; dx++) {
        const approach = { x: x + dx, y: y - 1 }
        const runway = this.getRunwayStart(approach, 'north')
        if (runway && this.isValidRunway(approach, 'north')) {
          candidates.push({ approachCell: approach, runwayStart: runway, dir: 'north' })
        }
      }
      // Bottom edge (includes corners)
      for (let dx = 0; dx < w; dx++) {
        const approach = { x: x + dx, y: y + h }
        const runway = this.getRunwayStart(approach, 'south')
        if (runway && this.isValidRunway(approach, 'south')) {
          candidates.push({ approachCell: approach, runwayStart: runway, dir: 'south' })
        }
      }
      // Left edge (includes corners)
      for (let dy = 0; dy < h; dy++) {
        const approach = { x: x - 1, y: y + dy }
        const runway = this.getRunwayStart(approach, 'west')
        if (runway && this.isValidRunway(approach, 'west')) {
          candidates.push({ approachCell: approach, runwayStart: runway, dir: 'west' })
        }
      }
      // Right edge (includes corners)
      for (let dy = 0; dy < h; dy++) {
        const approach = { x: x + w, y: y + dy }
        const runway = this.getRunwayStart(approach, 'east')
        if (runway && this.isValidRunway(approach, 'east')) {
          candidates.push({ approachCell: approach, runwayStart: runway, dir: 'east' })
        }
      }
    }

    if (candidates.length === 0) {
      // Fallback: try with k=1
      return this.getDoorApproachFallback(room, target)
    }

    // Pick candidate closest to target (using runwayStart for distance)
    candidates.sort((a, b) => this.distance(a.runwayStart, target) - this.distance(b.runwayStart, target))
    return candidates[0]
  }

  /**
   * Fallback door approach with k=1 runway
   */
  private getDoorApproachFallback(room: Room, target: GridCoord): { approachCell: GridCoord; runwayStart: GridCoord; dir: Direction } | null {
    const { x, y, w, h } = room.bounds
    const candidates: { approachCell: GridCoord; runwayStart: GridCoord; dir: Direction }[] = []

    // Try with k=1 (runway = approach cell itself) - includes corners
    for (let dx = 0; dx < w; dx++) {
      candidates.push({ approachCell: { x: x + dx, y: y - 1 }, runwayStart: { x: x + dx, y: y - 1 }, dir: 'north' })
      candidates.push({ approachCell: { x: x + dx, y: y + h }, runwayStart: { x: x + dx, y: y + h }, dir: 'south' })
    }
    for (let dy = 0; dy < h; dy++) {
      candidates.push({ approachCell: { x: x - 1, y: y + dy }, runwayStart: { x: x - 1, y: y + dy }, dir: 'west' })
      candidates.push({ approachCell: { x: x + w, y: y + dy }, runwayStart: { x: x + w, y: y + dy }, dir: 'east' })
    }

    if (candidates.length === 0) return null
    candidates.sort((a, b) => this.distance(a.runwayStart, target) - this.distance(b.runwayStart, target))
    return candidates[0]
  }

  private getRunwayStart(approachCell: GridCoord, dir: Direction): GridCoord | null {
    const offset = DIR_OFFSETS[dir]
    const runwayStart = {
      x: approachCell.x + offset.dx * (this.RUNWAY_LENGTH - 1),
      y: approachCell.y + offset.dy * (this.RUNWAY_LENGTH - 1)
    }
    if (!this.inBounds(runwayStart.x, runwayStart.y)) return null
    return runwayStart
  }

  private isValidRunway(approachCell: GridCoord, dir: Direction): boolean {
    const offset = DIR_OFFSETS[dir]
    for (let i = 0; i < this.RUNWAY_LENGTH; i++) {
      const tx = approachCell.x + offset.dx * i
      const ty = approachCell.y + offset.dy * i
      if (!this.inBounds(tx, ty)) return false
      if (this.roomTiles.has(`${tx},${ty}`)) return false
    }
    return true
  }

  private distance(a: GridCoord, b: GridCoord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }

  private isAdjacentToRoom(x: number, y: number): boolean {
    const neighbors = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
    return neighbors.some(n => this.roomTiles.has(`${n.x},${n.y}`))
  }

  private isAdjacentToCorridor(x: number, y: number): boolean {
    const neighbors = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
    return neighbors.some(n => this.reservedCorridors.has(`${n.x},${n.y}`))
  }

  private reconstructPath(node: PathNode): GridCoord[] {
    const path: GridCoord[] = []
    let current: PathNode | null = node
    while (current) {
      path.push({ x: current.x, y: current.y })
      current = current.parent
    }
    return path.reverse()
  }

  /**
   * COST CONSTANTS for Tributary System
   */
  private readonly COST_VOID = 10
  private readonly COST_EXISTING_FLOOR = 1
  private readonly COST_NOISE_MAX = 5 // Random 0-5
  private readonly SPINE_GRADIENT_FACTOR = 0.5 // Cost per index distance from spine start

  /**
   * New Pathfinding Method: Tributary System
   * Connects rooms to the Spine (or existing corridors) using intelligence + organic noise
   */
  public generateSpineCorridors(
    width: number,
    height: number,
    rooms: Room[], 
    spineTiles: {x: number, y: number}[],
    heatMap: Map<string, number>,
    targetSet: Set<string>,   // Full Spine Tiles (Goal)
    blockedSet: Set<string>   // Room Floor Tiles (Avoid)
  ): { x: number; y: number }[] {
    if (rooms.length === 0 || spineTiles.length === 0) return []

    this.width = width
    this.height = height
    
    // Normalize targetSet (Full Spine)
    const connectedSet = new Set<string>(targetSet)

    // Spine Gradient Map: Distance from start (Index)
    const spineIndexMap = new Map<string, number>()
    spineTiles.forEach((t, i) => spineIndexMap.set(`${t.x},${t.y}`, i))

    // Pre-calculate per-tile noise
    const noiseMap = new Map<string, number>()
    
    const newCorridors: { x: number; y: number }[] = []

    // 1. Sort Rooms
    const sortedRooms = [...rooms].sort((a, b) => b.id.localeCompare(a.id))

    // 2. Iterate Rooms
    // Pre-calculate target goal (spine center or nearest point)
    // Optimization: Just use simplest approach -> Closest point in target set to Room Center?
    // Actually, we pass heatMap. We can add a "Distance Score" to the heat map? No.
    // In findBestRoomExit, we check candidates.
    // We should compute "Dist to Spine" for candidates.
    
    // Build a quick lookup for spine tiles? We have spineIndexMap (distance to start).
    // We want distance to ANY connected tile.
    // That is expensive to check for every wall tile (dist to set).
    // Heuristic: Center of Spine? Or simple "Distance to Center of Map" (if spine is central)?
    // Better: Room Center to Nearest Spine Tile. Use that Spine Tile as attractor.
    
    // Find nearest spine tile for each room
    const roomAttractors = new Map<string, GridCoord>()
    const spineArr = Array.from(spineTiles) // {x,y}
    
    for (const room of sortedRooms) {
        let minDist = Infinity
        let bestT = spineTiles[0]
        const rx = room.bounds.x + room.bounds.w/2
        const ry = room.bounds.y + room.bounds.h/2
        
        for (const t of spineTiles) {
            const d = Math.abs(t.x - rx) + Math.abs(t.y - ry)
            if (d < minDist) {
                minDist = d
                bestT = t
            }
        }
        roomAttractors.set(room.id, bestT)
    }

    for (const room of sortedRooms) {
      const attractor = roomAttractors.get(room.id) || {x: this.width/2, y: this.height/2}
      
      // Find best start point on room wall
      // Pass attractor to break ties
      const startPoint = this.findBestRoomExit(room, heatMap, blockedSet, attractor)
      if (!startPoint) continue

      // Start A*
      const path = this.findPathToNetwork(
        startPoint,
        connectedSet,
        blockedSet,
        heatMap,
        spineIndexMap,
        noiseMap
      )

      if (path.length > 0) {
        for (const p of path) {
            const key = `${p.x},${p.y}`
            if (!connectedSet.has(key) && !blockedSet.has(key)) {
                connectedSet.add(key)
                newCorridors.push(p)
            }
        }
      }
    }

    // 3. Post-Process: Prune Stubs (Recursive)
    // A stub is a generated corridor tile with <= 1 connections (to rooms/targets/other corridors).
    // Valid tiles must connect two things (>=2 neighbors).
    
    let pruning = true
    while (pruning) {
        pruning = false
        const toRemove = new Set<number>()
        
        // Build efficient lookup for current corridors
        const corridorSet = new Set<string>()
        newCorridors.forEach(c => corridorSet.add(`${c.x},${c.y}`))

        for (let i = 0; i < newCorridors.length; i++) {
            const c = newCorridors[i]
            // Skip already marked
            // (We handle removal after loop, or splice carefully. Splicing is expensive inside loop.
            // Using filter approach is better.)
            
            // Check neighbors
            let connections = 0
            const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}]
            
            for (const d of dirs) {
                const nx = c.x + d.x, ny = c.y + d.y
                const nKey = `${nx},${ny}`
                
                // Neighbor is valid if it is:
                // A. Another Generated Corridor Tile
                // B. A Target Tile (Spine/Network)
                // C. A Blocked Tile (Room Floor)
                
                if (corridorSet.has(nKey) || targetSet.has(nKey) || blockedSet.has(nKey)) {
                    connections++
                }
            }
            
            if (connections <= 1) {
                // It's a stub or dead end.
                // Note: Even a room exit needs >1 connection (1 to room, 1 to corridor).
                // If it has 1 (to room), it goes nowhere.
                toRemove.add(i)
                pruning = true
            }
        }
        
        if (pruning) {
            // Rebuild array without pruned tiles
            // This is safer than splicing downwards
            const nextCorridors: {x:number, y:number}[] = []
            for (let i = 0; i < newCorridors.length; i++) {
                if (!toRemove.has(i)) {
                    nextCorridors.push(newCorridors[i])
                }
            }
            // Update reference
            if (nextCorridors.length === newCorridors.length) break // Safety
            
            // Clear current array and refill (to keep const ref if needed, or just reassign)
            // Reassigning newCorridors is fine locally but we need to update 'connectedSet' for next pass?
            // Actually 'connectedSet' contains targetSet too.
            // We should remove pruned tiles from connectedSet?
            // connectedSet was used FOR pathfinding. Post-processing doesn't need to update it unless we loop pathfinding.
            // But the stub check relies on `corridorSet` which is rebuilt from `newCorridors`.
            // So we just update `newCorridors`.
            
            newCorridors.length = 0
            newCorridors.push(...nextCorridors)
        }
    }

    return newCorridors
  }

  /**
   * Find the lowest cost wall tile to exit from.
   * Uses HeatMap score (Walls/Edges) + Distance to Attractor (Spine) to influence choice
   */
  private findBestRoomExit(
    room: Room, 
    heatMap: Map<string, number>, 
    blockedSet: Set<string>,
    attractor: GridCoord
  ): GridCoord | null {
    let bestSpot: GridCoord | null = null
    let minScore = Infinity

    const { x, y, w, h } = room.bounds
    const checkObj = { bestSpot, minScore }
    
    // Helper to calculate total score
    const calc = (tx: number, ty: number) => {
         const key = `${tx},${ty}`
         if (blockedSet.has(key)) return
         
         let score = heatMap.get(key)
         if (score === undefined || score >= 100) return
         
         // Add Heuristic Score: Distance to Attractor * Factor
         // Factor should be small enough not to override Wall vs Corner logic (which is ~5-10 diff)
         // Dist is usually 0-50. 
         // Factor 0.5: Dist 20 -> +10 cost.
         const dist = (Math.abs(tx - attractor.x) + Math.abs(ty - attractor.y)) * 0.2
         score += dist
         
         if (score < checkObj.minScore) {
            checkObj.minScore = score
            checkObj.bestSpot = {x: tx, y: ty}
         }
    }
    
    // Check all perimeter positions
    for (let dx=0; dx<w; dx++) calc(x+dx, y-1)
    for (let dx=0; dx<w; dx++) calc(x+dx, y+h)
    for (let dy=0; dy<h; dy++) calc(x-1, y+dy)
    for (let dy=0; dy<h; dy++) calc(x+w, y+dy)

    return checkObj.bestSpot
  }
  
  // Clean up unused checkExitCandidate if replaced
  private unused_check() {}

  /**
   * A* Pathfinding to any tile in connectedSet
   */
  private findPathToNetwork(
    start: GridCoord, 
    connectedSet: Set<string>, 
    blockedSet: Set<string>,
    heatMap: Map<string, number>,
    spineIndexMap: Map<string, number>,
    noiseMap: Map<string, number>
  ): GridCoord[] {
    const openSet: PathNode[] = []
    const closedSet = new Set<string>()
    
    const startKey = `${start.x},${start.y}`
    if (blockedSet.has(startKey)) return [] // Should not happen due to exit check

    openSet.push({ x: start.x, y: start.y, dir: null, g: 0, h: 0, parent: null })

    while (openSet.length > 0) {
        openSet.sort((a, b) => a.g - b.g)
        const current = openSet.shift()!
        const key = `${current.x},${current.y}`

        if (closedSet.has(key)) continue
        closedSet.add(key)

        if (connectedSet.has(key)) {
            return this.reconstructPath(current)
        }
        
        const dirs: Direction[] = ['north', 'south', 'east', 'west']
        for (const dir of dirs) {
            const nextX = current.x + DIR_OFFSETS[dir].dx
            const nextY = current.y + DIR_OFFSETS[dir].dy
            
            if (!this.inBounds(nextX, nextY)) continue
            
            const nextKey = `${nextX},${nextY}`
            if (closedSet.has(nextKey)) continue
            // Removed strict blockedSet check
            
            let moveCost = this.COST_VOID
            const heatVal = heatMap.get(nextKey)
            
            if (connectedSet.has(nextKey)) {
                // Goal or Existing Corridor -> Cheap
                moveCost = this.COST_EXISTING_FLOOR
            } else if (blockedSet.has(nextKey)) {
                // Room Traversal -> Medium Cost (encourages going around unless far)
                moveCost = 5 
            } else if (heatVal !== undefined) {
                // Wall/Constraint (Heat can be negative bonus now)
                // Base 30 + Heat. (-20 -> 10, -10 -> 20, 0 -> 30, +100 -> 130)
                moveCost = 30 + heatVal
                if (moveCost < 1) moveCost = 1
            } else {
                if (!noiseMap.has(nextKey)) {
                    noiseMap.set(nextKey, Math.floor(this.rng.next() * this.COST_NOISE_MAX))
                }
                moveCost += noiseMap.get(nextKey)!
            }
            
            if (spineIndexMap.has(nextKey)) {
                const idx = spineIndexMap.get(nextKey)!
                moveCost += idx * this.SPINE_GRADIENT_FACTOR
            }
            
            const newG = current.g + moveCost
            
            const existing = openSet.find(n => n.x === nextX && n.y === nextY)
            if (existing) {
                if (newG < existing.g) {
                    existing.g = newG
                    existing.parent = current
                }
            } else {
                openSet.push({ x: nextX, y: nextY, dir: null, g: newG, h: 0, parent: current })
            }
        }
    }
    return []
  }
}
