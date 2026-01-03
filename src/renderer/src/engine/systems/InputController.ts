/**
 * InputController
 * 
 * Unified input handling for mouse and keyboard events.
 * Provides a single source of truth for all input handling across the application.
 * 
 * Supports:
 * - Pan via right-click, middle-click, or Alt+left-click drag
 * - Zoom via mouse wheel
 * - Keyboard input for movement and modifiers
 */

import { Container, FederatedPointerEvent } from 'pixi.js'

export interface ModifierState {
  alt: boolean
  ctrl: boolean
  shift: boolean
}

export interface InputControllerOptions {
  /** PixiJS container to attach events to */
  container: Container
  
  /** HTML canvas element for wheel events */
  canvas?: HTMLCanvasElement
  
  // Pan callbacks
  onPanStart?: () => void
  onPanMove?: (dx: number, dy: number) => void
  onPanEnd?: () => void
  
  // Zoom callback (delta > 0 = zoom out, delta < 0 = zoom in)
  onZoom?: (delta: number, mouseX: number, mouseY: number) => void
  
  // Keyboard callbacks
  onKeyDown?: (key: string, modifiers: ModifierState) => void
  onKeyUp?: (key: string) => void
  
  // Click callback (for non-pan clicks)
  onClick?: (x: number, y: number, button: number) => void
}

export class InputController {
  private container: Container
  private canvas?: HTMLCanvasElement
  private options: InputControllerOptions
  
  // Pan state
  private isPanning: boolean = false
  private lastPanPos: { x: number; y: number } = { x: 0, y: 0 }
  
  // Bound handlers for cleanup
  private boundPointerDown: (e: FederatedPointerEvent) => void
  private boundPointerMove: (e: FederatedPointerEvent) => void
  private boundPointerUp: (e: FederatedPointerEvent) => void
  private boundWheel: (e: WheelEvent) => void
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private boundContextMenu: (e: Event) => void
  
  constructor(options: InputControllerOptions) {
    this.options = options
    this.container = options.container
    this.canvas = options.canvas
    
    // Bind handlers
    this.boundPointerDown = this.onPointerDown.bind(this)
    this.boundPointerMove = this.onPointerMove.bind(this)
    this.boundPointerUp = this.onPointerUp.bind(this)
    this.boundWheel = this.onWheel.bind(this)
    this.boundKeyDown = this.onKeyDown.bind(this)
    this.boundKeyUp = this.onKeyUp.bind(this)
    this.boundContextMenu = (e: Event) => e.preventDefault()
    
    this.attach()
  }
  
  private attach(): void {
    // Ensure container can receive events
    this.container.eventMode = 'static'
    if (!this.container.hitArea) {
      this.container.hitArea = { contains: () => true }
    }
    
    // PixiJS pointer events
    this.container.on('pointerdown', this.boundPointerDown)
    this.container.on('pointermove', this.boundPointerMove)
    this.container.on('pointerup', this.boundPointerUp)
    this.container.on('pointerupoutside', this.boundPointerUp)
    
    // Wheel events (native on canvas for better performance)
    if (this.canvas) {
      this.canvas.addEventListener('wheel', this.boundWheel, { passive: false })
      this.canvas.addEventListener('contextmenu', this.boundContextMenu)
    } else {
      // Fallback to pixi wheel event
      this.container.on('wheel', this.boundWheel as any)
    }
    
    // Keyboard events (on window)
    window.addEventListener('keydown', this.boundKeyDown)
    window.addEventListener('keyup', this.boundKeyUp)
  }
  
  private onPointerDown(e: FederatedPointerEvent): void {
    const altKey = (e.originalEvent as MouseEvent)?.altKey ?? false
    
    // Check for pan triggers: middle-click (1), right-click (2), or Alt+left-click (0)
    const isPanButton = e.button === 1 || e.button === 2 || (e.button === 0 && altKey)
    
    if (isPanButton) {
      e.preventDefault()
      this.isPanning = true
      this.lastPanPos = { x: e.globalX, y: e.globalY }
      this.options.onPanStart?.()
    } else if (e.button === 0) {
      // Left click (non-pan)
      this.options.onClick?.(e.globalX, e.globalY, e.button)
    }
  }
  
  private onPointerMove(e: FederatedPointerEvent): void {
    if (this.isPanning) {
      const dx = e.globalX - this.lastPanPos.x
      const dy = e.globalY - this.lastPanPos.y
      this.lastPanPos = { x: e.globalX, y: e.globalY }
      this.options.onPanMove?.(dx, dy)
    }
  }
  
  private onPointerUp(_e: FederatedPointerEvent): void {
    if (this.isPanning) {
      this.isPanning = false
      this.options.onPanEnd?.()
    }
  }
  
  private onWheel(e: WheelEvent): void {
    e.preventDefault()
    
    // Get mouse position relative to canvas
    let mouseX = e.clientX
    let mouseY = e.clientY
    
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect()
      mouseX = e.clientX - rect.left
      mouseY = e.clientY - rect.top
    }
    
    // Normalize delta (positive = zoom out, negative = zoom in)
    const delta = e.deltaY
    this.options.onZoom?.(delta, mouseX, mouseY)
  }
  
  private onKeyDown(e: KeyboardEvent): void {
    // Ignore if typing in an input
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || 
        (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
      return
    }
    
    const modifiers: ModifierState = {
      alt: e.altKey,
      ctrl: e.ctrlKey,
      shift: e.shiftKey
    }
    
    this.options.onKeyDown?.(e.key, modifiers)
  }
  
  private onKeyUp(e: KeyboardEvent): void {
    this.options.onKeyUp?.(e.key)
  }
  
  /** Check if currently panning */
  public get panning(): boolean {
    return this.isPanning
  }
  
  /** Cleanup all event listeners */
  public destroy(): void {
    this.container.off('pointerdown', this.boundPointerDown)
    this.container.off('pointermove', this.boundPointerMove)
    this.container.off('pointerup', this.boundPointerUp)
    this.container.off('pointerupoutside', this.boundPointerUp)
    
    if (this.canvas) {
      this.canvas.removeEventListener('wheel', this.boundWheel)
      this.canvas.removeEventListener('contextmenu', this.boundContextMenu)
    } else {
      this.container.off('wheel', this.boundWheel as any)
    }
    
    window.removeEventListener('keydown', this.boundKeyDown)
    window.removeEventListener('keyup', this.boundKeyUp)
  }
}
