import { DungeonState, Exit, Room, RoomClassification, Tile, TileType } from './types.js'

export class DungeonGenerator {
  private width: number
  private height: number
  private tiles: Tile[][]
  private rooms: Room[]
  private entrance: { x: number; y: number }
  /* -------------------------------------------------------------------------- */
  /*                             New Room Generation                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Calculates the maximum possible width and height for a new room extending from a given exit.
   * Checks for map boundaries and existing obstacles (Dead/Active tiles).
   */
  public calculateMaxDimensions(exitId: string): { maxW: number; maxH: number } {
    let exit: Exit | null = null
    let parentRoom: Room | null = null

    for (const r of this.rooms) {
      const e = r.exits.find(ex => ex.id === exitId)
      if (e) {
        exit = e
        parentRoom = r
        break
      }
    }

    if (!exit || !parentRoom) return { maxW: 0, maxH: 0 }

    const { x: ex, y: ey, direction } = exit
    
    // Check primary depth (how far out we can go)
    let maxDepth = 0
    let dx = 0, dy = 0

    if (direction === 'top') dy = -1
    if (direction === 'bottom') dy = 1
    if (direction === 'left') dx = -1
    if (direction === 'right') dx = 1

    // Scan primary direction
    // Start adjacent to exit
    let cx = ex + dx
    let cy = ey + dy
    
    while (cx >= 0 && cy >= 0 && cx < this.width && cy < this.height) {
      const tile = this.tiles[cy][cx]
      // Check for obstacle (anything NOT void). 
      // Note: Dead zones are obstacles.
      if (tile.type !== 'live') break
      maxDepth++
      cx += dx
      cy += dy
    }

    // Check secondary width (perpendicular to extension)
    // We scan both perpendicular directions from the exit's projected position?
    // User asked for "Maximum X and Y". 
    // This implies determining the MAX possible width/height if we positioned the room optimally.
    // So we scan both sides perpendicular to the exit.
    
    let pdx = 0, pdy = 0 // Perpendicular delta
    if (dx !== 0) { // Moving Horizontally -> Scan Vertically
       pdy = 1 
    } else { // Moving Vertically -> Scan Horizontally
       pdx = 1
    }

    // Scan Positive Perpendicular
    let maxPerpPos = 0
    let px = ex + dx + pdx
    let py = ey + dy + pdy
    // Note: We check the tile adjacent to the "start" of the new room (ex+dx), not the exit tile itself?
    // Actually, checking the line immediately adjacent to the exit (e.g. exit+dx) gives the constraint for the "entrance wall" of the new room.
    // The room must be at least 1 tile deep. So verifying the first layer of depth is crucial.
    // But a room is a rectangle. It might be blocked further out.
    // "Calculate the maximum X and Y a room can be".
    // This is complex for a rectangle.
    // WE SIMPLIFY: Max Secondary Dimension is calculated based on the available space at the INTERFACE (depth 1).
    // This gives a loose upper bound. The placement logic might fail if it narrows further out, but we satisfy "clamp high end".
    
    // Reset to just outside exit
    const startX = ex + dx
    const startY = ey + dy

    // Scan Positive
    px = startX + pdx
    py = startY + pdy
    while (px >= 0 && py >= 0 && px < this.width && py < this.height) {
       if (this.tiles[py][px].type !== 'live') break
       maxPerpPos++
       px += pdx
       py += pdy
    }

    // Scan Negative
    let maxPerpNeg = 0
    px = startX - pdx
    py = startY - pdy
    while (px >= 0 && py >= 0 && px < this.width && py < this.height) {
       if (this.tiles[py][px].type !== 'live') break
       maxPerpNeg++
       px -= pdx
       py -= pdy
    }

    const maxSecondary = 1 + maxPerpPos + maxPerpNeg

    if (dx !== 0) {
      // Horizontal Exit -> Depth is Width (Primary), perp is Height
      // Wait, if exiting Right (dx=1), Depth is X (Width).
      return { maxW: maxDepth, maxH: maxSecondary }
    } else {
      // Vertical Exit -> Depth is Y (Height), perp is Width
      return { maxW: maxSecondary, maxH: maxDepth }
    }
  }

