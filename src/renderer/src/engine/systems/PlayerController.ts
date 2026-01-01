export class PlayerController {
  public x: number = 0
  public y: number = 0
  private gridWidth: number = 0
  private gridHeight: number = 0
  private walkmap: Set<string> = new Set()
  
  // Track keys
  private keys: Set<string> = new Set()
  
  // Callback for movement
  private onMove?: (x: number, y: number) => void

  constructor() {}

  public init(
    startX: number, 
    startY: number, 
    width: number, 
    height: number, 
    walkableTiles: {x: number, y: number}[],
    onMove: (x: number, y: number) => void
  ) {
    this.x = startX
    this.y = startY
    this.gridWidth = width
    this.gridHeight = height
    this.onMove = onMove
    
    // Build quick lookup
    this.walkmap.clear()
    for (const t of walkableTiles) {
      this.walkmap.add(`${t.x},${t.y}`)
    }
    
    // Attach listeners
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
  }

  public destroy() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    this.keys.clear()
  }
  
  public setPosition(x: number, y: number) {
      this.x = x
      this.y = y
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Only move if not repeating (or handle repeat in update loop? )
    // For grid movement, simple keydown trigger is usually safer to prevent zoomies
    if (e.repeat) return 
    
    let dx = 0
    let dy = 0
    
    switch(e.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        dy = -1
        break
      case 's':
      case 'arrowdown':
        dy = 1
        break
      case 'a':
      case 'arrowleft':
        dx = -1
        break
      case 'd':
      case 'arrowright':
        dx = 1
        break
      default:
        return
    }

    this.attemptMove(dx, dy)
  }

  private handleKeyUp = (e: KeyboardEvent) => {
    // No-op for now unless we do smooth movement
  }

  private attemptMove(dx: number, dy: number) {
    const nx = this.x + dx
    const ny = this.y + dy
    
    // Bounds check
    if (nx < 0 || ny < 0 || nx >= this.gridWidth || ny >= this.gridHeight) return
    
    // Walkmap check
    if (this.walkmap.has(`${nx},${ny}`)) {
      this.x = nx
      this.y = ny
      this.onMove?.(this.x, this.y)
    }
  }
}
