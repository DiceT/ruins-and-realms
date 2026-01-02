/**
 * DungeonController
 * 
 * Manages dungeon generation, rendering, and player interaction.
 * Extracted from GameWindow.tsx for separation of concerns.
 * 
 * Phases A-E: Full implementation
 */

import { Container, Application } from 'pixi.js'
import { GameLayout } from '../../ui/GameLayout'
import { ThemeManager } from '../../managers/ThemeManager'
import { PlayerController } from '../../systems/PlayerController'
import { DungeonExplorationManager } from '../../systems/DungeonExplorationManager'
import { LIGHT_PROFILES, LightSourceType, LightProfile } from '../../data/LightingData'
import {
  SeedGrowthGenerator,
  SeedGrowthRenderer,
  SpineSeedGenerator,
  SpineSeedRenderer,
  DungeonViewRenderer,
  RoomClassifier,
  SpineSeedClassifier,
  SeedGrowthSettings,
  SpineSeedSettings,
  SeedGrowthState,
  SpineSeedState,
  GeneratorMode
} from '../../seed-growth'

export interface DungeonControllerCallbacks {
  onStateChange?: (state: SeedGrowthState | SpineSeedState) => void
  onAnimationChange?: (isAnimating: boolean) => void
  onViewModeChange?: (viewAsDungeon: boolean) => void
  onLog?: (message: string) => void
}

export class DungeonController {
  // Settings
  private seedSettings: SeedGrowthSettings | null = null
  private spineSettings: SpineSeedSettings | null = null
  private callbacks: DungeonControllerCallbacks
  
  // Mode
  private generatorMode: GeneratorMode = 'spineSeed'
  private viewAsDungeon: boolean = false
  
  // PixiJS References
  private app: Application | null = null
  private layout: GameLayout | null = null
  private container: Container | null = null
  
  // Generators
  private seedGrowthGen: SeedGrowthGenerator | null = null
  private spineSeedGen: SpineSeedGenerator | null = null
  
  // Renderers
  private seedGrowthRenderer: SeedGrowthRenderer | null = null
  private spineSeedRenderer: SpineSeedRenderer | null = null
  private dungeonViewRenderer: DungeonViewRenderer | null = null
  private spineSeedClassifier: SpineSeedClassifier = new SpineSeedClassifier()
  
  // Theme
  private themeManager: ThemeManager | null = null
  
  // Player & Visibility (Phase E)
  private explorationManager: DungeonExplorationManager | null = null
  
  // View Options
  private showRoomNumbers: boolean = true
  private showHeatMap: boolean = false
  private showWalkmap: boolean = false
  private showFog: boolean = true
  private showLight: boolean = true
  private showPlayer: boolean = true
  
  // Animation
  private animationFrameId: number | null = null
  private isAnimating: boolean = false
  
  // Initialized flag
  private initialized: boolean = false

  constructor(callbacks: DungeonControllerCallbacks = {}) {
    this.callbacks = callbacks
    console.log('[DungeonController] Created')
  }

  /**
   * Initialize the controller with UI container and layout
   * Creates generators and renderers
   */
  public init(
    app: Application, 
    layout: GameLayout,
    seedSettings: SeedGrowthSettings,
    spineSettings: SpineSeedSettings
  ): void {
    console.log('[DungeonController] init()')
    
    this.app = app
    this.layout = layout
    this.seedSettings = seedSettings
    this.spineSettings = spineSettings
    
    // Create main container for dungeon rendering
    this.container = new Container()
    layout.middlePanel.addChild(this.container)
    
    // Initialize theme manager
    this.themeManager = new ThemeManager()
    
    // Create generators based on current mode
    this.initGenerators()
    
    // Create renderers
    this.initRenderers()
    
    this.initialized = true
  }

  /**
   * Initialize generators based on current mode
   */
  private initGenerators(): void {
    if (this.generatorMode === 'organic' && this.seedSettings) {
      this.seedGrowthGen = new SeedGrowthGenerator(this.seedSettings)
      this.seedGrowthGen.runToCompletion()
      
      // Run classification
      const classifier = new RoomClassifier()
      const state = this.seedGrowthGen.getState()
      const { rooms, corridors, connections } = classifier.classify(
        state,
        this.seedSettings.minRoomArea,
        this.seedSettings.maxCorridorWidth,
        this.seedSettings.classificationMode
      )
      state.rooms = rooms
      state.corridors = corridors
      state.connections = connections
      
      this.callbacks.onStateChange?.(state)
      this.callbacks.onLog?.('Organic Dungeon initialized.')
    } else if (this.spineSettings) {
      this.spineSeedGen = new SpineSeedGenerator(this.spineSettings)
      this.spineSeedGen.runToCompletion()
      
      this.callbacks.onStateChange?.(this.spineSeedGen.getState())
      this.callbacks.onLog?.('Spine-Seed Dungeon initialized.')
    }
  }