  public rollNewRoomAttributes(exitId: string): { 
     width: number, 
     height: number, 
     type: 'Corridor' | 'Small' | 'Medium' | 'Large',
     rolls: string[],
     maxW: number,
     maxH: number
  } {
    const { maxW, maxH } = this.calculateMaxDimensions(exitId)
    const logs: string[] = []

    const rollDie = (): number => Math.floor(Math.random() * 6) + 1

    let w = rollDie()
    let h = rollDie()
    logs.push(`Rolled: ${w} x ${h}`)

    // Check Doubles
    if (w === h) {
      const w2 = rollDie()
      const h2 = rollDie()
      logs.push(`Doubles! Rolling bonus: +${w2} (W), +${h2} (H)`)
      w += w2
      h += h2
      logs.push(`Total before clamp: ${w} x ${h}`)
    }

    // Clamp
    const finalW = Math.min(w, maxW)
    const finalH = Math.min(h, maxH)

    if (finalW !== w || finalH !== h) {
       logs.push(`Clamped to available space: ${finalW} x ${finalH} (Max: ${maxW}x${maxH})`)
    }

    // Classify
    let type: 'Corridor' | 'Small' | 'Medium' | 'Large' = 'Medium'
    const area = finalW * finalH

    if (finalW === 1 || finalH === 1) type = 'Corridor'
    else if (area <= 6) type = 'Small'
    else if (area >= 32) type = 'Large'

    return {
      width: finalW,
      height: finalH,
      type,
      rolls: logs,
      maxW,
      maxH
    }
  }

  /**
   * @param inputWidth The "playable" width requested (e.g. 20)
   * @param inputHeight The "playable" height requested (e.g. 20)
   */
  constructor(inputWidth: number, inputHeight: number) {
    // Rule: The computer actually makes the map 4 tiles bigger
    this.width = inputWidth + 4
    this.height = inputHeight + 4
    this.rooms = []
    this.entrance = { x: -1, y: -1 }

    // Initialize empty grid
    this.tiles = []
    this.initializeGrid()
  }

  /**
   * Part 2: Manual Entrance Placement
   * Validation check for Rule 47-49
   */
  public isValidEntrancePosition(x: number, y: number): boolean {
    const isBottomEdge = y === this.height - 3
    const isInsideDeadZone = x < 2 || x >= this.width - 2
    return isBottomEdge && !isInsideDeadZone
  }

  /**
   * Commits the entrance placement and applies Rule 54-55 (neighbors become dead)
   */
  public applyEntrance(x: number, y: number): void {
    if (!this.isValidEntrancePosition(x, y)) return

    this.entrance = { x, y }
    this.tiles[y][x].type = 'active'
    this.tiles[y][x].isEntrance = true

    // Rule 54-55: Neighbors become dead zones (D-E-D corridor)
    if (x > 2) this.tiles[y][x - 1].type = 'dead'
    if (x < this.width - 3) this.tiles[y][x + 1].type = 'dead'

    console.log('[DungeonGenerator] Entrance committed at:', x, y)
  }

