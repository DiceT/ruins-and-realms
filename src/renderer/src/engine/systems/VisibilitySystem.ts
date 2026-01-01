import { VISION_STATE, VisionGrid } from '../data/LightingData'

export class VisibilitySystem {
  private width: number
  private height: number
  private grid: VisionGrid
  
  // Track currently visible tiles separately for quick access
  private currentVisibleSet: Set<string> = new Set()

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.grid = new Uint8Array(width * height).fill(VISION_STATE.UNEXPLORED)
  }

  public reset(width: number, height: number): void {
    this.width = width
    this.height = height
    this.grid = new Uint8Array(width * height).fill(VISION_STATE.UNEXPLORED)
    this.currentVisibleSet.clear()
  }

  public getGrid(): VisionGrid {
    return this.grid
  }
  
  public getVisibleSet(): Set<string> {
    return this.currentVisibleSet
  }

  /**
   * Updates visibility based on origin and radius.
   * Uses Recursive Shadowcasting.
   * @param originX Player X
   * @param originY Player Y
   * @param radius View radius (max dim light radius)
   * @param blocksSight Function returning true if tile blocks sight (walls/doors)
   */
  public computeVisibility(
    originX: number, 
    originY: number, 
    radius: number,
    blocksSight: (x: number, y: number) => boolean
  ): void {
    // 1. Mark all currently visible as EXPLORED (downgrade)
    // We don't clear the grid, just the 'VISIBLE' status
    // Actually, iterating the set is faster
    for (const key of this.currentVisibleSet) {
      const [x, y] = key.split(',').map(Number)
      if (this.isValid(x, y)) {
        const idx = y * this.width + x
        // Downgrade to EXPLORED if it was VISIBLE
        if (this.grid[idx] === VISION_STATE.VISIBLE) {
          this.grid[idx] = VISION_STATE.EXPLORED
        }
      }
    }
    this.currentVisibleSet.clear()

    // 2. Compute new Visible set (Recursive Shadowcasting)
    // Origin is always visible
    this.markVisible(originX, originY)

    for (let octant = 0; octant < 8; octant++) {
      this.castLight(
        originX, originY, 
        radius, 
        1, 
        1.0, 
        0.0, 
        octant, 
        blocksSight
      )
    }
  }

  private markVisible(x: number, y: number): void {
    if (!this.isValid(x, y)) return
    
    const idx = y * this.width + x
    this.grid[idx] = VISION_STATE.VISIBLE
    this.currentVisibleSet.add(`${x},${y}`)
  }
  
  private isValid(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height
  }

  /**
   * Recursive Shadowcasting
   * Adapted from standard roguelike algorithms
   * Shared by many libraries (ROT.js, etc)
   */
  private castLight(
    cx: number, cy: number, 
    radius: number, 
    row: number, 
    start: number, 
    end: number, 
    octant: number,
    blocksSight: (x: number, y: number) => boolean
  ): void {
    if (start < end) return

    let radiusSq = radius * radius

    for (let j = row; j <= radius; j++) {
      let dx = -j - 1
      let dy = -j
      let blocked = false
      let newStart = 0

      while (dx <= 0) {
        dx += 1
        // Translate octant
        let X = cx + (octant === 0 || octant === 3 ? j : octant === 4 || octant === 7 ? -j : dx)
        let Y = cy + (octant === 1 || octant === 2 ? j : octant === 5 || octant === 6 ? -j : dx)
        
        // Handling other octant transforms...
        // Let's use a cleaner transform mapping
        // Octant multipliers:
        // 0: x+ y-
        // 1: x+ y+ (swapped)
        // ... recursive is easier with multipliers
        // Re-implementing with multipliers for clarity:
        
        /* 
          Multipliers for octants:
              xx xy yx yy
          0:  1  0  0  1
          1:  0  1  1  0
          2:  0 -1  1  0
          3: -1  0  0  1
          4: -1  0  0 -1
          5:  0 -1 -1  0
          6:  0  1 -1  0
          7:  1  0  0 -1
        */
       
       // actually, let's restart the loop with the transform built-in to avoid confusion
       break
      }
    }
    
    // Simple Shadowcasting (Octant based)
    // Ref: http://www.roguebasin.com/index.php?title=Shadow_casting
    
    const xx = [1, 0, 0, -1, -1, 0, 0, 1][octant]
    const xy = [0, 1, -1, 0, 0, -1, 1, 0][octant]
    const yx = [0, 1, 1, 0, 0, -1, -1, 0][octant]
    const yy = [1, 0, 0, 1, -1, 0, 0, -1][octant]

    let radius2 = radius * radius

    for (let j = row; j <= radius; j++) {
      let dx = -j - 1
      let dy = -j
      let blocked = false
      let newStart = 0
      
      while (dx <= 0) {
        dx += 1
        
        // Slope of current cell
        let l_slope = (dx - 0.5) / (dy + 0.5)
        let r_slope = (dx + 0.5) / (dy - 0.5)
        
        if (start < r_slope) continue
        if (end > l_slope) break

        let wx = cx + dx * xx + dy * xy
        let wy = cy + dx * yx + dy * yy
        
        if ((dx * dx + dy * dy) < radius2) {
           this.markVisible(wx, wy)
        }

        if (blocked) {
          if (blocksSight(wx, wy)) {
            newStart = r_slope
            continue
          } else {
            blocked = false
            start = newStart
          }
        } else {
          if (blocksSight(wx, wy) && j < radius) {
            blocked = true
            this.castLight(cx, cy, radius, j + 1, start, l_slope, octant, blocksSight)
            newStart = r_slope
          }
        }
      }
      if (blocked) break
    }
  }
}