  /**
   * Initialize renderers
   */
  private initRenderers(): void {
    if (!this.container || !this.layout) return
    
    const viewWidth = this.layout.middlePanel.width || 800
    const viewHeight = this.layout.middlePanel.height || 600
    
    if (this.generatorMode === 'organic' && this.seedSettings && this.seedGrowthGen) {
      this.seedGrowthRenderer = new SeedGrowthRenderer(this.container)
      this.seedGrowthRenderer.setTileSize(8)
      this.seedGrowthRenderer.render(this.seedGrowthGen.getState(), this.seedSettings)
      this.seedGrowthRenderer.centerView(
        this.seedSettings.gridWidth, 
        this.seedSettings.gridHeight, 
        viewWidth, 
        viewHeight
      )
    } else if (this.spineSettings && this.spineSeedGen) {
      this.spineSeedRenderer = new SpineSeedRenderer(this.container)
      this.spineSeedRenderer.setTileSize(50)
      this.spineSeedRenderer.render(this.spineSeedGen.getState(), this.spineSettings)
      this.spineSeedRenderer.centerView(
        this.spineSettings.gridWidth, 
        this.spineSettings.gridHeight, 
        viewWidth, 
        viewHeight
      )
    }
  }

  /**
   * Update settings - called when UI changes settings
   */
  public updateSettings(seedSettings: SeedGrowthSettings, spineSettings: SpineSeedSettings): void {
    this.seedSettings = seedSettings
    this.spineSettings = spineSettings
  }

  /**
   * Set generator mode (organic vs spineSeed)
   */
  public setGeneratorMode(mode: GeneratorMode): void {
    if (this.generatorMode === mode) return
    
    this.generatorMode = mode
    console.log('[DungeonController] Mode set to:', mode)
    
    // If initialized, switch renderers
    if (this.initialized) {
      this.switchMode()
    }
  }

  /**
   * Switch between organic and spine-seed modes
   */
  private switchMode(): void {
    if (!this.container || !this.layout) return
    
    const viewWidth = this.layout.middlePanel.width || 800
    const viewHeight = this.layout.middlePanel.height || 600
    
    if (this.generatorMode === 'organic') {
      // Hide spine renderer
      if (this.spineSeedRenderer) {
        this.spineSeedRenderer.getContainer().visible = false
      }
      
      // Create organic generator/renderer if needed
      if (!this.seedGrowthGen && this.seedSettings) {
        this.seedGrowthGen = new SeedGrowthGenerator(this.seedSettings)
        this.seedGrowthGen.runToCompletion()
        
        const classifier = new RoomClassifier()
        const state = this.seedGrowthGen.getState()
        const { rooms, corridors, connections } = classifier.classify(
          state,
          this.seedSettings.minRoomArea,
          this.seedSettings.maxCorridorWidth,
          this.seedSettings.classificationMode
        )
        state.rooms = rooms
        state.corridors = corridors
        state.connections = connections
      }
      
      if (!this.seedGrowthRenderer && this.seedSettings) {
        this.seedGrowthRenderer = new SeedGrowthRenderer(this.container)
        this.seedGrowthRenderer.setTileSize(8)
        this.seedGrowthRenderer.centerView(
          this.seedSettings.gridWidth, 
          this.seedSettings.gridHeight, 
          viewWidth, 
          viewHeight
        )
      }
      
      // Show and render
      if (this.seedGrowthRenderer && this.seedGrowthGen) {
        this.seedGrowthRenderer.getContainer().visible = true
        this.seedGrowthRenderer.render(this.seedGrowthGen.getState(), this.seedSettings!)
        this.callbacks.onStateChange?.(this.seedGrowthGen.getState())
      }
    } else {
      // Hide organic renderer
      if (this.seedGrowthRenderer) {
        this.seedGrowthRenderer.getContainer().visible = false
      }
      
      // Create spine generator/renderer if needed
      if (!this.spineSeedGen && this.spineSettings) {
        this.spineSeedGen = new SpineSeedGenerator(this.spineSettings)
        this.spineSeedGen.runToCompletion()
      }
      
      if (!this.spineSeedRenderer && this.spineSettings) {
        this.spineSeedRenderer = new SpineSeedRenderer(this.container)
        this.spineSeedRenderer.setTileSize(50)
        this.spineSeedRenderer.centerView(
          this.spineSettings.gridWidth, 
          this.spineSettings.gridHeight, 
          viewWidth, 
          viewHeight
        )
      }
      
      // Show and render
      if (this.spineSeedRenderer && this.spineSeedGen) {
        this.spineSeedRenderer.getContainer().visible = true
        this.spineSeedRenderer.render(this.spineSeedGen.getState(), this.spineSettings!)
        this.callbacks.onStateChange?.(this.spineSeedGen.getState())
      }
    }
  }

