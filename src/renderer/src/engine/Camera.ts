import { Container, Application, Point, FederatedPointerEvent, Rectangle } from 'pixi.js'

export interface CameraOptions {
  minZoom: number
  maxZoom: number
  panLimit: number
}

export class Camera {
  public container: Container
  public readonly app: Application
  private interactionTarget: Container | null = null

  // State
  private isDragging: boolean = false
  private lastData: Point | null = null
  private options: CameraOptions = {
    minZoom: 0.5,
    maxZoom: 2.5,
    panLimit: 10000
  }

  // Bound events for easy removal
  private _boundPointerDown: (e: FederatedPointerEvent) => void
  private _boundPointerMove: (e: FederatedPointerEvent) => void
  private _boundPointerUp: (e: FederatedPointerEvent) => void
  private _boundWheel: (e: WheelEvent) => void

  constructor(app: Application) {
    this.app = app
    this.container = new Container()
    this.container.label = 'Map_Camera'

    this._boundPointerDown = this.onPointerDown.bind(this)
    this._boundPointerMove = this.onPointerMove.bind(this)
    this._boundPointerUp = this.onPointerUp.bind(this)
    this._boundWheel = this.onWheel.bind(this)
  }

  public init(viewport?: Container): void {
    this.interactionTarget = viewport || this.app.stage

    // Ensure the stage can receive events even if we click on "nothing"
    this.app.stage.eventMode = 'static'
    this.app.stage.hitArea = this.app.screen

    // Use the interaction target for initial pointer down
    this.app.stage.on('pointerdown', this._boundPointerDown)

    // We listen on the 'stage' for global moves to ensure smooth dragging even if mouse leaves target
    this.app.stage.on('pointermove', this._boundPointerMove)
    this.app.stage.on('pointerup', this._boundPointerUp)
    this.app.stage.on('pointerupoutside', this._boundPointerUp)

    // Wheel is a native event on the canvas
    this.app.canvas.addEventListener('wheel', this._boundWheel, { passive: false })

    console.log('[Camera] Init complete. Listening on stage.', {
      stageMode: this.app.stage.eventMode,
      hitArea: this.app.stage.hitArea
    })
  }

  public destroy(): void {
    this.app.stage.off('pointerdown', this._boundPointerDown)
    this.app.stage.off('pointermove', this._boundPointerMove)
    this.app.stage.off('pointerup', this._boundPointerUp)
    this.app.stage.off('pointerupoutside', this._boundPointerUp)
    this.app.canvas.removeEventListener('wheel', this._boundWheel)
    this.container.destroy({ children: true })
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    console.log('[Camera] onPointerDown', {
      type: e.type,
      button: e.button,
      global: e.global,
      target: e.target
    })
    // Filter events: only drag if we clicked the interaction target or its children
    const target = e.target
    let found = false
    let curr = target as Container | null
    while (curr) {
      if (curr === this.interactionTarget) {
        found = true
        break
      }
      curr = curr.parent
    }

    if (!found) {
      console.log('[Camera] Target not found in hierarchy', {
        interactionTarget: this.interactionTarget
      })
      return
    }

    // Middle Mouse (1) or Alt + Left Click (0)
    if (e.button === 1 || (e.button === 0 && (e.originalEvent as unknown as MouseEvent).altKey)) {
      console.log('[Camera] Drag Start', { button: e.button })
      // CRITICAL: Prevent browser scroll mode on middle click
      e.preventDefault()

      this.isDragging = true
      this.lastData = new Point(e.global.x, e.global.y)
    } else {
      console.log('[Camera] Not a panning button', {
        button: e.button,
        altKey: (e.originalEvent as unknown as MouseEvent).altKey
      })
    }
  }

  private onPointerUp(): void {
    if (this.isDragging) console.log('[Camera] Drag End')
    this.isDragging = false
    this.lastData = null
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.isDragging || !this.lastData) return

    const currentX = e.global.x
    const currentY = e.global.y

    const dx = currentX - this.lastData.x
    const dy = currentY - this.lastData.y

    console.log('[Camera] Panning', { dx, dy, newX: this.container.position.x + dx })

    this.container.position.x += dx
    this.container.position.y += dy

