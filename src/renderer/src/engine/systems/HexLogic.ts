export class HexLogic {
  /**
   * Returns the 6 axial neighbor coordinates for a given hex (q, r) or (x, y) depending on coordinate system.
   * Assuming 'x, y' passed here are axial/offset coords consistent with the rest of the app.
   * Based on the logic in GameWindow.tsx:
   * odd-r offset? No, the offsets looked like:
   * [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]
   * This matches odd-r horizontal offset roughly? Or simple axial neighbors?
   * Actually, let's just copy the exact offsets used in GameWindow.tsx to ensure compatibility.
   */
  static getNeighbors(x: number, y: number): { x: number; y: number }[] {
    const isOdd = y % 2 !== 0
    const offsets = isOdd
      ? [
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [0, 1],
          [1, 1]
        ]
      : [
          [-1, -1],
          [0, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1]
        ]

    return offsets.map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
  }

  /**
   * Returns valid neighbors (empty spots) around a given coordinate.
   */
  static getValidNeighbors(
    x: number,
    y: number,
    placed: Map<string, string>
  ): { x: number; y: number }[] {
    return this.getNeighbors(x, y).filter((n) => !placed.has(`${n.x},${n.y}`))
  }

  /**
   * Returns ALL valid move locations (empty hexes adjacent to ANY existing placed tile).
   */
  static getAllValidMoves(placed: Map<string, string>): { x: number; y: number }[] {
    const valid = new Set<string>()

    placed.forEach((_, key) => {
      const [cx, cy] = key.split(',').map(Number)
      const neighbors = this.getNeighbors(cx, cy)
      neighbors.forEach((n) => {
        const nKey = `${n.x},${n.y}`
        if (!placed.has(nKey)) {
          valid.add(nKey)
        }
      })
    })

    return Array.from(valid).map((v) => {
      const [vx, vy] = v.split(',').map(Number)
      return { x: vx, y: vy }
    })
  }

  /**
   * Returns valid moves constrained to be adjacent to the *current batch* of tiles being placed.
   * Used for "Area" terrain that must clump together.
   */
  static getValidBatchMoves(
    currentBatch: Set<string>,
    placed: Map<string, string>
  ): { x: number; y: number }[] {
    const valid = new Set<string>()

    // For every tile in the current batch...
    currentBatch.forEach((key) => {
      const [cx, cy] = key.split(',').map(Number)
      // Check its neighbors
      const neighbors = this.getNeighbors(cx, cy)
      neighbors.forEach((n) => {
        const nKey = `${n.x},${n.y}`
        // If it's NOT in the global placed map, it's a candidate
        if (!placed.has(nKey)) {
          valid.add(nKey)
        }
      })
    })

    return Array.from(valid).map((v) => {
      const [vx, vy] = v.split(',').map(Number)
      return { x: vx, y: vy }
    })
  }

  /**
   * Helper to check if a specific move is in a valid set.
   * Useful for O(1) lookups during validation.
   */
  static isValidMove(x: number, y: number, validMoves: Set<string>): boolean {
    return validMoves.has(`${x},${y}`)
  }
}
