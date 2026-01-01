import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Application, Graphics, Sprite, Assets } from 'pixi.js'
import { TerrainAssetLoader } from '../engine/map/TerrainAssetLoader'
import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { MapEngine } from '../engine/MapEngine'
import { HexLogic } from '../engine/systems/HexLogic'
import { OverworldManager } from '../engine/managers/OverworldManager'
import { ThemeManager } from '../engine/managers/ThemeManager'
import { GameLayout } from '../engine/ui/GameLayout'
import { BackgroundSystem } from '../engine/ui/BackgroundSystem'
import { TableEngine } from '../engine/tables/TableEngine'
import { GameOrchestrator } from '../engine/game/GameOrchestrator'
import { DungeonController, OverworldController } from '../engine/game/controllers'
import landTable from '../data/tables/land-table.json'

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
  SeedGrowthRenderer,
  DungeonViewRenderer,
  RoomClassifier,
  CorridorPathfinder,
  SeedGrowthSettings,
  SeedGrowthState,
  createDefaultSettings,
  MaskToolMode,
  // Spine-Seed Generator
  SpineSeedGenerator,
  SpineSeedRenderer,
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

  // Local State for New Map Modal
  const [isNewMapModalOpen, setIsNewMapModalOpen] = useState(false)

  // Local State for Dice Settings
  const [showDiceSettings, setShowDiceSettings] = useState(false)

  const [mapConfig, setMapConfig] = useState<{ width: number; height: number; id: number }>({
    width: 26,
    height: 26,
    id: 0
  })

  // Temporary state for the modal inputs
  const [modalWidth, setModalWidth] = useState(mapConfig.width)
  const [modalHeight, setModalHeight] = useState(mapConfig.height)

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
  // View As Dungeon toggle
  const [viewAsDungeon, setViewAsDungeon] = useState<boolean>(false)
  const [showRoomNumbers, setShowRoomNumbers] = useState<boolean>(true)
  const [showHeatMap, setShowHeatMap] = useState<boolean>(false)
  const [showWalkmap, setShowWalkmap] = useState<boolean>(false) // New: Walkmap toggle
  const [activeTheme, setActiveTheme] = useState('None')

  const themeManagerRef = useRef<ThemeManager | null>(null)

  // Custom hook to sync resize - REMOVED (Simpler method used inline)


  // --- SPINE-SEED STATE ---
  const [spineSeedSettings, setSpineSeedSettings] = useState<SpineSeedSettings>(createDefaultSpineSeedSettings())
  const spineSeedSettingsRef = useRef(spineSeedSettings)
  const spineSeedGenRef = useRef<SpineSeedGenerator | null>(null)
  const spineSeedRendererRef = useRef<SpineSeedRenderer | null>(null)
  const [spineSeedState, setSpineSeedState] = useState<SpineSeedState | null>(null)

  // Mask Tool State
  const [maskToolMode, setMaskToolMode] = useState<MaskToolMode>('off')
  const [brushSize, setBrushSize] = useState(1)

  // Rolling State
  const [isRolling, setIsRolling] = useState(false)

  // -- OVERWORLD STATE --
  const [gameMode, setGameMode] = useState<'dungeon' | 'overworld'>('dungeon')

  // Logging State
  const [unClaimedLog, setUnClaimedLog] = useState<Plot[]>([])
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)

  const [overworldStep, setOverworldStep] = useState<number>(0) // 0=Start, 1=City Placed/Roll Terrain, 2=Terrain Rolled/Roll Count, 3=Placing
  const [currentTerrain, setCurrentTerrain] = useState<string | null>(null)
  // unused: currentTerrainRow, setCurrentTerrainRow
  // const [currentTerrainRow, setCurrentTerrainRow] = useState<any | null>(null) (Moved to ref to avoid re-renders if only needed in handler)
  // Actually, we use row in handleRollCount, so we need state or ref.
  // Let's use ref to store the row data since it doesn't directly render UI (only logs/logic)
  const currentTerrainRowRef = useRef<Record<string, any> | null>(null)
  const [tilesToPlace, setTilesToPlace] = useState(0)
  const [townPlaced, setTownPlaced] = useState(false)
  // REFACTORED: Manager Ref
  const overworldManagerRef = useRef<OverworldManager>(new OverworldManager())

  // --- PLAYER & VISIBILITY STATE ---
  const visibilitySystemRef = useRef<VisibilitySystem | null>(null)
  const playerControllerRef = useRef<PlayerController | null>(null)
  const [activeLight, setActiveLight] = useState<LightSourceType>('torch')
  const [showFog, setShowFog] = useState(true)
  const [showLight, setShowLight] = useState(true)
  const [showPlayer, setShowPlayer] = useState(true)

  // Ref for movement handler access without re-binding
  const showPlayerRef = useRef(true)
  useEffect(() => { showPlayerRef.current = showPlayer }, [showPlayer])

  // Interactive Exploration State
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; visible: boolean }>({
    x: 0,
    y: 0,
    text: '',
    visible: false
  })
  const validMovesRef = useRef<Set<string>>(new Set())

  // Fix: Stale Terrain Ref
  const currentTerrainRef = useRef(currentTerrain)
  useEffect(() => {
    currentTerrainRef.current = currentTerrain
  }, [currentTerrain])

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

  const handleClearMask = useCallback(() => {
    if (!seedGrowthGenRef.current || !seedGrowthRendererRef.current) return
    const state = seedGrowthGenRef.current.getState()
    // Clear all blocked cells
    for (let y = 0; y < state.blocked.length; y++) {
      for (let x = 0; x < state.blocked[y].length; x++) {
        state.blocked[y][x] = false
      }
    }
    state.maskVersion++
    seedGrowthRendererRef.current.render(state, seedGrowthSettings)
    setSeedGrowthState({ ...state })
  }, [seedGrowthSettings])

  // Paint stroke state
  const isPaintingRef = useRef(false)

  const handleMaskPaint = useCallback((screenX: number, screenY: number) => {
    if (maskToolMode === 'off') return
    if (!seedGrowthGenRef.current || !seedGrowthRendererRef.current) return

    const gridPos = seedGrowthRendererRef.current.screenToGrid(screenX, screenY)
    if (!gridPos) return

    const state = seedGrowthGenRef.current.getState()
    const isErase = maskToolMode === 'erase'

    const changed = seedGrowthRendererRef.current.paintTile(
      state,
      gridPos.x,
      gridPos.y,
      brushSize,
      isErase,
      seedGrowthSettings.gridWidth,
      seedGrowthSettings.gridHeight
    )

    if (changed) {
      seedGrowthRendererRef.current.render(state, seedGrowthSettings)
      setSeedGrowthState({ ...state })
    }
  }, [maskToolMode, brushSize, seedGrowthSettings])

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
    console.log('[ViewAsDungeon] Effect triggered:', { viewAsDungeon, gameMode, showMap, hasState: !!seedGrowthState })

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
      console.log('[ViewAsDungeon] No state available')
      return
    }

    // Updated Logging for debugging Spine Mode
    if (generatorMode === 'spineSeed') {
      console.log('[ViewAsDungeon] Spine Mode State Check:')
      console.log(' - roomSeeds count:', (state as any).roomSeeds?.length ?? 0)
      console.log(' - spineTiles present:', !!(state as any).spineTiles, (state as any).spineTiles?.length)
    } else {
      console.log('[ViewAsDungeon] Organic Mode Rooms:', state.rooms?.length ?? 0)
    }


    // Use App Screen width if available (most accurate), fallback to layout
    const viewWidth = appRef.current?.screen.width ?? layout.middlePanel.width ?? 800
    const viewHeight = appRef.current?.screen.height ?? layout.middlePanel.height ?? 600

    if (viewAsDungeon) {
      // Create dungeon view renderer if it doesn't exist
      if (!dungeonViewRendererRef.current) {
        // Initialize ThemeManager if needed
        if (!themeManagerRef.current) {
          themeManagerRef.current = new ThemeManager(activeTheme)
        }

        dungeonViewRendererRef.current = new DungeonViewRenderer(
          appRef.current.stage,
          {
            tileSize: 50,
            themeManager: themeManagerRef.current,
            onRoomHover: (room, x, y) => handleRoomHover(room, x, y)
          }
        )
      }

      // Hide seed renderer, show dungeon view
      if (seedGrowthRendererRef.current) {
        seedGrowthRendererRef.current.getContainer().visible = false
      }
      if (spineSeedRendererRef.current) {
        spineSeedRendererRef.current.getContainer().visible = false
      }

      // Render dungeon view

      // Always update view dimensions first
      dungeonViewRendererRef.current.setViewDimensions(viewWidth, viewHeight)

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

      // Check if this is a "Toggle On" event (was hidden, now showing)
      const isToggleOn = !dungeonViewRendererRef.current.getContainer().visible

      // SYNC CAMERA from Spine Renderer (Only on toggle transition)
      if (isToggleOn) {
        if (generatorMode === 'spineSeed' && spineSeedRendererRef.current) {
          const t = spineSeedRendererRef.current.getTransform()
          dungeonViewRendererRef.current.syncTransform(t.x, t.y, t.scale)
        } else if (seedGrowthRendererRef.current) {
          const t = seedGrowthRendererRef.current.getTransform()
          dungeonViewRendererRef.current.syncTransform(t.x, t.y, t.scale)
        }
      }

      // --- ADAPTER LOGIC ---
      if (generatorMode === 'spineSeed' && state.spineTiles) {
        console.log('[ViewAsDungeon] Entering Spine Adapter logic')
        // Convert SpineSeedState to DungeonData
        const rawSeeds = (state.roomSeeds || []) as any[]

        // Prune small rooms (1x1 or 1xN)
        const prunedRooms = rawSeeds
          .filter(seed => seed.currentBounds.w > 1 && seed.currentBounds.h > 1)
          .map(seed => ({
            id: seed.id,
            regionId: 0, // Mock
            tiles: seed.tiles,
            bounds: seed.currentBounds,
            area: seed.tiles.length,
            centroid: {
              x: seed.currentBounds.x + Math.floor(seed.currentBounds.w / 2),
              y: seed.currentBounds.y + Math.floor(seed.currentBounds.h / 2)
            },
            type: getSeedLabel(seed)
          }))

        console.log('[ViewAsDungeon] Pruned rooms count:', prunedRooms.length)
        console.log('[ViewAsDungeon] Calling renderDungeonView() with spine settings')

        // Pass explicit DungeonData
        dungeonViewRendererRef.current.renderDungeonView({
          gridWidth: spineSeedSettings.gridWidth,
          gridHeight: spineSeedSettings.gridHeight,
          rooms: prunedRooms,
          spine: state.spineTiles, // Pass spine tiles directly
          spineWidth: spineSeedSettings.spine.spineWidth,
          seed: spineSeedSettings.seed, // For seeded RNG ops
          objects: state.objects // Pass objects (stairs!)
        }, spineSeedSettings as any, showRoomNumbers, showWalkmap)

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
          // We can extract this from the DungeonViewRenderer or rebuild it.
          // DungeonViewRenderer knows the "corridorTiles" logic.
          // But for now, let's use the raw state: Room Tiles + Spine Tiles + Objects(floor)
          // Actually, `DungeonViewRenderer` processes the final corridor set. 
          // Ideally we ask the renderer for the 'walkable' set, but it's render-only.
          // Let's rebuild a quick set here.
          const walkable: { x: number, y: number }[] = []
          const seen = new Set<string>()
          const add = (x, y) => {
            const k = `${x},${y}`
            if (!seen.has(k)) { seen.add(k); walkable.push({ x, y }) }
          }

          // Add Rooms
          prunedRooms.forEach(r => r.tiles.forEach(t => add(t.x, t.y)))

          // Add Expanded Corridors from Renderer
          // This fixes the collision issue where narrow spine state didn't match wide visual corridors
          const expandedCorridors = dungeonViewRendererRef.current.getWalkableTiles()
          expandedCorridors.forEach(t => add(t.x, t.y))

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

            // Update Visibility
            // We need a collision function for LOS.
            // Simple: blocked if NOT in walkable set? Or strict walls?
            // Walls are tiles NOT in navigable space (simplified).
            // Actually, better to check if tile is a WALL or BLOCKED in state.
            // For now, let's assume anything NOT floor is a wall.
            const isWall = (tx, ty) => !seen.has(`${tx},${ty}`)

            visibilitySystemRef.current.computeVisibility(
              x, y,
              LIGHT_PROFILES[activeLight].dimRadius,
              isWall
            )

            // Update Renderer
            // Update Renderer
            dungeonViewRendererRef.current.updateVisibilityState(
              spineSeedSettings.gridWidth,
              spineSeedSettings.gridHeight,
              visibilitySystemRef.current.getGrid(),
              x, y,
              LIGHT_PROFILES[activeLight]
            )



            // Focus Camera (Only if player is visible)
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

          // Initial Update
          handleMove(startX, startY)
        }

        console.log('[ViewAsDungeon] Render returned')

      } else {
        console.log('[ViewAsDungeon] calling renderDungeonView() with Organic state')
        dungeonViewRendererRef.current.renderDungeonView(state, seedGrowthSettings, showRoomNumbers, showWalkmap)

        // --- INITIALIZE PLAYER (ORGANIC MODE) ---
        // TODO: Similar logic for Organic mode if needed, utilizing rooms[0] center
      }
      dungeonViewRendererRef.current.setShowRoomNumbers(showRoomNumbers)
      dungeonViewRendererRef.current.getContainer().visible = true
    } else {
      // Toggle OFF logic
      const isToggleOff = dungeonViewRendererRef.current?.getContainer().visible

      // Hide dungeon view
      if (dungeonViewRendererRef.current) {
        dungeonViewRendererRef.current.getContainer().visible = false
      }

      // Restore Seed Renderer
      if (seedGrowthRendererRef.current) {
        seedGrowthRendererRef.current.getContainer().visible = true
        // Reverse Sync (Dungeon -> Organic)
        if (isToggleOff && dungeonViewRendererRef.current) {
          const t = dungeonViewRendererRef.current.getTransform()
          seedGrowthRendererRef.current.syncTransform(t.x, t.y, t.scale)
        }

        if (generatorMode === 'organic') {
          seedGrowthRendererRef.current.render(state, seedGrowthSettings)
        }
      }

      // Restore Spine Renderer
      if (generatorMode === 'spineSeed' && spineSeedRendererRef.current && state) {
        spineSeedRendererRef.current.getContainer().visible = true // FIXED: Explicitly show spine renderer

        // Reverse Sync (Dungeon -> Spine)
        if (isToggleOff && dungeonViewRendererRef.current) {
          const t = dungeonViewRendererRef.current.getTransform()
          spineSeedRendererRef.current.syncTransform(t.x, t.y, t.scale)
        }
        spineSeedRendererRef.current.render(state, spineSeedSettings)
      }

      // Cleanup Player Controller when Toggling Off
      if (playerControllerRef.current) {
        playerControllerRef.current.destroy()
        playerControllerRef.current = null
      }
    }
  }, [viewAsDungeon, gameMode, showMap, seedGrowthSettings, seedGrowthState, spineSeedState, spineSeedSettings, generatorMode, showRoomNumbers, showWalkmap, activeLight]) // Added activeLight dependency to re-init logic if light changes? No, handleLightChange separately.

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
      // Let's enforce re-init in the main effect by adding activeLight to dependency array?
      // Yes, that will tear down and re-build. A bit heavy but safe.
    }
  }, [activeLight])

  // Debug Toggles Effect
  useEffect(() => {
    if (dungeonViewRendererRef.current) {
      dungeonViewRendererRef.current.setDebugVisibility(showFog, showLight)
    }
  }, [showFog, showLight])

  // Dedicated effect for room number visibility toggle (independent of render)
  useEffect(() => {
    if (dungeonViewRendererRef.current) {
      dungeonViewRendererRef.current.setShowRoomNumbers(showRoomNumbers)
    }
  }, [showRoomNumbers])

  // Dedicated effect for heat map visibility (independent of render)
  useEffect(() => {
    if (dungeonViewRendererRef.current) {
      console.log('[GameWindow] Toggling Heat Map:', showHeatMap)
      dungeonViewRendererRef.current.setShowHeatMap(showHeatMap)
    }
  }, [showHeatMap])

  // Dedicated effect for walkmap visibility (independent of render)
  useEffect(() => {
    if (dungeonViewRendererRef.current) {
      console.log('[GameWindow] Toggling Walkmap:', showWalkmap)
      dungeonViewRendererRef.current.setShowWalkmap(showWalkmap)
    }
  }, [showWalkmap])

  // Update theme when active theme changes
  useEffect(() => {
    if (themeManagerRef.current) {
      themeManagerRef.current.setTheme(activeTheme)
    }
  }, [activeTheme])

  // Wire up mask paint events on Pixi container
  useEffect(() => {
    if (maskToolMode === 'off' || gameMode !== 'dungeon') return

    const container = pixiContainerRef.current
    if (!container) return

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // Left click only
      isPaintingRef.current = true
      // Get position relative to container
      const rect = container.getBoundingClientRect()
      handleMaskPaint(e.clientX - rect.left, e.clientY - rect.top)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPaintingRef.current) return
      const rect = container.getBoundingClientRect()
      handleMaskPaint(e.clientX - rect.left, e.clientY - rect.top)
    }

    const handleMouseUp = () => {
      isPaintingRef.current = false
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)
    container.addEventListener('mouseleave', handleMouseUp)

    // Change cursor when mask tool is active
    container.style.cursor = maskToolMode === 'paint' ? 'crosshair' : 'cell'

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      container.removeEventListener('mouseleave', handleMouseUp)
      container.style.cursor = ''
    }
  }, [maskToolMode, gameMode, handleMaskPaint])

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

        setIsReady(true)
      } catch (err) {
        console.error('[GameWindow] initGame failed:', err)
        initializingRef.current = false
      }
    }

    initGame()

    // 6. Preload Overworld Assets
    import('../engine/map/TerrainAssetLoader').then(({ TerrainAssetLoader }) => {
      TerrainAssetLoader.loadAll()
    })

    return () => {
      console.log('[GameWindow] Cleanup')
      initializingRef.current = false
      setIsReady(false)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true })
        appRef.current = null
      }
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

  const handleExploreTile = useCallback(async (x: number, y: number): Promise<void> => {
    setIsRolling(true)
    setLogs((prev) => [...prev, `Exploring tile at ${x},${y}...`])

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await TableEngine.rollOnTable(landTable as any)
      setIsRolling(false)

      const row = result.row
      const folder = row.folder
      const hasAssets = folder && TerrainAssetLoader.get(folder).length > 0

      if (!folder || !hasAssets) {
        addLog(`Explored '${result.result}' but found no assets. Skipping.`)
        return
      }

      addLog(`Discovered: ${result.result}`)
      setCurrentTerrain(folder)

      if (row.type === 'Unique') {
        // Place IMMEDIATELY
        currentTerrainRef.current = folder

        if (mapEngineRef.current) {
          const texture = TerrainAssetLoader.getRandom(folder)
          if (texture) {
            const { x: cx, y: cy } = mapEngineRef.current.gridSystem.getPixelCoords(x, y)
            const sprite = new Sprite(texture)
            sprite.anchor.set(0.5)
            sprite.x = cx
            sprite.y = cy
            const h = 2 * (mapEngineRef.current.gridSystem.config.size as number)
            sprite.scale.set(h / texture.height)
            mapEngineRef.current.layers.live.addChild(sprite)

            // REFACTOR: Use Manager
            overworldManagerRef.current.registerUniquePlacement(
              x,
              y,
              folder,
              (row.rank as number) || 0,
              row.tag
                ? `${row.tag}${overworldManagerRef.current.currentPlots.length + 1}`
                : undefined
            )

            // FLAIR OVERLAY (Unique)
            const flair = Sprite.from(flairOverlay)
            flair.anchor.set(0.5)
            const fh = 2 * (mapEngineRef.current.gridSystem.config.size as number)
            flair.scale.set(fh / flair.height)

            flair.x = cx
            flair.y = cy - (mapEngineRef.current.gridSystem.config.size as number) * 0.85 - 15

            mapEngineRef.current.layers.overlay.addChild(flair)

            // Sync Log
            setUnClaimedLog(overworldManagerRef.current.currentPlots)

            addLog(`Unique terrain placed at ${x},${y}.`)

            // Recalculate neighbors for next turn
            const allValid = overworldManagerRef.current.getValidMoves()
            validMovesRef.current = new Set(allValid.map((m) => `${m.x},${m.y}`))
            mapEngineRef.current.highlightValidMoves(allValid)
          }
        }
      } else {
        // AREA: Place first tile, then prompt for d8
        if (mapEngineRef.current) {
          currentTerrainRef.current = folder
          currentTerrainRowRef.current = row

          // Place the FIRST tile here and now
          const texture = TerrainAssetLoader.getRandom(folder)
          if (texture) {
            const { x: cx, y: cy } = mapEngineRef.current.gridSystem.getPixelCoords(x, y)
            const sprite = new Sprite(texture)
            sprite.anchor.set(0.5)
            sprite.x = cx
            sprite.y = cy
            const h = 2 * (mapEngineRef.current.gridSystem.config.size as number)
            sprite.scale.set(h / texture.height)
            mapEngineRef.current.layers.live.addChild(sprite)

            // REFACTOR: Manager Area Start
            overworldManagerRef.current.createAreaPlot(row.result || 'Area')
            overworldManagerRef.current.startAreaBatch(row.result || 'Area')
            overworldManagerRef.current.addTileToBatch(x, y, folder, (row.rank as number) || 0)

            // FLAIR OVERLAY (Area Start)
            const flair = Sprite.from(flairOverlay)
            flair.anchor.set(0.5)
            const fh = 2 * (mapEngineRef.current.gridSystem.config.size as number)
            flair.scale.set(fh / flair.height)

            flair.x = cx
            flair.y = cy - (mapEngineRef.current.gridSystem.config.size as number) * 0.85 - 15

            mapEngineRef.current.layers.overlay.addChild(flair)

            // Sync Log
            setUnClaimedLog(overworldManagerRef.current.currentPlots)
          }
        }

        // Prompt d8
        setOverworldStep(2) // Move to "Roll for Area Size" step
      }
    } catch (e) {
      console.error(e)
      setIsRolling(false)
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

      // Trigger Explore Logic
      handleExploreTile(x, y)
    },
    [handleExploreTile]
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

        mapEngineRef.current = new MapEngine(app, {
          viewport: layout.middlePanel,
          gridType: 'hex',
          // Use large logical size for infinite-feel hex grid
          width: 100,
          height: 100,



          // -- Overworld Callbacks --
          onValidatePlacement: (x, y) => {
            // Strict check against validMovesRef if defined
            // This ensures Ghost matches Highlight
            // Especially critical for Batch/Area placement constraint
            const key = `${x},${y}`

            // If in placing_terrain mode, we MUST rely on validMovesRef
            if (mapEngineRef.current?.interactionState.mode === 'placing_terrain') {
              return validMovesRef.current.has(key)
            }

            // Fallback for Town or other modes (though validMovesRef should arguably drive those too)

            // If map is empty, any placement is valid (First City)
            if (overworldManagerRef.current.placedTilesMap.size === 0) return true

            // Terrain must verify adjacency
            const isOdd = y % 2 !== 0
            const neighbors = isOdd
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

            // Check if any neighbor is occupied
            let hasNeighbor = false
            for (const [dx, dy] of neighbors) {
              if (overworldManagerRef.current.placedTilesMap.has(`${x + dx},${y + dy}`)) {
                hasNeighbor = true
                break
              }
            }

            if (!hasNeighbor) return false

            // Check overlap
            if (overworldManagerRef.current.placedTilesMap.has(`${x},${y}`)) return false

            return true
          },

          onTownPlaced: (x, y) => {
            if (!mapEngineRef.current) return

            // 1. Calculate Hex Center
            const { x: cx, y: cy } = mapEngineRef.current.gridSystem.getPixelCoords(x, y)
            // Use 2x size for height based scaling logic
            const h = 2 * mapEngineRef.current.gridSystem.config.size

            // 2. Try Texture
            const texture = TerrainAssetLoader.getRandom('town')

            if (texture) {
              const sprite = new Sprite(texture)
              sprite.anchor.set(0.5)
              sprite.x = cx
              sprite.y = cy

              const scale = h / texture.height
              sprite.scale.set(scale)

              mapEngineRef.current.layers.live.addChild(sprite)
            } else {
              // Fallback Shape
              const g = new Graphics()
              const r = mapEngineRef.current.gridSystem.config.size - 5
              const points: number[] = []
              for (let i = 0; i < 6; i++) {
                const angle = Math.PI / 6 + (i * Math.PI) / 3
                points.push(cx + r * Math.cos(angle))
                points.push(cy + r * Math.sin(angle))
              }
              g.poly(points)
              g.fill({ color: 0x00ffff, alpha: 0.9 })
              g.stroke({ width: 2, color: 0xffffff })
              mapEngineRef.current.layers.live.addChild(g)
            }

            // FLAIR OVERLAY (Town)
            const flair = Sprite.from(flairOverlay)
            flair.anchor.set(0.5)
            const fh = 2 * mapEngineRef.current.gridSystem.config.size
            flair.scale.set(fh / flair.height)

            flair.x = cx
            // Move to top of hex (shift up by radius/size) + 15px adjustment
            flair.y = cy - mapEngineRef.current.gridSystem.config.size * 0.85 - 15

            mapEngineRef.current.layers.overlay.addChild(flair)

            // 3. Update State
            // 3. Update State via Manager
            overworldManagerRef.current.registerTownPlacement(x, y)
            setTownPlaced(true)
            setOverworldStep(1)

            setUnClaimedLog(overworldManagerRef.current.currentPlots)

            mapEngineRef.current.interactionState.mode = 'idle'
            addLog(`Town placed at ${x}, ${y}.`)

            // 4. Highlight Valid Moves: Manager knows best
            const neighbors = overworldManagerRef.current.getValidMoves()
            mapEngineRef.current.highlightValidMoves(neighbors)

            // Fix: Update validMovesRef so hover/click works!
            validMovesRef.current = new Set(neighbors.map((m) => `${m.x},${m.y}`))
          },

          onTerrainPlaced: (x, y) => {
            // Validation (Ghost Color handled elsewhere, but double check)
            const isValid = mapEngineRef.current?.options.onValidatePlacement?.(x, y) ?? true
            if (!isValid) {
              addLog(`Invalid placement!`)
              return
            }

            // 2. Place Visual
            const type = currentTerrainRef.current || 'fields'
            const texture = TerrainAssetLoader.getRandom(type)
            if (texture && mapEngineRef.current) {
              const sprite = new Sprite(texture)
              const { x: cx, y: cy } = mapEngineRef.current.gridSystem.getPixelCoords(x, y)
              const h = 2 * mapEngineRef.current.gridSystem.config.size

              sprite.anchor.set(0.5)
              sprite.x = cx
              sprite.y = cy

              const scale = h / texture.height
              sprite.scale.set(scale)

              mapEngineRef.current.layers.live.addChild(sprite)

              // REFACTORED: Manager Update
              const rank = currentTerrainRowRef.current?.rank || 0
              overworldManagerRef.current.addTileToBatch(x, y, type, rank)

              // Sync UI Log
              setUnClaimedLog(overworldManagerRef.current.currentPlots)

              // 3. Logic: Decrement Tiles
              setTilesToPlace((prev) => {
                const newVal = prev - 1

                // CHECK FOR AREA SEED (Transition to Roll Count)
                const isUnique = currentTerrainRowRef.current?.type === 'Unique'
                const batchSize = overworldManagerRef.current.currentBatch.size

                if (newVal <= 0) {
                  if (!isUnique && batchSize === 1) {
                    // We just placed the first tile of an Area.
                    // Transition to Roll Count.
                    addLog('First tile placed. Rolling for area size...')
                    setOverworldStep(2)
                    // Do NOT reset idle mode, we want to stay engaged?
                    // Actually, we usually roll automatically?
                    // setOverworldStep(2) maps to UI showing "Roll D8" button?
                    // Or we auto-roll?
                    // UI usually has a button for rolling.
                    if (mapEngineRef.current) mapEngineRef.current.interactionState.mode = 'idle'
                    return 0
                  }

                  // Batch Complete (Unique OR Area finished)
                  setOverworldStep(1) // Back to Explore
                  overworldManagerRef.current.finishBatch()

                  if (mapEngineRef.current) {
                    mapEngineRef.current.interactionState.mode = 'idle'
                    // Recalculate global valid moves
                    const allValid = overworldManagerRef.current.getValidMoves()
                    validMovesRef.current = new Set(allValid.map((m) => `${m.x},${m.y}`))
                    mapEngineRef.current.highlightValidMoves(allValid)
                  }
                  addLog('Batch complete. Ready to explore.')
                  return 0
                }

                // If we still have tiles, update Valid Moves (Batch Adjacency)
                if (mapEngineRef.current) {
                  // We need 'getValidBatchMoves' exposed or handled by Manager.
                  // For now, use HexLogic with Manager's data.
                  const batchMoves = HexLogic.getValidBatchMoves(
                    overworldManagerRef.current.currentBatch,
                    overworldManagerRef.current.placedTilesMap
                  )

                  if (batchMoves.length === 0) {
                    addLog('No more space! Ending batch early.')
                    setOverworldStep(1)
                    mapEngineRef.current.interactionState.mode = 'idle'
                    overworldManagerRef.current.finishBatch()

                    // Revert to global valid
                    const allValid = overworldManagerRef.current.getValidMoves()
                    validMovesRef.current = new Set(allValid.map((m) => `${m.x},${m.y}`))
                    mapEngineRef.current.highlightValidMoves(allValid)
                    return 0
                  }

                  mapEngineRef.current.highlightValidMoves(batchMoves)
                  validMovesRef.current = new Set(batchMoves.map((m) => `${m.x},${m.y}`))
                }

                return newVal
              })
            }
          },
          onHexHover: handleHexHover,
          onHexClicked: handleHexClick
        })

          // Expose to window for UI/Shader access
          ; (window as any).__MAP_ENGINE__ = mapEngineRef.current

        // Initial Center for Overworld
        setTimeout(() => {
          if (mapEngineRef.current && !mapEngineRef.current.destroyed) {
            mapEngineRef.current.camera.container.scale.set(1.0)
            const { x, y } = mapEngineRef.current.gridSystem.getPixelCoords(0, 0)
            mapEngineRef.current.camera.centerAt(x, y)
          }
        }, 100)
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
          console.log('[GameWindow] Sync: Forcing IDLE mode for Explore')
          mapEngineRef.current.interactionState.mode = 'idle'
        } else {
          console.log('[GameWindow] Sync: Forcing PLACING_TOWN mode')
          mapEngineRef.current.interactionState.mode = 'placing_town'
        }
      } else if (overworldStep === 3) {
        console.log('[GameWindow] Sync: Forcing PLACING_TERRAIN mode')
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

      // Area Logic: Min 2
      const count = result.total
      // if (currentTerrainRowRef.current?.type === 'Area') {
      //   count = Math.max(count, 2)
      // }
      // User requested pure D8 roll for Additional tiles.
      // So if roll is 1, we place 1 additional tile.

      setTilesToPlace(count)
      setOverworldStep(3) // Move to Placement
      setLogs((prev) => [...prev, `Rolled ${count}: Place ${count} tile(s).`])

      // Fix: Strictly highlight ONLY valid batch neighbors for Area Placement
      if (mapEngineRef.current && currentTerrainRef.current) {
        mapEngineRef.current.interactionState.mode = 'placing_terrain'

        // Determine Valid Moves for THIS step
        let validNextMoves: { x: number; y: number }[] = []

        const batchSize = overworldManagerRef.current.currentBatch.size
        // Logic: if batch has started (size >= 1 for Area start?), use batch moves.
        // Wait, if we are rolling count, we ALREADY placed the first tile (Seed).
        // So batchSize should be >= 1.

        if (batchSize === 0) {
          // Should not happen if we placed seed? But safe fallback:
          validNextMoves = overworldManagerRef.current.getValidMoves()
        } else {
          // Use Batch Logic
          validNextMoves = HexLogic.getValidBatchMoves(
            overworldManagerRef.current.currentBatch,
            overworldManagerRef.current.placedTilesMap
          )
        }

        // Highlight AND Update Ref for interaction validation
        mapEngineRef.current.highlightValidMoves(validNextMoves)
        validMovesRef.current = new Set(validNextMoves.map((m) => `${m.x},${m.y}`))

        if (validNextMoves.length === 0) {
          addLog('No valid adjacent spots for area placement! Ending batch.')
          setOverworldStep(1)
          mapEngineRef.current.interactionState.mode = 'idle'
          overworldManagerRef.current.finishBatch()

          // Revert to global valid
          const allValid = overworldManagerRef.current.getValidMoves()
          validMovesRef.current = new Set(allValid.map((m) => `${m.x},${m.y}`))
          mapEngineRef.current.highlightValidMoves(allValid)
        }
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
                console.log('Roll Result:', result)
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
                  maskToolMode={maskToolMode}
                  onMaskToolModeChange={setMaskToolMode}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                  onClearMask={handleClearMask}
                  blockedCount={
                    generatorMode === 'organic'
                      ? (seedGrowthState?.blocked?.flat().filter(Boolean).length ?? 0)
                      : (spineSeedState?.blocked?.flat().filter(Boolean).length ?? 0)
                  }
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
          // DEBUG: Log props being passed
          (console.log('[GameWindow] Passing props:', {
            showHeatMap,
            hasToggleFn: !!setShowHeatMap
          }) as any) ||
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
            maskToolMode={maskToolMode}
            onMaskToolModeChange={setMaskToolMode}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onClearMask={handleClearMask}
            blockedCount={generatorMode === 'organic'
              ? seedGrowthState.blocked.flat().filter(b => b).length
              : (spineSeedState?.blocked?.flat().filter(Boolean).length ?? 0)}
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
          />
        )}

        {/* Floating Dungeon Controls */}
        {viewAsDungeon && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 320, // To left of existing right panel
            background: 'rgba(0,0,0,0.85)',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #444',
            color: 'white',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: 0, fontSize: '14px', borderBottom: '1px solid #666', paddingBottom: '6px', fontWeight: 'bold' }}>Light & Fog</h3>

            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showFog} onChange={e => setShowFog(e.target.checked)} />
                Fog
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showLight} onChange={e => setShowLight(e.target.checked)} />
                Light
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={showPlayer} onChange={e => setShowPlayer(e.target.checked)} />
                Player
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#aaa' }}>Light Source:</label>
              <select
                value={activeLight}
                onChange={e => setActiveLight(e.target.value as LightSourceType)}
                style={{ background: '#333', color: 'white', border: '1px solid #555', padding: '4px', borderRadius: '4px', fontSize: '12px' }}
              >
                <option value="torch">Torch (20/40)</option>
                <option value="hooded">Hooded (30/60)</option>
                <option value="bullseye">Bullseye (60/120)</option>
              </select>
            </div>

            <div style={{ fontSize: '10px', color: '#777', marginTop: '4px' }}>
              WASD or Arrows to move
            </div>
          </div>
        )}

        {
          isNewMapModalOpen && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20
              }}
            >
              <div
                style={{
                  width: '400px',
                  backgroundColor: '#141d1f',
                  border: '2px solid #bcd3d2',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  color: '#bcd3d2',
                  fontFamily: 'IMFellEnglishSC-Regular'
                }}
              >
                <h2 style={{ margin: 0, textAlign: 'center', fontSize: '32px' }}>Create New Map</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span>Width (X): {modalWidth}</span>
                  <input
                    type="range"
                    min="26"
                    max="50"
                    value={modalWidth}
                    onChange={(e) => setModalWidth(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#2e3f41' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span>Height (Y): {modalHeight}</span>
                  <input
                    type="range"
                    min="26"
                    max="50"
                    value={modalHeight}
                    onChange={(e) => setModalHeight(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#2e3f41' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                  <button
                    onClick={() => setIsNewMapModalOpen(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: 'transparent',
                      border: '1px solid #bcd3d2',
                      color: '#bcd3d2',
                      fontFamily: 'inherit',
                      fontSize: '20px',
                      cursor: 'pointer'
                    }}
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleCreateNewMap}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#2e3f41',
                      border: '1px solid #bcd3d2',
                      color: '#bcd3d2',
                      fontFamily: 'inherit',
                      fontSize: '20px',
                      cursor: 'pointer'
                    }}
                  >
                    CREATE
                  </button>
                </div>
              </div>
            </div>
          )
        }

        <DiceSettingsWrapper isOpen={showDiceSettings} onClose={() => setShowDiceSettings(false)} />
        <SettingsSync />
        <DiceOverlay />

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
        {
          isLogModalOpen && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.85)',
                zIndex: 2000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  width: '80%',
                  height: '80%',
                  backgroundColor: '#1a2628',
                  border: '2px solid #bcd3d2',
                  padding: '20px',
                  overflow: 'auto',
                  color: '#bcd3d2',
                  fontFamily: 'inherit',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}
                >
                  <h2 style={{ margin: 0, fontSize: '24px' }}>UNCLAIMED LAND LOG</h2>
                  <button
                    onClick={() => setIsLogModalOpen(false)}
                    style={{
                      background: 'none',
                      border: '1px solid #bcd3d2',
                      color: '#bcd3d2',
                      cursor: 'pointer',
                      padding: '5px 10px',
                      fontSize: '16px'
                    }}
                  >
                    CLOSE
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #bcd3d2' }}>
                      <th style={{ padding: '10px' }}>TAG</th>
                      <th style={{ padding: '10px' }}>LAND TYPE</th>
                      <th style={{ padding: '10px' }}>SIZE</th>
                      <th style={{ padding: '10px' }}>RANK</th>
                      <th style={{ padding: '10px' }}>MOD</th>
                      <th style={{ padding: '10px' }}>COORDS (First)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unClaimedLog.map((plot, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #4a5d5e' }}>
                        <td style={{ padding: '10px' }}>{plot.plotTag}</td>
                        <td style={{ padding: '10px' }}>{plot.landType}</td>
                        <td style={{ padding: '10px' }}>{plot.size}</td>
                        <td style={{ padding: '10px' }}>{plot.rank}</td>
                        <td style={{ padding: '10px' }}>{plot.rankModifier}</td>
                        <td style={{ padding: '10px' }}>
                          {plot.landTypeList[0]
                            ? `${plot.landTypeList[0].coordX}, ${plot.landTypeList[0].coordY}`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                    {unClaimedLog.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ padding: '20px', textAlign: 'center', color: '#666' }}
                        >
                          No unclaimed land logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )
        }
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
