import { Application, Assets, Sprite } from 'pixi.js'

export class BackgroundSystem {
  private app: Application
  private bgSprite: Sprite | null = null

  private isVisible: boolean = true

  constructor(app: Application) {
    this.app = app
  }

  public async init(): Promise<void> {
    try {
      // 1. Load Assets
      const bgTextureGlob = import.meta.glob('@/assets/images/backgrounds/main-game/*.png', {
        eager: true
      })
      const bgPaths = Object.values(bgTextureGlob).map((m) => (m as { default: string }).default)

      if (bgPaths.length === 0) {
        console.warn('[BackgroundSystem] No background images found.')
        return
      }

      const randomBg = bgPaths[Math.floor(Math.random() * bgPaths.length)]
      const bgTex = await Assets.load(randomBg)

      this.bgSprite = new Sprite(bgTex)
      this.bgSprite.label = 'MainBackground'

      // Respect the visibility state set before loading finished
      this.bgSprite.visible = this.isVisible

      this.app.stage.addChildAt(this.bgSprite, 0)
      this.resize()

      // Start Parallax Loop
      this.app.ticker.add(this.update, this)
      console.log('[BackgroundSystem] Loaded and added to stage.', { visible: this.isVisible })
    } catch (err) {
      console.error('[BackgroundSystem] Failed to load background:', err)
    }
  }

  public resize(): void {
    if (!this.bgSprite) return

    const { width, height } = this.app.screen

    // Reset scale to recalculate
    this.bgSprite.scale.set(1)

    // 1. Fit Height First
    this.bgSprite.height = height
    this.bgSprite.scale.x = this.bgSprite.scale.y

    // 2. Ensure Width is at least screen width (for covering gaps)
    if (this.bgSprite.width < width) {
      this.bgSprite.width = width
      this.bgSprite.scale.y = this.bgSprite.scale.x
    }

    // 3. Center vertically if needed (though usually we want top-aligned or just fill)
    // For now, simple top-left align is fine as long as it fills.
  }

  private update(): void {
    if (!this.bgSprite) return

    const mouse = this.app.renderer.events.pointer.global
    const screenW = this.app.screen.width

    // Calculate the "excess" width we can pan
    const diff = this.bgSprite.width - screenW

    if (diff > 0) {
      // 0.0 to 1.0 based on mouse X
      const ratio = Math.max(0, Math.min(1, mouse.x / screenW))

      // Target X position
      const targetX = -diff * ratio

      // Lerp for smoothness
      this.bgSprite.x += (targetX - this.bgSprite.x) * 0.1
    } else {
      this.bgSprite.x = 0
    }
  }

  public setVisible(visible: boolean): void {
    console.log('[BackgroundSystem] setVisible:', visible)
    this.isVisible = visible
    if (this.bgSprite) {
      this.bgSprite.visible = visible
    }
  }

  public destroy(): void {
    this.app.ticker.remove(this.update, this)
    // Sprite is destroyed by stage cleanup usu, but we can be explicit if we want
  }
}
