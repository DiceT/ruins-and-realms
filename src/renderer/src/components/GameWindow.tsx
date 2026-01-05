import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Application, Graphics, Sprite, Assets } from 'pixi.js'
import { TerrainAssetLoader } from '../engine/map/TerrainAssetLoader'
import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { MapEngine } from '../engine/MapEngine'
import { OverworldManager } from '../engine/managers/OverworldManager'
import { ThemeManager } from '../engine/managers/ThemeManager'
import { GameLayout } from '../engine/ui/GameLayout'
import { BackgroundSystem } from '../engine/ui/BackgroundSystem'
import { GameOrchestrator } from '../engine/game/GameOrchestrator'
import { DungeonController, OverworldController } from '../engine/game/controllers'

interface GameWindowProps {
  onBack?: () => void
}

import { DiceOverlay } from './DiceOverlay'
import { DiceSettingsWrapper } from './DiceSettingsWrapper'
import { SettingsProvider, SettingsSync, diceEngine } from '../integrations/anvil-dice-app'
import { D8IconPanel } from './D8IconPanel'
import diceLanding from '../assets/images/ui/dice-landing.png'
import flairOverlay from '../assets/images/overland-tiles/flair_empty_0.png'

// Seed Growth System
import {
  SeedGrowthGenerator,
  RoomClassifier,
  CorridorPathfinder,
  SeedGrowthSettings,
  SeedGrowthState,
  createDefaultSettings,
  MaskToolMode,
  // Spine-Seed Generator
  SpineSeedGenerator,
  SpineSeedSettings,
  SpineSeedState,
  createDefaultSpineSeedSettings,
  GeneratorMode
} from '../engine/seed-growth'
import { getSeedLabel } from '../engine/seed-growth/ManualSeedSystem'
import { VisibilitySystem } from '../engine/systems/VisibilitySystem'
import { PlayerController } from '../engine/systems/PlayerController'
import { LIGHT_PROFILES, LightSourceType } from '../engine/data/LightingData'

import { SeedGrowthControlPanel } from './SeedGrowthControlPanel'
import { UnclaimedLogModal } from './UnclaimedLogModal'
import { DungeonControlPanel } from './DungeonControlPanel'
import { Container } from 'pixi.js'

interface LandTypeEntry {
  land: string
  rank: number
  coordX: number
  coordY: number
}

interface Plot {
  plotTag: string
  landType: string
  size: number
  rank: number
  rankModifier: number
  ownerAndDetails: string
  landTypeList: LandTypeEntry[]
}

// Dungeon generation code stripped - taking new direction