  // --- Generation Methods ---

  public regenerate(): void {
    console.log('[DungeonController] regenerate()')
    
    this.stopAnimation()
    
    if (this.generatorMode === 'organic' && this.seedGrowthGen && this.seedGrowthRenderer && this.seedSettings) {
      this.seedGrowthGen.reset(this.seedSettings)
      this.runChunkedGeneration('organic')
    } else if (this.spineSeedGen && this.spineSeedRenderer && this.spineSettings) {
      this.spineSeedGen.reset(this.spineSettings)
      this.runChunkedGeneration('spineSeed')
    }
  }

  /**
   * Run generation in chunks to avoid blocking
   */
  private runChunkedGeneration(mode: 'organic' | 'spineSeed'): void {
    const runChunk = () => {
      if (mode === 'organic' && this.seedGrowthGen && this.seedGrowthRenderer && this.seedSettings) {
        const state = this.seedGrowthGen.getState()
        if (state.isComplete) {
          // Run classification
          const classifier = new RoomClassifier()
          const { rooms, corridors, connections } = classifier.classify(
            state,
            this.seedSettings.minRoomArea,
            this.seedSettings.maxCorridorWidth,
            this.seedSettings.classificationMode
          )
          state.rooms = rooms
          state.corridors = corridors
          state.connections = connections
          
          this.seedGrowthRenderer.render(state, this.seedSettings)
          // Only notify state change on completion to prevent mid-generation ViewAsDungeon render
          this.callbacks.onStateChange?.(state)
          return
        }
        this.seedGrowthGen.runSteps(100)
        this.seedGrowthRenderer.render(this.seedGrowthGen.getState(), this.seedSettings)
        // Don't notify state change mid-generation - only update renderer for visual feedback
        requestAnimationFrame(runChunk)
      } else if (this.spineSeedGen && this.spineSeedRenderer && this.spineSettings) {
        const state = this.spineSeedGen.getState()
        if (state.isComplete) {
          this.spineSeedRenderer.render(state, this.spineSettings)
          // Only notify state change on completion
          this.callbacks.onStateChange?.(state)
          return
        }
        this.spineSeedGen.runSteps(50)
        this.spineSeedRenderer.render(this.spineSeedGen.getState(), this.spineSettings)
        // Don't notify state change mid-generation
        requestAnimationFrame(runChunk)
      }
    }
    
    runChunk()
  }

  public step(): void {
    if (this.generatorMode === 'organic' && this.seedGrowthGen && this.seedGrowthRenderer && this.seedSettings) {
      if (this.seedGrowthGen.getState().isComplete) {
        this.seedGrowthGen.reset(this.seedSettings)
      }
      this.seedGrowthGen.step()
      this.seedGrowthRenderer.render(this.seedGrowthGen.getState(), this.seedSettings)
      this.callbacks.onStateChange?.(this.seedGrowthGen.getState())
    } else if (this.spineSeedGen && this.spineSeedRenderer && this.spineSettings) {
      if (this.spineSeedGen.getState().isComplete) {
        this.spineSeedGen.reset(this.spineSettings)
      }
      this.spineSeedGen.step()
      this.spineSeedRenderer.render(this.spineSeedGen.getState(), this.spineSettings)
      this.callbacks.onStateChange?.(this.spineSeedGen.getState())
    }
  }