  /**
   * Part 1: Grid Initialization
   * Fills the grid and marks the Dead Border
   */
  private initializeGrid(): void {
    this.tiles = []
    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = []
      for (let x = 0; x < this.width; x++) {
        let type: TileType = 'live'

        // Rule: Outer 2 rows/cols are Dead Zone
        if (x < 2 || x >= this.width - 2 || y < 2 || y >= this.height - 2) {
          type = 'dead'
        }

        row.push({ x, y, type })
      }
      this.tiles.push(row)
    }
  }

  /**
   * Part 3: Rolling for Starting Room
   * Returns the dimensions for the starting room based on 2d6 roll
   */
  public rollStartingRoomSize(): { width: number; height: number; original: [number, number] } {
    // 1. Roll 2 dice
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    
    let w = d1
    let h = d2

    console.log(`[DungeonGenerator] Rolled ${d1}x${d2}`)

    // Rule 80: 1s become 2s
    if (w === 1) w = 2
    if (h === 1) h = 2

    // Rule 81: Area constraints (6 <= area <= 12)
    let area = w * h

    if (area < 6) {
        // Force to 6 squares (2x3 or 3x2)
        // Try to respect the dominant dimension
        if (w >= h) { w = 3; h = 2 }
        else { w = 2; h = 3 }
    } else if (area > 12) {
        // Force to 12 squares (4x3 or 3x4)
        if (w >= h) { w = 4; h = 3 }
        else { w = 3; h = 4 }
    }

    return { width: w, height: h, original: [d1, d2] }
  }

  /**
   * Part 4: Placing the Starting Room
   * Validates if a room can be placed at the given position.
   * Checks boundaries AND that all tiles in the area are 'live'.
   */
  public canPlaceRoom(x: number, y: number, w: number, h: number): boolean {
    // 1. Check boundaries (including dead border)
    if (x < 0 || y < 0) return false
    if (x + w > this.width || y + h > this.height) return false

    // 2. Check all tiles are 'live' (not dead or active)
    for (let ry = 0; ry < h; ry++) {
      for (let rx = 0; rx < w; rx++) {
        const tx = x + rx
        const ty = y + ry
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false
        if (this.tiles[ty][tx].type !== 'live') return false
      }
    }

    return true
  }

  /**
   * Calculates the maximum room size that can actually fit from an exit.
   * Tests progressively smaller sizes until one fits.
   */
  public getAvailableSpaceFromExit(exitId: string): { maxWidth: number; maxHeight: number; direction: string } | null {
    // Find the exit
    let exit: Exit | null = null
    let parentRoom: Room | null = null
    for (const room of this.rooms) {
      const e = room.exits.find((ex) => ex.id === exitId)
      if (e) { exit = e; parentRoom = room; break }
    }
    if (!exit || !parentRoom) return null

    const { x: ex, y: ey, direction } = exit

    // Determine the anchor point for room placement based on exit direction
    // This is where the room's edge connects to the exit
    
    // Test progressively smaller rectangles to find what actually fits
    // Start with max 12x12 (reasonable max) and shrink until something fits
    const MAX_SIZE = 12
    
    let bestWidth = 0
    let bestHeight = 0
    let bestArea = 0

    for (let w = 1; w <= MAX_SIZE; w++) {
      for (let h = 1; h <= MAX_SIZE; h++) {
        // Calculate where this room would be placed relative to exit
        let roomX: number, roomY: number
        
        if (direction === 'top') {
          // Room placed above exit, exit connects to bottom of room
          roomX = ex - Math.floor(w / 2) // Center on exit
          roomY = ey - h
        } else if (direction === 'bottom') {
          // Room placed below exit, exit connects to top of room  
          roomX = ex - Math.floor(w / 2)
          roomY = ey + 1
        } else if (direction === 'left') {
          // Room placed left of exit
          roomX = ex - w
          roomY = ey - Math.floor(h / 2)
        } else { // right
          // Room placed right of exit
          roomX = ex + 1
          roomY = ey - Math.floor(h / 2)
        }

        // Check if this room placement is valid
        if (this.canPlaceRoom(roomX, roomY, w, h)) {
          const area = w * h
          if (area > bestArea) {
            bestArea = area
            bestWidth = w
            bestHeight = h
          }
        }
      }
    }

    console.log(`[getAvailableSpaceFromExit] Exit ${exitId} (${direction}): max ${bestWidth}x${bestHeight}`)
    return { maxWidth: bestWidth, maxHeight: bestHeight, direction }
  }

  /**
   * Clamps a room size to fit within the available space from an exit.
   * Compares areas of possible orientations and returns the largest fitting room.
   */
  public clampRoomToAvailableSpace(
    width: number, 
    height: number, 
    exitId: string
  ): { width: number; height: number; clamped: boolean; reason?: string } {
    const available = this.getAvailableSpaceFromExit(exitId)
    if (!available) {
      return { width, height, clamped: false, reason: 'Exit not found' }
    }

    const { maxWidth, maxHeight } = available
    
    // Check if original fits as-is
    if (width <= maxWidth && height <= maxHeight) {
      return { width, height, clamped: false }
    }
    
    // Check if rotated version fits
    if (height <= maxWidth && width <= maxHeight) {
      console.log(`[clampRoomToAvailableSpace] Rotated ${width}x${height} to ${height}x${width}`)
      return { width: height, height: width, clamped: true, reason: 'Rotated to fit' }
    }

    // Neither orientation fits - find the largest area that CAN fit
    // Try clamping both orientations and pick the one with larger area
    const clampedW1 = Math.min(width, maxWidth)
    const clampedH1 = Math.min(height, maxHeight)
    const area1 = clampedW1 * clampedH1

    const clampedW2 = Math.min(height, maxWidth)
    const clampedH2 = Math.min(width, maxHeight)
    const area2 = clampedW2 * clampedH2

    if (area1 >= area2) {
      console.log(`[clampRoomToAvailableSpace] Clamped ${width}x${height} to ${clampedW1}x${clampedH1} (area: ${area1})`)
      return { width: clampedW1, height: clampedH1, clamped: true, reason: `Clamped to ${clampedW1}x${clampedH1} (max available)` }
    } else {
      console.log(`[clampRoomToAvailableSpace] Clamped ${width}x${height} to ${clampedW2}x${clampedH2} (area: ${area2})`)
      return { width: clampedW2, height: clampedH2, clamped: true, reason: `Clamped to ${clampedW2}x${clampedH2} (max available)` }
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                             Room Helper Methods                            */
  /* -------------------------------------------------------------------------- */

  /**
   * Helper to classify a room based on dimensions and area.
   */
  private classifyRoom(w: number, h: number): RoomClassification {
    const area = w * h
    if (w === 1 || h === 1) {
      return 'corridor'
    } else if (area <= 6) {
      return 'small'
    } else if (area >= 32) {
      return 'large'
    } else {
      return 'medium'
    }
  }

  /**
   * Centralized method to create a room, update tiles, and add to the rooms list.
   */
  private createRoom(x: number, y: number, w: number, h: number, type: 'start' | 'normal'): Room {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const classification = type === 'start' ? 'starter' : this.classifyRoom(w, h)

    const newRoom: Room = {
      id: roomId,
      x, y, width: w, height: h,
      exits: [],
      type,
      classification
    }
    
    this.rooms.push(newRoom)

    // Update tiles
    for (let ry = 0; ry < h; ry++) {
      for (let rx = 0; rx < w; rx++) {
        const tx = x + rx
        const ty = y + ry
        
        // Mark as floor
        this.tiles[ty][tx].type = 'active'
        this.tiles[ty][tx].roomId = roomId
      }
    }

    return newRoom
  }

  public placeStartingRoom(x: number, y: number, w: number, h: number): boolean {
    // Rule 98: Bottom edge must touch entrance
    if (y + h !== this.entrance.y) {
      console.warn('[DungeonGenerator] Room bottom must touch entrance row')
      return false
    }

    // Rule 99: Entrance tile must be directly below one of the room's bottom tiles
    if (this.entrance.x < x || this.entrance.x >= x + w) {
      console.warn('[DungeonGenerator] Room must span over the entrance')
      return false
    }

    if (!this.canPlaceRoom(x, y, w, h)) {
      console.warn('[DungeonGenerator] Room does not fit')
      return false
    }

    // Use Helper
    this.createRoom(x, y, w, h, 'start')

    console.log(`[DungeonGenerator] Placed Starting Room at ${x},${y} (${w}x${h})`)
    return true
  }

  /**
   * Places a new room at the given position, connected to an exit.
   * Returns the room ID if successful, null otherwise.
   */
  public placeNewRoom(x: number, y: number, w: number, h: number, exitId: string): string | null {
    // Validate all tiles are void
    for (let ry = 0; ry < h; ry++) {
      for (let rx = 0; rx < w; rx++) {
        const tx = x + rx
        const ty = y + ry
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return null
        if (this.tiles[ty][tx].type !== 'live') return null
      }
    }

    // Find the exit and its parent room
    let parentRoom: Room | null = null
    let exit: Exit | null = null
    for (const room of this.rooms) {
      const e = room.exits.find((ex) => ex.id === exitId)
      if (e) {
        exit = e
        parentRoom = room
        break
      }
    }
    if (!exit || !parentRoom) return null

    // Use Helper
    const newRoom = this.createRoom(x, y, w, h, 'normal')

    // Connect the exit to this room
    exit.connectedRoomId = newRoom.id

    console.log(`[DungeonGenerator] Placed New Room at ${x},${y} (${w}x${h}), connected to exit ${exitId}`)
    return newRoom.id
  }

  /**
   * Calculates which walls of a room are eligible for exits.
   * A wall is NOT eligible if ANY tile on it is exactly 2 spaces from a dead tile.
   * Returns an object with the eligibility of each wall and count.
   */
  public calculateEligibleWalls(roomId: string): { 
    top: boolean
    bottom: boolean
    left: boolean
    right: boolean
    count: number
    connectedWall: string | null
  } {
    const room = this.rooms.find((r) => r.id === roomId)
    if (!room) return { top: false, bottom: false, left: false, right: false, count: 0, connectedWall: null }

    const { x, y, width: w, height: h } = room

    // Determine which wall is connected (the entrance side)
    // For new rooms, one wall will touch the exit from the parent room
    let connectedWall: string | null = null
    for (const r of this.rooms) {
      for (const exit of r.exits) {
        if (exit.connectedRoomId === roomId) {
          // This exit connects to our room - determine which wall
          if (exit.y === y - 1) connectedWall = 'top'
          else if (exit.y === y + h) connectedWall = 'bottom'
          else if (exit.x === x - 1) connectedWall = 'left'
          else if (exit.x === x + w) connectedWall = 'right'
          break
        }
      }
      if (connectedWall) break
    }

    // Helper to check if an exit position is valid for a wall
    // Checks BOTH: exit tile (1 away) is live AND tile beyond (2 away) is also live
    const isExitPositionValid = (
      exitX: number, 
      exitY: number, 
      direction: 'top' | 'bottom' | 'left' | 'right'
    ): boolean => {
      // Check exit tile (1 away from wall)
      if (exitX < 0 || exitY < 0 || exitX >= this.width || exitY >= this.height) {
        return false
      }
      if (this.tiles[exitY][exitX].type !== 'live') {
        return false
      }

      // Check tile beyond exit (2 away from wall) - where a room would need space
      let beyondX = exitX
      let beyondY = exitY
      if (direction === 'top') beyondY = exitY - 1
      else if (direction === 'bottom') beyondY = exitY + 1
      else if (direction === 'left') beyondX = exitX - 1
      else if (direction === 'right') beyondX = exitX + 1

      if (beyondX < 0 || beyondY < 0 || beyondX >= this.width || beyondY >= this.height) {
        return false // No space beyond
      }
      if (this.tiles[beyondY][beyondX].type !== 'live') {
        return false // Space beyond is not live
      }

      return true
    }

    // Check each wall
    let topEligible = connectedWall !== 'top'
    let bottomEligible = connectedWall !== 'bottom'
    let leftEligible = connectedWall !== 'left'
    let rightEligible = connectedWall !== 'right'

    // Top wall (y-1): check if ANY exit position on this wall has space beyond
    if (topEligible) {
      let hasValidPosition = false
      for (let rx = 0; rx < w; rx++) {
        if (isExitPositionValid(x + rx, y - 1, 'top')) {
          hasValidPosition = true
          break
        }
      }
      if (!hasValidPosition) topEligible = false
    }

    // Bottom wall (y+h): check if ANY exit position on this wall has space beyond
    if (bottomEligible) {
      let hasValidPosition = false
      for (let rx = 0; rx < w; rx++) {
        if (isExitPositionValid(x + rx, y + h, 'bottom')) {
          hasValidPosition = true
          break
        }
      }
      if (!hasValidPosition) bottomEligible = false
    }

    // Left wall (x-1): check if ANY exit position on this wall has space beyond
    if (leftEligible) {
      let hasValidPosition = false
      for (let ry = 0; ry < h; ry++) {
        if (isExitPositionValid(x - 1, y + ry, 'left')) {
          hasValidPosition = true
          break
        }
      }
      if (!hasValidPosition) leftEligible = false
    }

    // Right wall (x+w): check if ANY exit position on this wall has space beyond
    if (rightEligible) {
      let hasValidPosition = false
      for (let ry = 0; ry < h; ry++) {
        if (isExitPositionValid(x + w, y + ry, 'right')) {
          hasValidPosition = true
          break
        }
      }
      if (!hasValidPosition) rightEligible = false
    }

    const count = [topEligible, bottomEligible, leftEligible, rightEligible].filter(Boolean).length

    console.log(`[calculateEligibleWalls] Room ${roomId.substring(0,8)} at ${x},${y} (${w}x${h})`)
    console.log(`  Connected wall: ${connectedWall}`)
    console.log(`  Top: ${topEligible}, Bottom: ${bottomEligible}, Left: ${leftEligible}, Right: ${rightEligible}`)
    console.log(`  Total eligible: ${count}`)

    return { top: topEligible, bottom: bottomEligible, left: leftEligible, right: rightEligible, count, connectedWall }
  }

  /**
   * Rolls for number of exits based on 1d6.
   * 1 = 0 exits, 2-3 = 1 exit, 4-5 = 2 exits, 6 = 3 exits
   */
  public rollForExitCount(): { roll: number; exitCount: number } {
    const roll = Math.floor(Math.random() * 6) + 1
    let exitCount = 0
    if (roll === 1) exitCount = 0
    else if (roll <= 3) exitCount = 1
    else if (roll <= 5) exitCount = 2
    else exitCount = 3
    return { roll, exitCount }
  }

  /**
   * Finalizes a new room by marking dead zones.
   * Dead zones are void tiles adjacent to the room that cannot lead anywhere useful.
   */
  public finalizeNewRoom(roomId: string): void {
    const room = this.rooms.find((r) => r.id === roomId)
    if (!room) return

    const { x, y, width: w, height: h } = room

    // Mark tiles adjacent to the room as dead if they are void
    // Top row (y-1)
    for (let rx = -1; rx <= w; rx++) {
      const tx = x + rx
      const ty = y - 1
      if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) {
        if (this.tiles[ty][tx].type === 'live') {
          this.tiles[ty][tx].type = 'dead'
        }
      }
    }
    
    // Bottom row (y+h)
    for (let rx = -1; rx <= w; rx++) {
      const tx = x + rx
      const ty = y + h
      if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) {
        if (this.tiles[ty][tx].type === 'live') {
          this.tiles[ty][tx].type = 'dead'
        }
      }
    }
    
    // Left column (x-1)
    for (let ry = 0; ry < h; ry++) {
      const tx = x - 1
      const ty = y + ry
      if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) {
        if (this.tiles[ty][tx].type === 'live') {
          this.tiles[ty][tx].type = 'dead'
        }
      }
    }
    
    // Right column (x+w)
    for (let ry = 0; ry < h; ry++) {
      const tx = x + w
      const ty = y + ry
      if (tx >= 0 && ty >= 0 && tx < this.width && ty < this.height) {
        if (this.tiles[ty][tx].type === 'live') {
          this.tiles[ty][tx].type = 'dead'
        }
      }
    }

    // Exit tiles are already 'active' from addExit - don't change them
    // (Previously this code was incorrectly changing them back to 'live')

    // Run cleanup to close off blocked exits
    this.cleanupBlockedExits()

    console.log(`[DungeonGenerator] Finalized room ${roomId}, marked dead zones`)
  }

  /**
   * Cleanup phase: If an exit has NO 'live' neighbors (all 4 sides are dead, active, or out of bounds),
   * it loses its green and becomes regular floor.
   */
  private cleanupBlockedExits(): void {
    for (const room of this.rooms) {
      for (const exit of room.exits) {
        // Skip already-connected exits
        if (exit.connectedRoomId) continue

        const { x, y } = exit

        // Check if any neighbor is 'live'
        const neighbors = [
          { nx: x, ny: y - 1 }, // top
          { nx: x, ny: y + 1 }, // bottom
          { nx: x - 1, ny: y }, // left
          { nx: x + 1, ny: y }  // right
        ]

        let hasLiveNeighbor = false
        for (const n of neighbors) {
          if (n.nx >= 0 && n.ny >= 0 && n.nx < this.width && n.ny < this.height) {
            if (this.tiles[n.ny][n.nx].type === 'live') {
              hasLiveNeighbor = true
              break
            }
          }
        }

        // If no live neighbors, close this exit
        if (!hasLiveNeighbor) {
          exit.connectedRoomId = 'closed'
          console.log(`[cleanupBlockedExits] Exit at ${x},${y} closed (no live neighbors)`)
        }
      }
    }
  }

  public isValidExitPosition(x: number, y: number, roomId: string): boolean {
    const room = this.rooms.find((r) => r.id === roomId)
    if (!room) {
      console.log(`[isValidExitPosition] Room not found: ${roomId}`)
      return false
    }

    // Must be OUTSIDE the room, adjacent to one of the walls.
    // And must be 'live' (Live).
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      console.log(`[isValidExitPosition] Out of bounds: ${x},${y}`)
      return false
    }
    
    const tile = this.tiles[y][x]
    if (tile.type !== 'live') {
      console.log(`[isValidExitPosition] Tile at ${x},${y} is '${tile.type}', not 'live'`)
      return false
    }

    // Identify wall/direction based on adjacency
    let direction: 'top' | 'bottom' | 'left' | 'right' | null = null
    
    if (x >= room.x && x < room.x + room.width) {
      if (y === room.y - 1) direction = 'top'
      if (y === room.y + room.height) direction = 'bottom'
    }
    if (y >= room.y && y < room.y + room.height) {
      if (x === room.x - 1) direction = 'left'
      if (x === room.x + room.width) direction = 'right'
    }

    if (!direction) return false // Not adjacent

    // Check if wall already has an exit
    const hasExitOnWall = room.exits.some((e) => e.direction === direction)
    if (hasExitOnWall) return false

    // For starter room: block bottom wall (where entrance is)
    // For new rooms: block the wall where the connecting exit is (entry wall)
    if (room.type === 'start') {
      // Starter room: entrance is on the bottom
      if (direction === 'bottom') return false
    } else {
      // New room: find the entry wall (where the connecting exit is)
      // The connecting exit is the one with connectedRoomId set to this room
      // Find parent exit that connects to this room
      for (const parentRoom of this.rooms) {
        for (const exit of parentRoom.exits) {
          if (exit.connectedRoomId === roomId) {
            // This exit connects to our room - block the opposite wall
            // If exit is on parent's right, our entry is on our left, etc.
            const entryWall = exit.direction === 'top' ? 'bottom' :
                             exit.direction === 'bottom' ? 'top' :
                             exit.direction === 'left' ? 'right' : 'left'
            if (direction === entryWall) return false
          }
        }
      }
    }

    return true
  }

  public addExit(x: number, y: number, roomId: string): boolean {
    if (!this.isValidExitPosition(x, y, roomId)) return false

    const room = this.rooms.find(r => r.id === roomId)
    if (!room) return false

    let direction: 'top' | 'bottom' | 'left' | 'right' = 'top'
    // Recalculate direction (safe because verified above)
    if (y === room.y - 1) direction = 'top'
    else if (y === room.y + room.height) direction = 'bottom'
    else if (x === room.x - 1) direction = 'left'
    else if (x === room.x + room.width) direction = 'right'

    // Update Room
    room.exits.push({
      id: `exit_${Date.now()}`,
      x, y,
      direction,
      parentRoomId: roomId
    })

    // Update Tile
    // Mark exit tiles as 'active' (not entrance - that's only for the dungeon entrance)
    this.tiles[y][x].type = 'active' 
    this.tiles[y][x].isExit = true 
    
    console.log(`[DungeonGenerator] Added Exit at ${x},${y} on ${direction} wall`)
    return true
  }

  public finalizeStarterRoom(roomId: string): void {
     const room = this.rooms.find(r => r.id === roomId)
     if (!room) return

     const { x, y, width: w, height: h } = room

     // Rule 105: 1-tile buffer
     for (let ty = y - 1; ty <= y + h; ty++) {
      for (let tx = x - 1; tx <= x + w; tx++) {
        // Skip tiles inside the room itself
        if (tx >= x && tx < x + w && ty >= y && ty < y + h) continue
        
        // Skip out of bounds
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue

        // Check if this tile is adjacent to an exit or entrance?
        // No, the rule says "draw dead spaces".
        // The exits themselves are inside the room (on the edge).
        // The DEAD SPACE blocks expansion EXCEPT where exits are?
        // Usually dead space surrounds the room to define its shape in the void.
        
        // If I make neighbors of exits 'dead', then we can't expand.
        // But "draw dead spaces" usually means "fill the void around the generated room with dead tiles".
        // AND we probably want to reserve space for corridors from exits?
        
        // Let's just blindly apply DEAD to the ring for now.
        // BUT we must NOT overwrite the ACTUAL Dungeon Entrance which is at (x?, y+h?).
        // My previous logic prevented overwriting non-void.
        
        // New logic:
        // Neighbor of an EXIT should probably NOT be dead? Or maybe it SHOULD, and the corridor generation handling punches through 'dead'?
        // "Dead zones" usually mean "no room can be here".
        // If we want to attach a room later, we need to replace 'dead' with 'corridor' or 'active'.
        
        // User said: "when 3 Exits are place, THEN YOU DRAW THE DEAD SPACES."
        // So I will just mark them 'dead' if they are 'live'.
        
        const tile = this.tiles[ty][tx]
        if (tile.type === 'live') {
           // Ensure we don't block the dungeon entrance path?
           // The dungeon entrance is at tile.type == 'active'.
           // The tile BELOW the room is the entrance.
           // entrance is at (entrance.x, entrance.y).
           // If ty === entrance.y && tx === entrance.x, it's type 'active', so check below passes.
           
           // What about the tiles adjacent to exits?
           // If we mark them dead, can we build from them?
           // Standard dungeon generation often treats 'dead' as 'wall'.
           // Maybe we should leave the tile directly OUTSIDE the exit as void?
           // For now, I will follow the instruction literally: Draw Dead Spaces.
           this.tiles[ty][tx].type = 'dead'
        }
      }
    }

    // Run cleanup to close off blocked exits
    this.cleanupBlockedExits()
  }

  public getState(): DungeonState {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
      rooms: this.rooms,
      entrance: this.entrance
    }
  }
}