    this.lastData.set(currentX, currentY)
    this.clampPosition()
  }

  private onWheel(e: WheelEvent): void {
    const rect = this.app.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Only zoom if mouse is over the interaction target
    if (this.interactionTarget && this.interactionTarget !== this.app.stage) {
      const b = this.interactionTarget.getBounds()
      const isOver =
        mouseX >= b.x && mouseX <= b.x + b.width && mouseY >= b.y && mouseY <= b.y + b.height
      if (!isOver) return
    }

    e.preventDefault()

    const zoomFactor = 1.1
    const direction = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor

    // Use global coordinates for toWorld
    const worldPos = this.toWorld(mouseX, mouseY)

    let newScale = this.container.scale.x * direction

    // Clamp Zoom
    if (newScale < this.options.minZoom) newScale = this.options.minZoom
    if (newScale > this.options.maxZoom) newScale = this.options.maxZoom

    // Apply Scale
    this.container.scale.set(newScale)

    // Adjust position to keep mouse over same world point
    const newScreenPos = this.toScreen(worldPos.x, worldPos.y)

    this.container.x -= newScreenPos.x - mouseX
    this.container.y -= newScreenPos.y - mouseY

    this.clampPosition()
  }

  private clampPosition(): void {
    const limit = this.options.panLimit * this.container.scale.x
    if (this.container.x > limit) this.container.x = limit
    if (this.container.x < -limit) this.container.x = -limit
    if (this.container.y > limit) this.container.y = limit
    if (this.container.y < -limit) this.container.y = -limit
  }

  // --- Public API ---

  public get scale(): number {
    return this.container.scale.x
  }

  public get center(): Point {
    const centerPoint = this.getScreenCenter()
    return this.toWorld(centerPoint.x, centerPoint.y)
  }

  public toWorld(screenX: number, screenY: number): Point {
    return this.container.toLocal(new Point(screenX, screenY))
  }

  public toScreen(worldX: number, worldY: number): Point {
    return this.container.toGlobal(new Point(worldX, worldY))
  }

  public centerAt(x: number, y: number): void {
    // We assume this.container is a direct child of the interactionTarget (middle panel)
    // or at least that its position (0,0) matches the top-left of the viewport we want to use.
    let targetX = this.app.screen.width / 2
    let targetY = this.app.screen.height / 2

    if (this.interactionTarget) {
      const b = this.interactionTarget.hitArea as Rectangle
      if (b && b.width > 0 && b.height > 0) {
        targetX = b.width / 2
        targetY = b.height / 2
      }
    }

    this.container.position.set(
      targetX - x * this.container.scale.x,
      targetY - y * this.container.scale.y
    )
    this.clampPosition()
  }

  private getScreenCenter(): Point {
    // Return the visual center of the interactive viewport in local coordinates
    if (this.interactionTarget) {
      const b = this.interactionTarget.hitArea as Rectangle
      if (b) {
        return new Point(b.width / 2, b.height / 2)
      }
    }
    return new Point(this.app.screen.width / 2, this.app.screen.height / 2)
  }

  /**
   * Fits the given world bounds into the screen, centering it.
   */
  public fitToView(worldWidth: number, worldHeight: number, padding: number = 0): void {
    let viewW = this.app.screen.width
    let viewH = this.app.screen.height

    if (this.interactionTarget) {
      const b = this.interactionTarget.hitArea as Rectangle
      if (b && b.width > 0 && b.height > 0) {
        viewW = b.width
        viewH = b.height
      }
    }

    // Calculate required scale to fit
    const scaleX = (viewW - padding * 2) / worldWidth
    const scaleY = (viewH - padding * 2) / worldHeight

    const scale = Math.min(scaleX, scaleY, this.options.maxZoom)
    const finalScale = Math.max(scale, this.options.minZoom)

    console.log('[Camera] fitToView Calculation:', {
      viewDim: { viewW, viewH },
      worldDim: { worldWidth, worldHeight },
      padd: padding,
      scales: { scaleX, scaleY, scale, finalScale }
    })

    this.container.scale.set(finalScale)

    // Center logic
    const centerX = worldWidth / 2
    const centerY = worldHeight / 2

    this.centerAt(centerX, centerY)
  }
}