  public runSteps(n: number): void {
    if (this.generatorMode === 'organic' && this.seedGrowthGen && this.seedGrowthRenderer && this.seedSettings) {
      this.seedGrowthGen.runSteps(n)
      
      if (this.seedGrowthGen.getState().isComplete) {
        const classifier = new RoomClassifier()
        const state = this.seedGrowthGen.getState()
        const { rooms, corridors, connections } = classifier.classify(
          state,
          this.seedSettings.minRoomArea,
          this.seedSettings.maxCorridorWidth,
          this.seedSettings.classificationMode
        )
        state.rooms = rooms
        state.corridors = corridors
        state.connections = connections
      }
      
      this.seedGrowthRenderer.render(this.seedGrowthGen.getState(), this.seedSettings)
      this.callbacks.onStateChange?.(this.seedGrowthGen.getState())
    } else if (this.spineSeedGen && this.spineSeedRenderer && this.spineSettings) {
      this.spineSeedGen.runSteps(n)
      this.spineSeedRenderer.render(this.spineSeedGen.getState(), this.spineSettings)
      this.callbacks.onStateChange?.(this.spineSeedGen.getState())
    }
  }

  public runToCompletion(): void {
    this.runChunkedGeneration(this.generatorMode)
  }

  public toggleAnimation(): void {
    if (this.isAnimating) {
      this.stopAnimation()
    } else {
      this.startAnimation()
    }
  }

  private startAnimation(): void {
    this.isAnimating = true
    this.callbacks.onAnimationChange?.(true)
    
    const animate = () => {
      if (this.generatorMode === 'organic' && this.seedGrowthGen && this.seedGrowthRenderer && this.seedSettings) {
        const state = this.seedGrowthGen.getState()
        if (state.isComplete) {
          this.stopAnimation()
          
          const classifier = new RoomClassifier()
          const { rooms, corridors, connections } = classifier.classify(
            state,
            this.seedSettings.minRoomArea,
            this.seedSettings.maxCorridorWidth,
            this.seedSettings.classificationMode
          )
          state.rooms = rooms
          state.corridors = corridors
          state.connections = connections
          
          this.seedGrowthRenderer.render(state, this.seedSettings)
          this.callbacks.onStateChange?.(state)
          return
        }
        this.seedGrowthGen.runSteps(3)
        this.seedGrowthRenderer.render(state, this.seedSettings)
        this.callbacks.onStateChange?.(state)
        this.animationFrameId = requestAnimationFrame(animate)
      } else if (this.spineSeedGen && this.spineSeedRenderer && this.spineSettings) {
        const state = this.spineSeedGen.getState()
        if (state.isComplete) {
          this.stopAnimation()
          this.spineSeedRenderer.render(state, this.spineSettings)
          this.callbacks.onStateChange?.(state)
          return
        }
        this.spineSeedGen.runSteps(2)
        this.spineSeedRenderer.render(state, this.spineSettings)
        this.callbacks.onStateChange?.(state)
        this.animationFrameId = requestAnimationFrame(animate)
      }
    }
    
    animate()
  }