export const GameWindow = ({ onBack }: GameWindowProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null)
  const pixiContainerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // Core Systems Refs
  const appRef = useRef<Application | null>(null)
  const layoutRef = useRef<GameLayout | null>(null)
  const bgSystemRef = useRef<BackgroundSystem | null>(null)
  const mapEngineRef = useRef<MapEngine | null>(null)
  const initializingRef = useRef(false)
  const dungeonControllerRef = useRef<DungeonController | null>(null)
  const overworldControllerRef = useRef<OverworldController | null>(null)

  // Global Store
  // Global Store
  // const activeTheme = useThemeStore((state) => state.activeTheme) // Removed: Store doesn't exist yet


  // Custom hook to sync resize
  // Moved to after initialization


  // --- REFS & STATE ---
  const showMap = useAppStore((state) => state.showMap)
  const { toggleMap } = useAppActions()



  // Local State for Dice Settings
  const [showDiceSettings, setShowDiceSettings] = useState(false)

  const [mapConfig, setMapConfig] = useState<{ width: number; height: number; id: number }>({
    width: 26,
    height: 26,
    id: 0
  })



  // Track if core systems are ready
  const [isReady, setIsReady] = useState(false)

  // Dungeon UI State (stripped - only keeping logs)
  const [logs, setLogs] = useState<string[]>(['Ready.'])

  // --- SEED GROWTH STATE ---
  const [generatorMode, setGeneratorMode] = useState<GeneratorMode>('spineSeed')
  const [seedGrowthSettings, setSeedGrowthSettings] = useState<SeedGrowthSettings>(createDefaultSettings())
  const seedGrowthSettingsRef = useRef(seedGrowthSettings)
  const seedGrowthGenRef = useRef<SeedGrowthGenerator | null>(null)
  const seedGrowthRendererRef = useRef<SeedGrowthRenderer | null>(null)
  const dungeonViewRendererRef = useRef<DungeonViewRenderer | null>(null)
  const [seedGrowthState, setSeedGrowthState] = useState<SeedGrowthState | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  // Dungeon view is always enabled (removed toggle)
  const [viewAsDungeon, setViewAsDungeon] = useState<boolean>(true)
  const [showRoomNumbers, setShowRoomNumbers] = useState<boolean>(true)
  const [showHeatMap, setShowHeatMap] = useState<boolean>(false)
  const [showWalkmap, setShowWalkmap] = useState<boolean>(false) // New: Walkmap toggle
  const [showSpineDebug, setShowSpineDebug] = useState<boolean>(false) // Spine debug overlay toggle
  const [activeTheme, setActiveTheme] = useState('None')

  const themeManagerRef = useRef<ThemeManager | null>(null)

  // Custom hook to sync resize - REMOVED (Simpler method used inline)


  // --- SPINE-SEED STATE ---
  const [spineSeedSettings, setSpineSeedSettings] = useState<SpineSeedSettings>(createDefaultSpineSeedSettings())
  const spineSeedSettingsRef = useRef(spineSeedSettings)
  const spineSeedGenRef = useRef<SpineSeedGenerator | null>(null)
  const spineSeedRendererRef = useRef<SpineSeedRenderer | null>(null)
  const [spineSeedState, setSpineSeedState] = useState<SpineSeedState | null>(null)


  // Rolling State
  const [isRolling, setIsRolling] = useState(false)

  // -- OVERWORLD STATE --
  const [gameMode, setGameMode] = useState<'dungeon' | 'overworld'>('dungeon')

  // Logging State
  const [unClaimedLog, setUnClaimedLog] = useState<Plot[]>([])
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)

  const [overworldStep, setOverworldStep] = useState<number>(0) // 0=Start, 1=City Placed/Roll Terrain, 2=Terrain Rolled/Roll Count, 3=Placing
  const [currentTerrain, setCurrentTerrain] = useState<string | null>(null)
  const [tilesToPlace, setTilesToPlace] = useState(0)
  const [townPlaced, setTownPlaced] = useState(false)
  // REFACTORED: Manager Ref
  const overworldManagerRef = useRef<OverworldManager>(new OverworldManager())

  // --- PLAYER & VISIBILITY STATE ---
  const visibilitySystemRef = useRef<VisibilitySystem | null>(null)
  const playerControllerRef = useRef<PlayerController | null>(null)
  const [activeLight, setActiveLight] = useState<LightSourceType>('torch')
  const [showFog, setShowFog] = useState(false)  // Default OFF
  const [showLight, setShowLight] = useState(false)  // Default OFF
  const [showPlayer, setShowPlayer] = useState(false)  // Default OFF

  // Ref for movement handler access without re-binding
  const showPlayerRef = useRef(false)  // Sync with showPlayer default
  useEffect(() => { showPlayerRef.current = showPlayer }, [showPlayer])

  // Interactive Exploration State
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; visible: boolean }>({
    x: 0,
    y: 0,
    text: '',
    visible: false
  })
  const validMovesRef = useRef<Set<string>>(new Set())

  // Fix: Stale GameMode and OverworldStep Ref for MapEngine Callbacks
  const gameModeRef = useRef(gameMode)
  const overworldStepRef = useRef(overworldStep)
  useEffect(() => {
    gameModeRef.current = gameMode
    overworldStepRef.current = overworldStep
  }, [gameMode, overworldStep])

  // Keep seedGrowthSettingsRef in sync
  useEffect(() => {
    seedGrowthSettingsRef.current = seedGrowthSettings
  }, [seedGrowthSettings])

  // Keep spineSeedSettingsRef in sync
  useEffect(() => {
    spineSeedSettingsRef.current = spineSeedSettings
  }, [spineSeedSettings])

  const addLog = (msg: string): void => {
    setLogs((prev) => [msg, ...prev.slice(0, 9)]) // Keep last 10 logs
  }

  // --- SEED GROWTH CALLBACKS ---
  const processSeedGrowthComplete = useCallback((state: SeedGrowthState) => {
    // Classify rooms and seed corridors (seed layer only)
    // NOTE: Dungeon corridors (A* pathfinding) are handled separately in DungeonViewRenderer
    const classifier = new RoomClassifier()
    const { rooms, corridors, connections } = classifier.classify(
      state,
      seedGrowthSettings.minRoomArea,
      seedGrowthSettings.maxCorridorWidth,
      seedGrowthSettings.classificationMode
    )

    // Update state with seed-layer classification results
    state.rooms = rooms
    state.corridors = corridors
    state.connections = connections
  }, [seedGrowthSettings])

  const handleSeedGrowthRegenerate = useCallback(() => {
    // Delegate to controller (controller handles animation, state updates via callbacks)
    if (dungeonControllerRef.current) {
      dungeonControllerRef.current.regenerate()
    }
  }, [])

  const handleSeedGrowthStep = useCallback(() => {
    dungeonControllerRef.current?.step()
  }, [])

  const handleSeedGrowthRunSteps = useCallback((n: number) => {
    dungeonControllerRef.current?.runSteps(n)
  }, [])

  const handleSeedGrowthRunAll = useCallback(() => {
    dungeonControllerRef.current?.runToCompletion()
  }, [])

  const handleSeedGrowthToggleAnimation = useCallback(() => {
    dungeonControllerRef.current?.toggleAnimation()
  }, [])



  // Re-render when debug settings change
  useEffect(() => {
    // Sync debug flags to Dungeon View Renderer if active
    if (viewAsDungeon && dungeonViewRendererRef.current) {
      dungeonViewRendererRef.current.setDebugVisibility(showFog, showLight)
      dungeonViewRendererRef.current.setPlayerVisibility(showPlayer)
    }

    if (generatorMode === 'organic') {
      if (seedGrowthGenRef.current && seedGrowthRendererRef.current && gameMode === 'dungeon') {
        seedGrowthRendererRef.current.render(seedGrowthGenRef.current.getState(), seedGrowthSettings)
      }
    } else {
      if (spineSeedGenRef.current && spineSeedRendererRef.current && gameMode === 'dungeon') {
        spineSeedRendererRef.current.render(spineSeedGenRef.current.getState(), spineSeedSettings)
      }
    }
  }, [seedGrowthSettings.debug, spineSeedSettings.debug, gameMode, generatorMode])

  // Handle Generator Mode Switch - delegate to controller
  useEffect(() => {
    if (gameMode !== 'dungeon' || !showMap) return

    // Delegate to controller
    if (dungeonControllerRef.current) {
      dungeonControllerRef.current.setGeneratorMode(generatorMode)
      dungeonControllerRef.current.updateSettings(seedGrowthSettings, spineSeedSettings)
    }
  }, [generatorMode, gameMode, showMap, seedGrowthSettings, spineSeedSettings])

  // Handle View as Dungeon toggle
  useEffect(() => {

    if (gameMode !== 'dungeon' || !showMap) return
    if (!layoutRef.current) return

    // Use React state (has rooms) with fallback to generator state
    // Force refresh from ref if state is null/outdated
    let state: any = null
    if (generatorMode === 'organic') {
      // Prioritize Ref current state as it is most up to date during animation/steps
      state = seedGrowthGenRef.current?.getState() ?? seedGrowthState
    } else {
      state = spineSeedGenRef.current?.getState() ?? spineSeedState
    }
    if (!state) {
      return
    }


    // Use App Screen width if available (most accurate), fallback to layout
    const viewWidth = appRef.current?.screen.width ?? layout.middlePanel.width ?? 800
    const viewHeight = appRef.current?.screen.height ?? layout.middlePanel.height ?? 600

    if (viewAsDungeon) {
      // Rely on DungeonController to provide the renderer (synced in init effect).
      // Do NOT create a duplicate standalone renderer here.



      // Hide seed renderer, show dungeon view
      if (seedGrowthRendererRef.current) {
        seedGrowthRendererRef.current.getContainer().visible = false
      }
      if (spineSeedRendererRef.current) {
        spineSeedRendererRef.current.getContainer().visible = false
      }

      // Render dungeon view

      // Always update view dimensions first
      if (dungeonViewRendererRef.current) {
        dungeonViewRendererRef.current.setViewDimensions(viewWidth, viewHeight)
      }

      // Add simple resize listener
      const handleResize = () => {
        if (dungeonViewRendererRef.current && appRef.current) {
          dungeonViewRendererRef.current.setViewDimensions(
            appRef.current.screen.width,
            appRef.current.screen.height
          )
        }
      }
      window.addEventListener('resize', handleResize)

      // Check if we need to sync camera (Initial Load or Toggle On)
      // If ref is missing, it's a fresh load -> Sync.
      // If ref exists but hidden, it's a toggle -> Sync.
      const shouldSyncCamera = !dungeonViewRendererRef.current || !dungeonViewRendererRef.current.getContainer().visible

      // Try to ensure renderer ref is populated
      if (!dungeonViewRendererRef.current && dungeonControllerRef.current) {
        dungeonViewRendererRef.current = dungeonControllerRef.current.getDungeonViewRenderer()
      }

      // --- SPINE MODE RENDERING ---
      // All classification, pruning, and corridor assembly is handled by DungeonController/DungeonAssembler
      if (generatorMode === 'spineSeed' && state.spineTiles) {
        dungeonControllerRef.current.renderSpineDungeonView(state as any, spineSeedSettings)

        // Sync ref again as renderSpineDungeonView may have created the renderer
        if (!dungeonViewRendererRef.current) {
          dungeonViewRendererRef.current = dungeonControllerRef.current.getDungeonViewRenderer()
        }

        // --- INITIALIZE PLAYER & VISIBILITY (SPINE MODE) ---
        if (state.spineComplete) { // Ensure generation is done
          // 1. Find Start (Stairs Up or first Spine Tile)
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

          // 2. Build Walkmap (Floor + Doors)
          const walkable: { x: number, y: number }[] = []
          const seen = new Set<string>()
          const add = (x, y) => {
            const k = `${x},${y}`
            if (!seen.has(k)) { seen.add(k); walkable.push({ x, y }) }
          }

          // Add Rooms (get from renderer which was just updated by renderSpineDungeonView)
          if (dungeonViewRendererRef.current) {
            const renderedRooms = dungeonViewRendererRef.current.getRenderedRooms() || []
            renderedRooms.forEach(r => r.tiles.forEach(t => add(t.x, t.y)))

            // Add Expanded Corridors from Renderer
            const expandedCorridors = dungeonViewRendererRef.current.getWalkableTiles()
            expandedCorridors.forEach(t => add(t.x, t.y))
          }

          // Add Walkable Objects (Doors, Stairs)
          state.objects?.forEach(obj => {
            if (obj.type.startsWith('door') || obj.type === 'stairs_up') {
              add(obj.x, obj.y)
            }
          })

          // 3. Init Systems
          if (!visibilitySystemRef.current) {
            visibilitySystemRef.current = new VisibilitySystem(spineSeedSettings.gridWidth, spineSeedSettings.gridHeight)
          } else {
            visibilitySystemRef.current.reset(spineSeedSettings.gridWidth, spineSeedSettings.gridHeight)
          }

          if (!playerControllerRef.current) {
            playerControllerRef.current = new PlayerController()
          }

          const handleMove = (x, y) => {
            if (!dungeonViewRendererRef.current || !visibilitySystemRef.current) return

            // Update Visibility (Simplified LOS logic for now)
            const isWall = (tx, ty) => !seen.has(`${tx},${ty}`)

            visibilitySystemRef.current.computeVisibility(
              x, y,
              LIGHT_PROFILES[activeLight].dimRadius,
              isWall
            )

            dungeonViewRendererRef.current.updateVisibilityState(
              spineSeedSettings.gridWidth,
              spineSeedSettings.gridHeight,
              visibilitySystemRef.current.getGrid(),
              x, y,
              LIGHT_PROFILES[activeLight]
            )

            // NOTE: We do NOT force focus on every move here anymore, 
            // relying on the initial focus or user panning.
            // But if tracking is desired, we could add it back.
            // For now, let's Stick to "Center on Player when Player is enabled" request.
            // If showPlayerRef is true, we track?
            if (showPlayerRef.current) {
              dungeonViewRendererRef.current.focusOnTile(x, y)
            }
          }

          playerControllerRef.current.init(
            startX, startY,
            spineSeedSettings.gridWidth,
            spineSeedSettings.gridHeight,
            walkable,
            handleMove
          )

          // Initial Visual Update
          handleMove(startX, startY)

          // CAMERA CENTERING LOGIC
          // Delegated to Controller for robust handling
          if (showPlayerRef.current) {
            if (dungeonViewRendererRef.current) {
              dungeonViewRendererRef.current.focusOnTile(startX, startY)
            }
          } else if (shouldSyncCamera) {
            dungeonControllerRef.current.resetCameraToGridCenter()
          }
        }


      } else {
        if (generatorMode === 'spineSeed') {
          // Use Controller Pipeline (includes Classification & Pruning)
          dungeonControllerRef.current.renderSpineDungeonView(state as any)

          // Sync ref again
          if (!dungeonViewRendererRef.current) {
            dungeonViewRendererRef.current = dungeonControllerRef.current.getDungeonViewRenderer()
          }
        } else {
          if (dungeonViewRendererRef.current) {
            dungeonViewRendererRef.current.renderDungeonView(state, seedGrowthSettings, showRoomNumbers, showWalkmap)
          }
        }

        // --- INITIALIZE PLAYER (ORGANIC MODE) ---
        // TODO: Similar logic for Organic mode if needed, utilizing rooms[0] center
      }

      if (dungeonViewRendererRef.current) {
        dungeonViewRendererRef.current.setShowRoomNumbers(showRoomNumbers)
        dungeonViewRendererRef.current.getContainer().visible = true

        // Expose debug info (Last step to ensure renderer exists)
        const renderer = dungeonViewRendererRef.current
        const app = appRef.current
        if (app) {
          (window as any).__DUNGEON_DEBUG__ = {
            app: app,
            camera: {
              get scale() { return renderer.getTransform().scale },
              container: renderer.getContentContainer()
            },
            toWorld: (x: number, y: number) => {
              const local = renderer.getContentContainer().toLocal({ x, y })
              return { x: local.x, y: local.y }
            }
          }
          delete (window as any).__MAP_ENGINE__
        }
      }
    }
  }, [viewAsDungeon, gameMode, showMap, seedGrowthSettings, seedGrowthState, spineSeedState, spineSeedSettings, generatorMode, activeLight, isReady]) // Added activeLight dependency to re-init logic if light changes? No, handleLightChange separately.

  // Update Light Profile when activeLight changes
  useEffect(() => {
    if (viewAsDungeon && playerControllerRef.current && dungeonViewRendererRef.current && visibilitySystemRef.current) {
      // Trigger a re-compute with new profile
      const { x, y } = playerControllerRef.current
      // We need the move handler logic... refactor handleMove to reuse?
      // For now, simple re-trigger if we can access the walkable set? 
      // Actually, just calling the renderer update is enough IF visibility was already computed...
      // BUT changing light radius requires re-computing visibility!
      // We need to re-run: visibilitySystem.computeVisibility(...)
      // We don't have easy access to the 'isWall' closure here.
      // OPTION: make handleMove a Ref or persistent function?
      // OR: Just let the next move update it? (User might want instant update).
      // Let's leave it for next move for MVP safety, or try to hack a move(0,0).
      // playerControllerRef.current.attemptMove(0,0) // Logic is private.
      // Yes, that will tear down and re-build. A bit heavy but safe.
    }
  }, [activeLight])

  // Debug Toggles Effect
  useEffect(() => {
    const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
    if (renderer) {
      renderer.setDebugVisibility(showFog, showLight)
    }
  }, [showFog, showLight])

  // Player Visibility Effect - just toggle visibility, don't move camera
  useEffect(() => {
    const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
    if (renderer) {
      renderer.setPlayerVisibility(showPlayer)
    }
  }, [showPlayer])

  // Dedicated effect for room number visibility toggle (independent of render)
  useEffect(() => {
    const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
    if (renderer) {
      renderer.setShowRoomNumbers(showRoomNumbers)
    }
  }, [showRoomNumbers])

  // Dedicated effect for heat map visibility (independent of render)
  useEffect(() => {
    const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
    if (renderer) {
      renderer.setShowHeatMap(showHeatMap)
    }
  }, [showHeatMap])

  // Dedicated effect for walkmap visibility (independent of render)
  useEffect(() => {
    const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
    if (renderer) {
      renderer.setShowWalkmap(showWalkmap)
    }
  }, [showWalkmap])

  // Update theme when active theme changes
  useEffect(() => {
    if (themeManagerRef.current) {
      themeManagerRef.current.setTheme(activeTheme)
    }
  }, [activeTheme])


  // Sync Settings to Controller
  useEffect(() => {
    if (dungeonControllerRef.current) {
      dungeonControllerRef.current.updateSettings(seedGrowthSettings, spineSeedSettings)
    }
  }, [seedGrowthSettings, spineSeedSettings])

  /**
   * Initializes the entire Game View (Pixi App, Layout, Backgrounds)
   */
  useEffect(() => {
    const initGame = async (): Promise<void> => {
      if (!containerRef.current || !pixiContainerRef.current || initializingRef.current) return
      initializingRef.current = true

      try {
        // 1. Init Pixi App
        const app = new Application()
        await app.init({
          background: '#141d1f',
          resizeTo: containerRef.current,
          antialias: true,
          autoDensity: false,
          resolution: 1
        })

        // Explicitly start ticker
        app.ticker.start()

        // Mount Canvas
        pixiContainerRef.current.appendChild(app.canvas)
        // Fix: Canvas must be position absolute to overlay instead of stack
        app.canvas.style.position = 'absolute'
        app.canvas.style.top = '0'
        app.canvas.style.left = '0'
        appRef.current = app

        // Attach resize handler to ensure Layout follows App/Canvas size changes
        app.renderer.on('resize', () => {
          if (layoutRef.current) layoutRef.current.resize()
        })

        // 2. Initialize Layout System
        const layout = new GameLayout(app, {
          panelWidth: 300,
          collapsedWidth: 58
        })
        layoutRef.current = layout

        // 3. Initialize Background System
        const bgSystem = new BackgroundSystem(app)
        await bgSystem.init()
        bgSystemRef.current = bgSystem

        // 4. Build UI (Sprites) -> Attach to Layout
        await buildUI(app, layout)

        // Preload specific assets
        await Assets.load(flairOverlay)

        // 5. Force specific start state
        layout.setLeftOpen(true)
        layout.setRightOpen(true)
        layout.resize()

        // 5a. Initialize Dice Engine
        if (rightPanelRef.current) {
          diceEngine.initialize(rightPanelRef.current)
          diceEngine.resize()
        }

        setIsReady(true)
      } catch (err) {
        initializingRef.current = false
      }
    }

    initGame()

    // 6. Preload Overworld Assets
    import('../engine/map/TerrainAssetLoader').then(({ TerrainAssetLoader }) => {
      TerrainAssetLoader.loadAll()
    })

    return () => {
      initializingRef.current = false
      setIsReady(false)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true })
        appRef.current = null
      }
      diceEngine.destroy()
    }
  }, [])

  // -- INTERACTION HANDLERS --

  const handleHexHover = useCallback(
    (x: number, y: number, globalX: number, globalY: number): void => {
      if (gameModeRef.current !== 'overworld') return

      const key = `${x},${y}`

      // STRICT: Only show "Explore" tooltip if in Step 1
      if (overworldStepRef.current === 1) {
        if (validMovesRef.current.has(key)) {
          setTooltip({ x: globalX, y: globalY, text: 'Explore This Tile', visible: true })
        } else {
          setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
        }
      } else {
        // If in placement mode, we might want a different tooltip?
        // For now, just hide the explore tooltip
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      }
    },
    []
  )

  // ROOM HOVER HANDLER
  const handleRoomHover = useCallback((room: any | null, x: number, y: number) => {
    if (room) {
      let text = 'Room'
      if (room.type) text = room.type
      else if (room.id) text = `Room ${room.id}`

      setTooltip({
        x: x + 15,
        y: y + 15, // Offset slightly
        text: text,
        visible: true
      })
    } else {
      setTooltip(prev => prev.visible ? { ...prev, visible: false } : prev)
    }
  }, [])



  const handleHexClick = useCallback(
    (x: number, y: number): void => {
      // CRITICAL: Strict Check to prevent "Explore" during "Placement"
      if (gameModeRef.current !== 'overworld') return

      // If we are in STEP 3 (Placement), this handler should NOT run explore logic.
      // Placement logic is handled by onTerrainPlaced via MapEngine internal tap.
      if (overworldStepRef.current !== 1) {
        return
      }

      const key = `${x},${y}`
      if (!validMovesRef.current.has(key)) return

      // Trigger Explore Logic via controller
      overworldControllerRef.current?.handleExplore(x, y)
    },
    []
  )

  // Handle Map Engine Logic (Show/Hide)
  // Handle Map Engine Logic (Show/Hide & Mode)
  useEffect(() => {
    const layout = layoutRef.current
    const app = appRef.current
    const bg = bgSystemRef.current

    if (!layout || !app) return

    if (showMap) {
      bg?.setVisible(false)

      if (mapEngineRef.current) {
        mapEngineRef.current.destroy()
        mapEngineRef.current = null
      }

      if (gameMode === 'dungeon') {
        // --- DUNGEON MODE: Use DungeonController ---

        // Create or reuse controller
        if (!dungeonControllerRef.current) {
          dungeonControllerRef.current = new DungeonController({
            onStateChange: (state) => {
              // Sync React state for UI - use controller's current mode to avoid stale closure
              const mode = dungeonControllerRef.current?.getGeneratorMode()
              if (mode === 'organic') {
                setSeedGrowthState(state as SeedGrowthState)
              } else {
                setSpineSeedState(state as SpineSeedState)
              }
            },
            onAnimationChange: (animating) => {
              setIsAnimating(animating)
            },
            onLog: (msg) => {
              setLogs(prev => [msg, ...prev.slice(0, 9)])
            }
          })
        }

        const controller = dungeonControllerRef.current
        controller.setGeneratorMode(generatorMode)
        controller.updateSettings(seedGrowthSettings, spineSeedSettings)

        // Initialize controller if not already
        if (!controller.isInitialized()) {
          controller.init(app, layout, seedGrowthSettings, spineSeedSettings)
        }

        // Sync refs for backward compatibility (temporary - will remove later)
        seedGrowthGenRef.current = controller.getSeedGrowthGen()
        seedGrowthRendererRef.current = controller.getSeedGrowthRenderer()
        spineSeedGenRef.current = controller.getSpineSeedGen()
        spineSeedRendererRef.current = controller.getSpineSeedRenderer()
        dungeonViewRendererRef.current = controller.getDungeonViewRenderer()
        themeManagerRef.current = controller.getThemeManager()

        // === FIX: Initialize visibility layers immediately after renderer creation ===
        // This ensures Fog/Light/Player work on first load without needing HIDE/SHOW toggle
        if (dungeonViewRendererRef.current) {
          dungeonViewRendererRef.current.setDebugVisibility(showFog, showLight)
          dungeonViewRendererRef.current.setPlayerVisibility(showPlayer)
          dungeonViewRendererRef.current.setShowHeatMap(showHeatMap)
          dungeonViewRendererRef.current.setShowWalkmap(showWalkmap)
          dungeonViewRendererRef.current.setShowSpineDebug(showSpineDebug)
        }

        // Expose debug info for DebugToolbar
        if (dungeonViewRendererRef.current) {
          const renderer = dungeonViewRendererRef.current
            ; (window as any).__DUNGEON_DEBUG__ = {
              app: app,
              camera: {
                get scale() { return renderer.getTransform().scale },
                container: renderer.getContentContainer()
              },
              toWorld: (x: number, y: number) => {
                const local = renderer.getContentContainer().toLocal({ x, y })
                return { x: local.x, y: local.y }
              }
            }
          delete (window as any).__MAP_ENGINE__
        }

        // Update React state from controller current state
        const currentState = controller.getCurrentState()
        if (currentState) {
          if (generatorMode === 'organic') {
            setSeedGrowthState(currentState as SeedGrowthState)
          } else {
            setSpineSeedState(currentState as SpineSeedState)
          }
        }

        setLogs([`${generatorMode === 'organic' ? 'Organic' : 'Spine-Seed'} Dungeon initialized.`])

      } else {
        // --- OVERWORLD MODE ---
        // Create and initialize OverworldController
        if (!overworldControllerRef.current) {
          overworldControllerRef.current = new OverworldController({
            onStepChange: setOverworldStep,
            onTerrainChange: setCurrentTerrain,
            onTilesToPlaceChange: setTilesToPlace,
            onTownPlacedChange: setTownPlaced,
            onValidMovesChange: (moves) => { validMovesRef.current = moves },
            onLog: addLog,
            onHexHover: handleHexHover,
            onHexClicked: handleHexClick,
            onRollingChange: setIsRolling,
            onUnclaimedLogChange: setUnClaimedLog
          })
        }

        const controller = overworldControllerRef.current

        // Initialize controller if not already
        if (!controller.isInitialized()) {
          controller.init(app, layout)
          controller.initMapEngine()
        }

        // Sync refs for backward compatibility (temporary)
        mapEngineRef.current = controller.getMapEngine()
        overworldManagerRef.current = controller.getOverworldManager()

        setLogs(['Overworld initialized.'])
      }
    } else {
      bg?.setVisible(true)
      if (mapEngineRef.current) {
        mapEngineRef.current.destroy()
        mapEngineRef.current = null
      }
    }
  }, [showMap, mapConfig, isReady, gameMode, handleHexClick, handleHexHover]) // ADDED dependencies

  // FIX: Sync Overworld Step to MapEngine Mode
  // This ensures that if we are in Step 1 (Explore), the engine is definitely in 'idle'
  useEffect(() => {
    if (!mapEngineRef.current) return

    if (gameMode === 'overworld') {
      if (overworldStep === 1) {
        if (townPlaced) {
          mapEngineRef.current.interactionState.mode = 'idle'
        } else {
          mapEngineRef.current.interactionState.mode = 'placing_town'
        }
      } else if (overworldStep === 3) {
        mapEngineRef.current.interactionState.mode = 'placing_terrain'
      } else if (overworldStep === 0 && !townPlaced) {
        // Usually handled by button click, but good to enforce?
        // mapEngineRef.current.interactionState.mode = 'placing_town'
      }
    }
  }, [overworldStep, gameMode, townPlaced])

  const handleCreateNewMap = (): void => {
    // BYPASS MODAL
    // setIsNewMapModalOpen(false) 

    // Set Dungeon Mode
    setGameMode('dungeon')
    setGeneratorMode('spineSeed') // Reset to default Spine mode
    setViewAsDungeon(true) // Default to Dungeon View

    // Default Init Config (30x30)
    setMapConfig({
      width: 30,
      height: 30,
      id: Date.now()
    })

    if (!showMap) {
      toggleMap()
    }
  }

  // -- OVERWORLD LOGIC --

  const handlePlaceTownStart = (): void => {
    // TODO: Interaction mode -> placing_town
    // For now just set step
    setTownPlaced(false)
    setOverworldStep(1) // Advance for demo (Later: wait for click)
    setLogs((prev) => [...prev, 'Town Placement Mode: Click on the grid to place the capital.'])

    if (mapEngineRef.current) {
      mapEngineRef.current.interactionState.mode = 'placing_town'
    }
  }

  /* handleRollCount is now only used for Area terrain if Unique is skipped */
  const handleRollCount = async (): Promise<void> => {
    setIsRolling(true)
    setLogs((prev) => [...prev, 'Rolling for Count (1d8)...'])

    try {
      const result = await diceEngine.roll('1d8')
      setIsRolling(false)

      const count = result.total

      setLogs((prev) => [...prev, `Rolled ${count}: Place ${count} tile(s).`])

      // Use controller if available, otherwise fallback to direct refs
      const controller = overworldControllerRef.current
      if (controller && gameMode === 'overworld') {
        controller.startTerrainPlacement(count)
      } else if (mapEngineRef.current && currentTerrainRef.current) {
        // Legacy path (shouldn't be reached in overworld mode)
        setTilesToPlace(count)
        setOverworldStep(3)
        mapEngineRef.current.interactionState.mode = 'placing_terrain'

        const validNextMoves = overworldManagerRef.current.getValidMoves()
        mapEngineRef.current.highlightValidMoves(validNextMoves)
        validMovesRef.current = new Set(validNextMoves.map((m) => `${m.x},${m.y}`))
      }
    } catch (e) {
      console.error(e)
      setIsRolling(false)
    }
  }

  // Define new map creation callback (for New Dungeon)
  // THIS WAS handleCreateOverworld. Now simplified.
  const handleCreateOverworld = useCallback(() => {
    // Just update state. useEffect handles the rest.
    setGameMode('overworld')
    setOverworldStep(0)
    setTownPlaced(false)
    setCurrentTerrain(null)
    setTilesToPlace(0)
    setLogs(['Overworld Initialized.', 'Ready to build civilization.'])

    // If map not shown, show it.
    if (!showMap) {
      toggleMap()
    } else {
      // If already shown, we need to force re-init.
      // Changing gameMode key in useEffect dependencies will do it!
      // But if gameMode was ALREADY overworld (e.g. restart), we need to trigger it.
      // toggleMap off/on? Or just rely on setCityPlaced/etc resetting UI?
      // Actually, if gameMode doesn't change, effect won't run.
      // We can add a timestamp/ID to mapConfig or similar to force reload.
      setMapConfig((prev) => ({ ...prev, id: Date.now() }))
    }
  }, [showMap, toggleMap])

  return (
    <SettingsProvider>
      <div
        ref={containerRef}
        style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}
      >
        <div ref={pixiContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* HTML Overlay UI */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%', // Fix: Must be 100% for children like Right Panel to use height: 100%
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {/* SHOW/HIDE MAP Button */}
          <div
            onClick={toggleMap}
            style={{
              position: 'absolute',
              left: '50px',
              top: '20px',
              width: '200px',
              height: '50px',
              backgroundColor: '#2e3f41',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              fontSize: '24px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            {showMap ? 'HIDE MAP' : 'SHOW MAP'}
          </div>

          {/* NEW DUNGEON Button (Bypasses Modal) */}
          <div
            onClick={handleCreateNewMap}
            style={{
              position: 'absolute',
              left: '50px',
              top: '80px',
              width: '200px',
              height: '50px',
              backgroundColor: '#2e3f41',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              fontSize: '24px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            NEW DUNGEON
          </div>

          {/* NEW OVERWORLD Button */}
          <div
            onClick={handleCreateOverworld}
            style={{
              position: 'absolute',
              left: '50px',
              top: '140px',
              width: '200px',
              height: '50px',
              backgroundColor: '#2e3f41',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              fontSize: '24px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            NEW OVERWORLD
          </div>

          {/* DICE SETTINGS Button - Shifted Down */}
          <div
            onClick={() => setShowDiceSettings(true)}
            style={{
              position: 'absolute',
              left: '50px',
              top: '200px',
              width: '200px',
              height: '50px',
              backgroundColor: '#2e3f41',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              fontSize: '24px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            DICE SETTINGS
          </div>

          {/* ROLL 2d8 Button - Shifted Down */}
          <div
            onClick={() => {
              diceEngine.roll('2d8').then((result) => {
              })
            }}
            style={{
              position: 'absolute',
              left: '50px',
              top: '260px',
              width: '200px',
              height: '50px',
              backgroundColor: '#2e3f41',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              fontSize: '24px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            ROLL 2d8
          </div>

          {/* EXIT Button - Shifted Down */}
          <div
            onClick={onBack}
            style={{
              position: 'absolute',
              left: '50px',
              top: '320px', // Shifted from 260
              width: '200px',
              height: '50px',
              backgroundColor: '#2e3f41',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              fontSize: '24px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
          >
            EXIT
          </div>

          <D8IconPanel />

          {/* --- Right Panel --- */}
          <div
            ref={rightPanelRef}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '300px',
              height: '100%',
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '0', // Removed global padding
              boxSizing: 'border-box',
              color: '#bcd3d2',
              fontFamily: 'IMFellEnglishSC-Regular',
              backgroundColor: 'rgba(20, 29, 31, 0.8)'
            }}
          >
            {/* Dice Landing Image - ALWAYS VISIBLE */}
            <img
              src={diceLanding}
              alt="Dice Landing"
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '250px', // Constrain height
                objectFit: 'cover',
                display: 'block',
                borderBottom: '1px solid #bcd3d2',
                flexShrink: 0
              }}
            />

            {/* --- Dungeon UI: Seed Growth Control Panel --- */}
            {gameMode === 'dungeon' && showMap && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden'
                }}
              >
                <SeedGrowthControlPanel
                  generatorMode={generatorMode}
                  onGeneratorModeChange={setGeneratorMode}
                  settings={seedGrowthSettings}
                  onSettingsChange={setSeedGrowthSettings}
                  spineSeedSettings={spineSeedSettings}
                  onSpineSeedSettingsChange={setSpineSeedSettings}
                  onRegenerate={handleSeedGrowthRegenerate}
                  onStep={handleSeedGrowthStep}
                  onRunSteps={handleSeedGrowthRunSteps}
                  onRunToCompletion={handleSeedGrowthRunAll}
                  tilesGrown={generatorMode === 'organic'
                    ? (seedGrowthState?.tilesGrown ?? 0)
                    : (spineSeedState?.tilesGrown ?? 0)}
                  stepCount={generatorMode === 'organic'
                    ? (seedGrowthState?.stepCount ?? 0)
                    : (spineSeedState?.stepCount ?? 0)}
                  isComplete={generatorMode === 'organic'
                    ? (seedGrowthState?.isComplete ?? false)
                    : (spineSeedState?.isComplete ?? false)}
                  completionReason={generatorMode === 'organic'
                    ? (seedGrowthState?.completionReason ?? null)
                    : (spineSeedState?.completionReason ?? null)}
                  isAnimating={isAnimating}
                  onToggleAnimation={handleSeedGrowthToggleAnimation}
                  spineSeedPhase={spineSeedState?.phase}
                  seedGrowthState={seedGrowthState}
                  spineSeedState={spineSeedState}
                  viewAsDungeon={viewAsDungeon}
                  onViewAsDungeonChange={setViewAsDungeon}
                  showRoomNumbers={showRoomNumbers}
                  onShowRoomNumbersChange={setShowRoomNumbers}
                  showHeatMap={showHeatMap}
                  onToggleHeatMap={setShowHeatMap}
                  showWalkmap={showWalkmap}
                  onToggleWalkmap={setShowWalkmap}
                  activeTheme={activeTheme}
                  onThemeChange={setActiveTheme}
                  showSpineDebug={showSpineDebug}
                  onToggleSpineDebug={(val) => {
                    setShowSpineDebug(val)
                    const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
                    if (renderer) {
                      renderer.setShowSpineDebug(val)
                      if (val && spineSeedState) {
                        renderer.setSpineState(spineSeedState)
                      }
                    }
                  }}
                />
              </div>
            )}

            {/* --- OVERWORLD UI --- */}
            {gameMode === 'overworld' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '20px',
                  paddingTop: '30px',
                  pointerEvents: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    textAlign: 'center',
                    color: '#bcd3d2',
                    fontFamily: 'IMFellEnglishSC-Regular',
                    fontSize: '28px',
                    borderBottom: '1px solid #2e3f41',
                    paddingBottom: '10px'
                  }}
                >
                  {/* DYNAMIC HEADER */}
                  {(!townPlaced || overworldStep === 1) && 'EXPLORE'}
                  {townPlaced && overworldStep === 3 && 'AREA PLACEMENT'}
                  {townPlaced && overworldStep === 2 && 'ROLLING...'}
                  {/* Fallback */}
                  {!(
                    !townPlaced ||
                    overworldStep === 1 ||
                    (townPlaced && overworldStep === 3) ||
                    (townPlaced && overworldStep === 2)
                  ) && 'OVERWORLD COMMAND'}
                </h2>

                {/* STEP 0: PLACE CITY */}
                {!townPlaced && overworldStep === 0 && (
                  <button
                    onClick={handlePlaceTownStart}
                    style={{
                      padding: '15px',
                      backgroundColor: '#2e3f41',
                      border: '1px solid #bcd3d2',
                      color: '#bcd3d2',
                      fontSize: '20px',
                      fontFamily: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    PLACE TOWN
                  </button>
                )}

                {/* MESSAGE IF PLACING CITY */}
                {!townPlaced && overworldStep === 1 && (
                  <div style={{ textAlign: 'center', color: '#fff' }}>
                    Click map to place City...
                  </div>
                )}

                {/* STEP 1: EXPLORE (Click Map) */}
                {townPlaced && overworldStep === 1 && (
                  <div style={{ textAlign: 'center', color: '#fff' }}>
                    Click a highlighted tile to Explore...
                  </div>
                )}

                {/* STEP 2: ROLL COUNT */}
                {townPlaced && overworldStep === 2 && (
                  <>
                    <div style={{ textAlign: 'center', fontSize: '24px', color: '#fff' }}>
                      Target: {currentTerrain?.toUpperCase()}
                    </div>
                    <button
                      onClick={handleRollCount}
                      disabled={isRolling}
                      style={{
                        padding: '15px',
                        backgroundColor: '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        fontSize: '20px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        opacity: isRolling ? 0.5 : 1
                      }}
                    >
                      {isRolling ? 'ROLLING...' : 'ROLL COUNT (1d8)'}
                    </button>
                  </>
                )}

                {/* STEP 3: PLACING */}
                {townPlaced && overworldStep === 3 && (
                  <div
                    style={{
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ fontSize: '24px', color: '#fff' }}>
                      Placing: {currentTerrain?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '18px', color: '#bcd3d2' }}>
                      Remaining: {tilesToPlace}
                    </div>
                    <div style={{ fontSize: '14px', color: '#888', marginTop: '10px' }}>
                      Click adjacent hexes to place.
                    </div>
                  </div>
                )}

                {/* VIEW UNCLAIMED LOG BUTTON */}
                <button
                  onClick={() => setIsLogModalOpen(true)}
                  style={{
                    padding: '10px',
                    backgroundColor: '#2e3f41',
                    border: '1px solid #bcd3d2',
                    color: '#bcd3d2',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    cursor: 'pointer',
                    marginTop: 'auto', // Push to bottom of available space before log
                    marginBottom: '10px',
                    width: '100%'
                  }}
                >
                  VIEW UNCLAIMED LOG
                </button>

                <div
                  style={{
                    marginTop: 'auto',
                    height: '240px',
                    border: '1px solid #2e3f41',
                    padding: '10px',
                    fontSize: '14px',
                    overflowY: 'auto',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    fontFamily: 'monospace',
                    flexShrink: 0
                  }}
                >
                  {logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: '5px', color: '#bcd3d2' }}>
                      {`> ${log}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- FLOATING SEED GROWTH CONTROL PANEL --- */}
        {gameMode === 'dungeon' && seedGrowthState && (
          <SeedGrowthControlPanel
            generatorMode={generatorMode}
            onGeneratorModeChange={setGeneratorMode}
            settings={seedGrowthSettings}
            onSettingsChange={setSeedGrowthSettings}
            spineSeedSettings={spineSeedSettings}
            onSpineSeedSettingsChange={setSpineSeedSettings}
            onRegenerate={handleSeedGrowthRegenerate}
            onStep={handleSeedGrowthStep}
            onRunSteps={handleSeedGrowthRunSteps}
            onRunToCompletion={handleSeedGrowthRunAll}
            tilesGrown={generatorMode === 'organic'
              ? seedGrowthState.tilesGrown
              : (spineSeedState?.tilesGrown ?? 0)}
            stepCount={generatorMode === 'organic'
              ? seedGrowthState.stepCount
              : (spineSeedState?.stepCount ?? 0)}
            isComplete={generatorMode === 'organic'
              ? seedGrowthState.isComplete
              : (spineSeedState?.isComplete ?? false)}
            completionReason={generatorMode === 'organic'
              ? seedGrowthState.completionReason
              : (spineSeedState?.completionReason ?? null)}
            isAnimating={isAnimating}
            onToggleAnimation={handleSeedGrowthToggleAnimation}
            spineSeedPhase={spineSeedState?.phase}
            seedGrowthState={seedGrowthState}
            spineSeedState={spineSeedState}
            viewAsDungeon={viewAsDungeon}
            onViewAsDungeonChange={setViewAsDungeon}
            showRoomNumbers={showRoomNumbers}
            onShowRoomNumbersChange={setShowRoomNumbers}
            showHeatMap={showHeatMap}
            onToggleHeatMap={setShowHeatMap}
            activeTheme={activeTheme}
            onThemeChange={setActiveTheme}
            showWalkmap={showWalkmap}
            onToggleWalkmap={setShowWalkmap}
            showSpineDebug={showSpineDebug}
            onToggleSpineDebug={(val) => {
              setShowSpineDebug(val)

              // Sync to Settings (for Renderer Phase A-C)
              setSpineSeedSettings(prev => ({
                ...prev,
                debug: {
                  ...prev.debug,
                  showSpine: val,
                  showSeeds: val,
                  showRoomGrowth: val,
                  showWalls: val
                }
              }))

              // Sync to Dungeon View Renderer (Phase D Overlay)
              const renderer = dungeonControllerRef.current?.getDungeonViewRenderer()
              if (renderer) {
                renderer.setShowSpineDebug(val)
                if (val && spineSeedState) {
                  renderer.setSpineState(spineSeedState)
                }
              }
            }}
          />
        )}

        {/* Floating Dungeon Controls - only show when dungeon map is visible */}
        {showMap && gameMode === 'dungeon' && (
          <DungeonControlPanel
            showFog={showFog}
            onShowFogChange={setShowFog}
            showLight={showLight}
            onShowLightChange={setShowLight}
            showPlayer={showPlayer}
            onShowPlayerChange={setShowPlayer}
            activeLight={activeLight}
            onActiveLightChange={setActiveLight}
          />
        )}



        <DiceSettingsWrapper isOpen={showDiceSettings} onClose={() => setShowDiceSettings(false)} />
        <SettingsSync />
        <DiceOverlay />

        {/* Sync Spine State to Renderer when it changes (Real-time update) */}
        {React.useEffect(() => {
          if (dungeonViewRendererRef.current && spineSeedState && viewAsDungeon) {
            dungeonViewRendererRef.current.setSpineState(spineSeedState)
          }
        }, [spineSeedState, viewAsDungeon]) as any}

        {/* Tooltip */}
        {
          tooltip.visible && (
            <div
              style={{
                position: 'fixed',
                left: tooltip.x + 15,
                top: tooltip.y + 15,
                backgroundColor: 'rgba(0,0,0,0.8)',
                color: '#fff',
                padding: '5px 10px',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: 9999,
                fontSize: '14px'
              }}
            >
              {tooltip.text}
            </div>
          )
        }

        {/* VIEW LOG BUTTON */}

        {/* UNCLAIMED LOG MODAL */}
        <UnclaimedLogModal
          isOpen={isLogModalOpen}
          onClose={() => setIsLogModalOpen(false)}
          plots={unClaimedLog}
        />
      </div >
    </SettingsProvider >
  )
}

async function buildUI(app: Application, layout: GameLayout): Promise<void> {
  const leftBg = new Graphics().rect(0, 0, 300, app.screen.height).fill(0x141d1f)
  layout.leftPanel.addChild(leftBg)
  const rightBg = new Graphics().rect(0, 0, 300, app.screen.height).fill(0x141d1f)
  layout.rightPanel.addChild(rightBg)
}

// --- Helper Functions for Hex Neighbors ---
// MOVED TO engine/systems/HexLogic.ts