  private stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.isAnimating = false
    this.callbacks.onAnimationChange?.(false)
  }

  // --- View Methods (Phase D) ---

  /**
   * Toggle between seed view and dungeon view
   */
  public setViewAsDungeon(enabled: boolean): void {
    console.log('[DungeonController] setViewAsDungeon:', enabled)
    
    if (!this.app || !this.layout) return
    
    const state = this.getCurrentState()
    if (!state) return
    
    this.viewAsDungeon = enabled
    this.callbacks.onViewModeChange?.(enabled)
    
    const viewWidth = this.app.screen.width || this.layout.middlePanel.width || 800
    const viewHeight = this.app.screen.height || this.layout.middlePanel.height || 600
    
    if (enabled) {
      this.enableDungeonView(state, viewWidth, viewHeight)
    } else {
      this.disableDungeonView(state)
    }
  }

  /**
   * Enable dungeon view mode
   */
  private enableDungeonView(state: SeedGrowthState | SpineSeedState, viewWidth: number, viewHeight: number): void {
    if (!this.app) return
    
    // Create dungeon view renderer if needed
    if (!this.dungeonViewRenderer) {
      if (!this.themeManager) {
        this.themeManager = new ThemeManager()
      }
      this.dungeonViewRenderer = new DungeonViewRenderer(
        this.app.stage,
        { tileSize: 50, themeManager: this.themeManager }
      )
    }
    
    // Hide seed renderers
    if (this.seedGrowthRenderer) {
      this.seedGrowthRenderer.getContainer().visible = false
    }
    if (this.spineSeedRenderer) {
      this.spineSeedRenderer.getContainer().visible = false
    }
    
    // Set view dimensions
    this.dungeonViewRenderer.setViewDimensions(viewWidth, viewHeight)
    
    // Sync camera from seed renderer
    const isToggleOn = !this.dungeonViewRenderer.getContainer().visible
    if (isToggleOn) {
      if (this.generatorMode === 'spineSeed' && this.spineSeedRenderer) {
        const t = this.spineSeedRenderer.getTransform()
        this.dungeonViewRenderer.syncTransform(t.x, t.y, t.scale)
      } else if (this.seedGrowthRenderer) {
        const t = this.seedGrowthRenderer.getTransform()
        this.dungeonViewRenderer.syncTransform(t.x, t.y, t.scale)
      }
    }
    
    // Render dungeon view
    if (this.generatorMode === 'spineSeed' && this.spineSettings) {
      this.renderSpineDungeonView(state as SpineSeedState)
    } else if (this.seedSettings) {
      this.dungeonViewRenderer.renderDungeonView(
        state as SeedGrowthState, 
        this.seedSettings, 
        this.showRoomNumbers, 
        this.showWalkmap
      )
    }
    
    this.dungeonViewRenderer.setShowRoomNumbers(this.showRoomNumbers)
    this.dungeonViewRenderer.getContainer().visible = true
  }

  /**
   * Render spine-seed state as dungeon view
   */
  private renderSpineDungeonView(state: SpineSeedState): void {
    if (!this.dungeonViewRenderer || !this.spineSettings) return
    
    // Use Classifier to get clean DungeonData
    const dungeonData = this.spineSeedClassifier.classify(state, this.spineSettings)
    
    // Pass dungeon data to renderer
    this.dungeonViewRenderer.renderDungeonView(
      dungeonData, 
      this.spineSettings as any, 
      this.showRoomNumbers, 
      this.showWalkmap
    )
    
    // Initialize player if generation is complete
    if (state.spineComplete) {
      this.initializePlayer(state, dungeonData.rooms)
    }
  }

  /**
   * Initialize player and visibility systems
   */
  private initializePlayer(state: SpineSeedState, prunedRooms: { tiles: { x: number; y: number }[] }[]): void {
    if (!this.dungeonViewRenderer || !this.spineSettings) return
    
    // Find start position
    let startX = 0
    let startY = 0
    const stairs = state.objects?.find(o => o.type === 'stairs_up')
    if (stairs) {
      startX = stairs.x
      startY = stairs.y
    } else if (state.spineTiles && state.spineTiles.length > 0) {
      startX = state.spineTiles[0].x
      startY = state.spineTiles[0].y
    }
    
    // Build walkmap
    const walkableSet = new Set<string>()
    const add = (x: number, y: number) => {
      walkableSet.add(`${x},${y}`)
    }
    
    // Add room tiles
    prunedRooms.forEach(r => r.tiles.forEach(t => add(t.x, t.y)))
    
    // Add expanded corridors from renderer
    const expandedCorridors = this.dungeonViewRenderer.getWalkableTiles()
    expandedCorridors.forEach(t => add(t.x, t.y))
    
    // Add walkable objects
    state.objects?.forEach(obj => {
      if (obj.type.startsWith('door') || obj.type === 'stairs_up') {
        add(obj.x, obj.y)
      }
    })

    const walkableArray = Array.from(walkableSet).map(k => {
      const [x, y] = k.split(',').map(Number)
      return { x, y }
    })
    
    // Init Exploration Manager
    this.explorationManager = new DungeonExplorationManager({
      gridWidth: this.spineSettings.gridWidth,
      gridHeight: this.spineSettings.gridHeight,
      startX,
      startY,
      walkableTiles: walkableArray,
      renderer: this.dungeonViewRenderer
    })
  }

  /**
   * Handle player movement - update visibility
   */

  /**
   * Disable dungeon view mode
   */
  private disableDungeonView(state: SeedGrowthState | SpineSeedState): void {
    const isToggleOff = this.dungeonViewRenderer?.getContainer().visible
    
    // Hide dungeon view
    if (this.dungeonViewRenderer) {
      this.dungeonViewRenderer.getContainer().visible = false
    }
    
    // Restore seed renderer
    if (this.seedGrowthRenderer && this.generatorMode === 'organic') {
      this.seedGrowthRenderer.getContainer().visible = true
      if (isToggleOff && this.dungeonViewRenderer) {
        const t = this.dungeonViewRenderer.getTransform()
        this.seedGrowthRenderer.syncTransform(t.x, t.y, t.scale)
      }
      if (this.seedSettings) {
        this.seedGrowthRenderer.render(state as SeedGrowthState, this.seedSettings)
      }
    }
    
    // Restore spine renderer
    if (this.spineSeedRenderer && this.generatorMode === 'spineSeed') {
      this.spineSeedRenderer.getContainer().visible = true
      if (isToggleOff && this.dungeonViewRenderer) {
        const t = this.dungeonViewRenderer.getTransform()
        this.spineSeedRenderer.syncTransform(t.x, t.y, t.scale)
      }
      if (this.spineSettings) {
        this.spineSeedRenderer.render(state as SpineSeedState, this.spineSettings)
      }
    }
    
    // Cleanup exploration manager
    if (this.explorationManager) {
      this.explorationManager.destroy()
      this.explorationManager = null
    }
  }

  /**
   * Set active light source
   */
  public setActiveLight(light: LightSourceType): void {
    this.explorationManager?.setActiveLight(light)
  }

  public setShowRoomNumbers(enabled: boolean): void {
    this.showRoomNumbers = enabled
    this.dungeonViewRenderer?.setShowRoomNumbers(enabled)
  }

  public setShowHeatMap(enabled: boolean): void {
    this.showHeatMap = enabled
    this.dungeonViewRenderer?.setShowHeatMap(enabled)
  }

  public setShowWalkmap(enabled: boolean): void {
    this.showWalkmap = enabled
    this.dungeonViewRenderer?.setShowWalkmap(enabled)
  }

  public setShowFog(enabled: boolean): void {
    this.showFog = enabled
    this.dungeonViewRenderer?.setDebugVisibility(enabled, this.showLight)
  }

  public setShowLight(enabled: boolean): void {
    this.showLight = enabled
    this.dungeonViewRenderer?.setDebugVisibility(this.showFog, enabled)
  }

  public setShowPlayer(enabled: boolean): void {
    this.showPlayer = enabled
    this.explorationManager?.setShowPlayer(enabled)
  }

  public setTheme(themeName: string): void {
    this.themeManager?.setTheme(themeName)
  }

  // --- State Accessors ---

  public isInitialized(): boolean {
    return this.initialized
  }

  public getGeneratorMode(): GeneratorMode {
    return this.generatorMode
  }
  
  public getIsAnimating(): boolean {
    return this.isAnimating
  }

  public getViewAsDungeon(): boolean {
    return this.viewAsDungeon
  }

  public getSeedGrowthGen(): SeedGrowthGenerator | null {
    return this.seedGrowthGen
  }

  public getSpineSeedGen(): SpineSeedGenerator | null {
    return this.spineSeedGen
  }

  public getSeedGrowthRenderer(): SeedGrowthRenderer | null {
    return this.seedGrowthRenderer
  }

  public getSpineSeedRenderer(): SpineSeedRenderer | null {
    return this.spineSeedRenderer
  }

  public getDungeonViewRenderer(): DungeonViewRenderer | null {
    return this.dungeonViewRenderer
  }

  public getThemeManager(): ThemeManager | null {
    return this.themeManager
  }

  public getExplorationManager(): DungeonExplorationManager | null {
    return this.explorationManager
  }

  public getCurrentState(): SeedGrowthState | SpineSeedState | null {
    if (this.generatorMode === 'organic') {
      return this.seedGrowthGen?.getState() ?? null
    }
    return this.spineSeedGen?.getState() ?? null
  }

  // --- Cleanup ---

  public destroy(): void {
    console.log('[DungeonController] destroy()')
    
    this.stopAnimation()
    
    // Cleanup player/visibility
    if (this.explorationManager) {
      this.explorationManager.destroy()
      this.explorationManager = null
    }
    
    // Destroy renderers
    if (this.seedGrowthRenderer) {
      this.seedGrowthRenderer.destroy()
      this.seedGrowthRenderer = null
    }
    if (this.spineSeedRenderer) {
      this.spineSeedRenderer.destroy()
      this.spineSeedRenderer = null
    }
    if (this.dungeonViewRenderer) {
      this.dungeonViewRenderer.destroy()
      this.dungeonViewRenderer = null
    }
    
    // Remove container
    if (this.container) {
      this.container.destroy({ children: true })
      this.container = null
    }
    
    // Nullify references
    this.seedGrowthGen = null
    this.spineSeedGen = null
    this.themeManager = null
    this.app = null
    this.layout = null
    this.seedSettings = null
    this.spineSettings = null
    this.initialized = false
    this.viewAsDungeon = false
  }
}


