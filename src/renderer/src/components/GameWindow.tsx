import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Application, Graphics, Sprite, Assets } from 'pixi.js'
import { TerrainAssetLoader } from '../engine/map/TerrainAssetLoader'
import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { MapEngine } from '../engine/MapEngine'
import { HexLogic } from '../engine/systems/HexLogic'
import { OverworldManager } from '../engine/managers/OverworldManager'
import { GameLayout } from '../engine/ui/GameLayout'
import { BackgroundSystem } from '../engine/ui/BackgroundSystem'
import { TableEngine } from '../engine/tables/TableEngine'
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

export const GameWindow = ({ onBack }: GameWindowProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null)
  const pixiContainerRef = useRef<HTMLDivElement>(null)

  // Core Systems Refs
  const appRef = useRef<Application | null>(null)
  const layoutRef = useRef<GameLayout | null>(null)
  const bgSystemRef = useRef<BackgroundSystem | null>(null)
  const mapEngineRef = useRef<MapEngine | null>(null)
  const initializingRef = useRef(false)

  // Global Store
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

  // Dungeon Generation UI State
  const [currentStep, setCurrentStep] = useState(1)
  const [logs, setLogs] = useState<string[]>(['Dungeon Blueprint Initialized.'])
  const [isPlacingEntrance, setIsPlacingEntrance] = useState(false)
  const [isPlacingRoom, setIsPlacingRoom] = useState(false)
  const [isPlacingExit, setIsPlacingExit] = useState(false)
  const [exitCount, setExitCount] = useState(0)
  const [activeExitId, setActiveExitId] = useState<string | null>(null)
  const [pendingNewRoom, setPendingNewRoom] = useState<{
    width: number
    height: number
    type: string
  } | null>(null)
  const [pendingRoom, setPendingRoom] = useState<{ width: number; height: number } | null>(null)
  const [newlyPlacedRoomId, setNewlyPlacedRoomId] = useState<string | null>(null)
  const [exitsToPlace, setExitsToPlace] = useState(0)
  const [, setEligibleWalls] = useState<{
    top: boolean
    bottom: boolean
    left: boolean
    right: boolean
  } | null>(null)

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

  // Interactive Exploration State
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; visible: boolean }>({
    x: 0,
    y: 0,
    text: '',
    visible: false
  })
  const validMovesRef = useRef<Set<string>>(new Set())

  // Ref to track current newlyPlacedRoomId for use in callbacks (avoids stale closure)
  const newlyPlacedRoomIdRef = useRef<string | null>(null)
  useEffect(() => {
    newlyPlacedRoomIdRef.current = newlyPlacedRoomId
  }, [newlyPlacedRoomId])

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

  const addLog = (msg: string): void => {
    setLogs((prev) => [msg, ...prev.slice(0, 9)]) // Keep last 10 logs
  }

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
        // --- DUNGEON MODE (Square Grid) ---
        // Reset dungeon UI state
        setCurrentStep(1)
        setLogs(['Dungeon Blueprint Initialized.'])
        setIsPlacingEntrance(false)
        setIsPlacingRoom(false)
        setIsPlacingExit(false)
        setExitCount(0)
        setActiveExitId(null)
        setPendingNewRoom(null)
        setPendingRoom(null)
        setNewlyPlacedRoomId(null)
        setExitsToPlace(0)

        mapEngineRef.current = new MapEngine(app, {
          viewport: layout.middlePanel,
          gridType: 'square',
          width: mapConfig.width,
          height: mapConfig.height,
          onEntrancePlaced: (tx, ty) => {
            addLog(`Entrance placed at ${tx},${ty}. Step 1 Complete.`)
            setCurrentStep(2)
            setIsPlacingEntrance(false)
          },
          onRoomPlaced: (x, y, w, h) => {
            addLog(`Room placed at ${x},${y} (${w}x${h}). Step 3 Complete.`)
            setCurrentStep(4)
            setIsPlacingRoom(false)
            setPendingRoom(null)
          },
          onExitPlaced: (x, y) => {
            addLog(`Exit placed at ${x},${y}.`)

            // Handle starter room exit placement (step 4)
            setExitCount((prev) => prev + 1)

            // Handle new room exit placement
            setExitsToPlace((prev) => {
              if (prev > 0) {
                const remaining = prev - 1
                if (remaining === 0) {
                  // All exits placed - finalize the room
                  const roomId = newlyPlacedRoomIdRef.current
                  if (mapEngineRef.current && roomId) {
                    mapEngineRef.current.dungeon.finalizeNewRoom(roomId)
                    mapEngineRef.current.interactionState.mode = 'idle'
                    setNewlyPlacedRoomId(null)
                    setEligibleWalls(null)
                    setLogs([]) // Clear logs
                  }
                }
                return remaining
              }
              return prev
            })
          },
          onExitClicked: (exitId) => {
            // Clear logs and set up for new room generation
            setLogs(['New Room Generation Started.', 'Step 1: Roll Room Size'])
            setActiveExitId(exitId)
            setPendingNewRoom(null) // Reset pending room

            // Calculate and show max dimensions
            if (mapEngineRef.current) {
              const dims = mapEngineRef.current.dungeon.calculateMaxDimensions(exitId)
              addLog(`Max Available Space: ${dims.maxW}x${dims.maxH}`)
            }
          },
          onNewRoomPlaced: (roomId) => {
            // (Callback uses roomId, exitId)
            if (!mapEngineRef.current) return

            // Clear previous state
            setActiveExitId(null)
            setPendingNewRoom(null)

            // Log room placement
            setLogs([`Room Placed! ID: ${roomId.substring(0, 12)}...`])
            addLog('Step 2: Roll for Exits.')

            // Calculate eligible walls
            const eligibility = mapEngineRef.current.dungeon.calculateEligibleWalls(roomId)
            addLog(`Eligible walls: ${eligibility.count} of 3`)
            if (eligibility.top) addLog('  - Top wall: Eligible')
            if (eligibility.bottom) addLog('  - Bottom wall: Eligible')
            if (eligibility.left) addLog('  - Left wall: Eligible')
            if (eligibility.right) addLog('  - Right wall: Eligible')
            if (eligibility.connectedWall)
              addLog(`  - ${eligibility.connectedWall} wall: Connected (Entry)`)

            // Store the new room ID for the exit roll button
            setNewlyPlacedRoomId(roomId)
          }
        })
      } else {
        // --- OVERWORLD MODE (Hex Grid) ---
        // Reset Overworld UI state (if needed, but usually handled by button)
        setCurrentStep(0) // Hide Dungeon UI

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
                    overworldManagerRef.current.finishBatch()
                    mapEngineRef.current.interactionState.mode = 'idle'
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

  useEffect(() => {
    if (exitCount >= 3 && currentStep === 4) {
      addLog('3 Exits placed. Finalizing Starter Room (Dead zones).')
      if (mapEngineRef.current) {
        const rooms = mapEngineRef.current.dungeon.getState().rooms
        const starter = rooms.find((r) => r.type === 'start')
        if (starter) {
          mapEngineRef.current.dungeon.finalizeStarterRoom(starter.id)
        }
        mapEngineRef.current.interactionState.mode = 'idle'
      }
      setCurrentStep(5)
      setIsPlacingExit(false)
    }
  }, [exitCount, currentStep])

  const handleCreateNewMap = (): void => {
    setIsNewMapModalOpen(false)
    setGameMode('dungeon') // Explicitly set dungeon mode

    // UI Resets happen in useEffect now, but setting config triggers re-render/effect maybe?
    // Actually showMap toggle triggers effect.
    // If showMap is already true, we need to trigger effect.
    // Setting mapConfig is a dependency!
    setMapConfig({
      width: modalWidth,
      height: modalHeight,
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

          {/* NEW DUNGEON Button */}
          <div
            onClick={() => setIsNewMapModalOpen(true)}
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

            {/* --- Dungeon UI --- */}
            {gameMode === 'dungeon' && (
              <>
                {/* Content Wrapper with Padding */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '24px',
                    overflowY: 'auto', // Enable scrolling
                    minHeight: 0 // Crucial for flex nested scrolling
                  }}
                >
                  <h2
                    style={{
                      fontSize: '28px',
                      borderBottom: '1px solid #bcd3d2',
                      margin: '0 0 20px 0',
                      paddingBottom: '10px',
                      textAlign: 'center',
                      flexShrink: 0
                    }}
                  >
                    Dungeon Blueprint
                  </h2>

                  <div style={{ flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: '20px',
                        color: currentStep === 1 ? '#fff' : '#666',
                        textAlign: 'center'
                      }}
                    >
                      Step 1: Place Entrance
                    </div>
                    <div
                      style={{
                        fontSize: '20px',
                        color: currentStep === 2 ? '#fff' : '#666',
                        textAlign: 'center',
                        marginTop: '10px'
                      }}
                    >
                      Step 2: Roll Room Size
                    </div>
                    <div
                      style={{
                        fontSize: '20px',
                        color: currentStep === 3 ? '#fff' : '#666',
                        textAlign: 'center',
                        marginTop: '10px'
                      }}
                    >
                      Step 3: Place Room
                    </div>
                    <div
                      style={{
                        fontSize: '20px',
                        color: currentStep === 4 ? '#fff' : '#666',
                        textAlign: 'center',
                        marginTop: '10px'
                      }}
                    >
                      Step 4: Exits ({exitCount}/3)
                    </div>

                    <button
                      disabled={isPlacingEntrance || currentStep !== 1}
                      onClick={() => {
                        if (mapEngineRef.current) {
                          mapEngineRef.current.interactionState.mode = 'placing_entrance'
                          setIsPlacingEntrance(true)
                          addLog('Ready to place entrance. Click bottom edge.')
                        }
                      }}
                      style={{
                        display: currentStep === 1 ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: isPlacingEntrance ? '#4a5d5e' : '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      {isPlacingEntrance ? 'SELECT TILE...' : 'PLACE ENTRANCE'}
                    </button>

                    {/* Step 2: Roll Room Size */}
                    <button
                      disabled={isRolling}
                      onClick={async () => {
                        if (mapEngineRef.current) {
                          setIsRolling(true)
                          try {
                            const result = await mapEngineRef.current.dungeon.rollStartingRoomSize()
                            setPendingRoom(result)
                            addLog(
                              `Rolled ${result.original[0]} (X) & ${result.original[1]} (Y) -> Size: ${result.width}x${result.height}`
                            )
                            setCurrentStep(3)
                          } catch (err) {
                            console.error(err)
                            addLog('Error rolling dice.')
                          } finally {
                            setIsRolling(false)
                          }
                        }
                      }}
                      style={{
                        display: currentStep === 2 ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      ROLL ROOM SIZE (2d6)
                    </button>

                    {/* Step 3: Place Room */}
                    <button
                      disabled={isPlacingRoom || currentStep !== 3 || !pendingRoom}
                      onClick={() => {
                        if (mapEngineRef.current && pendingRoom) {
                          mapEngineRef.current.interactionState.pendingRoomSize = {
                            w: pendingRoom.width,
                            h: pendingRoom.height
                          }
                          mapEngineRef.current.interactionState.mode = 'placing_room'
                          setIsPlacingRoom(true)
                          addLog('Click grid to place room.')
                        }
                      }}
                      style={{
                        display: currentStep === 3 ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: isPlacingRoom ? '#4a5d5e' : '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      {isPlacingRoom ? 'SELECT TILE...' : 'PLACE ROOM'}
                    </button>

                    {/* Step 4: Place Exits */}
                    <button
                      disabled={isPlacingExit || currentStep !== 4}
                      onClick={() => {
                        if (mapEngineRef.current) {
                          // Find starter room ID
                          const rooms = mapEngineRef.current.dungeon.getState().rooms
                          const starter = rooms.find((r) => r.type === 'start')
                          if (starter) {
                            mapEngineRef.current.interactionState.activeRoomId = starter.id
                            mapEngineRef.current.interactionState.mode = 'placing_exit'
                            setIsPlacingExit(true)
                            addLog('Click room walls to place exit.')
                          } else {
                            addLog('Error: No starter room found.')
                          }
                        }
                      }}
                      style={{
                        display: currentStep === 4 ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: isPlacingExit ? '#4a5d5e' : '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      {isPlacingExit ? 'SELECT WALL...' : 'PLACE EXIT'}
                    </button>

                    {/* Step 5: New Room - Roll Size / Place Room */}
                    <button
                      disabled={!activeExitId || isRolling}
                      onClick={async () => {
                        if (!mapEngineRef.current || !activeExitId) return

                        if (!pendingNewRoom) {
                          setIsRolling(true)
                          try {
                            // Roll the room size
                            const result =
                              await mapEngineRef.current.dungeon.rollNewRoomAttributes(activeExitId)

                            // Display all roll logs
                            result.rolls.forEach((log) => addLog(log))

                            // Display initial classification
                            addLog(`Rolled: ${result.type} (${result.width}x${result.height})`)

                            // Check if room fits, clamp if needed
                            const clamped = mapEngineRef.current.dungeon.clampRoomToAvailableSpace(
                              result.width,
                              result.height,
                              activeExitId
                            )

                            let finalWidth = result.width
                            let finalHeight = result.height

                            if (clamped.clamped) {
                              addLog(`⚠️ ${clamped.reason}`)
                              finalWidth = clamped.width
                              finalHeight = clamped.height
                              addLog(`Final size: ${finalWidth}x${finalHeight}`)
                            }

                            // Store pending room with (possibly clamped) dimensions
                            setPendingNewRoom({
                              width: finalWidth,
                              height: finalHeight,
                              type: result.type
                            })
                          } catch (err) {
                            console.error(err)
                            addLog('Error rolling room attributes.')
                          } finally {
                            setIsRolling(false)
                          }
                        } else {
                          // Switch to placing mode
                          mapEngineRef.current.interactionState.mode = 'placing_new_room'
                          mapEngineRef.current.interactionState.pendingRoomSize = {
                            w: pendingNewRoom.width,
                            h: pendingNewRoom.height
                          }
                          mapEngineRef.current.interactionState.activeExitId = activeExitId
                          addLog('Click to place the new room.')
                        }
                      }}
                      style={{
                        display: activeExitId ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: pendingNewRoom ? '#4a5d5e' : '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      {pendingNewRoom ? 'PLACE ROOM' : 'ROLL ROOM SIZE'}
                    </button>

                    {/* Step: Roll for Exits (for newly placed room) */}
                    <button
                      disabled={!newlyPlacedRoomId || exitsToPlace > 0 || isRolling}
                      onClick={async () => {
                        if (mapEngineRef.current && newlyPlacedRoomId) {
                          setIsRolling(true)
                          try {
                            const result = await mapEngineRef.current.dungeon.rollForExitCount()
                            addLog(`Rolled 1d8: ${result.roll}`)

                            let exitText = ''
                            if (result.exitCount === 0) exitText = 'No Exits'
                            else if (result.exitCount === 1) exitText = '1 Exit'
                            else exitText = `${result.exitCount} Exits`

                            addLog(`Result: ${exitText}`)

                            if (result.exitCount === 0) {
                              // No exits - finalize the room and clear UI
                              mapEngineRef.current.dungeon.finalizeNewRoom(newlyPlacedRoomId)
                              addLog('Room completed. Dead zones marked.')
                              setNewlyPlacedRoomId(null)
                              setLogs([]) // Clear logs
                            } else {
                              // 1+ exits - prepare for placing exits
                              const eligibility =
                                mapEngineRef.current.dungeon.calculateEligibleWalls(
                                  newlyPlacedRoomId
                                )

                              // Cap exit count to number of eligible walls
                              const actualExits = Math.min(result.exitCount, eligibility.count)

                              if (actualExits === 0) {
                                // No eligible walls - finalize room
                                addLog(`Eligible walls: 0 of 3 - No exits can be placed.`)
                                mapEngineRef.current.dungeon.finalizeNewRoom(newlyPlacedRoomId)
                                addLog('Room completed. Dead zones marked.')
                                setNewlyPlacedRoomId(null)
                                setLogs([]) // Clear logs
                              } else {
                                if (actualExits < result.exitCount) {
                                  addLog(
                                    `Capped to ${actualExits} (only ${eligibility.count} wall(s) eligible)`
                                  )
                                }
                                setExitsToPlace(actualExits)
                                setEligibleWalls({
                                  top: eligibility.top,
                                  bottom: eligibility.bottom,
                                  left: eligibility.left,
                                  right: eligibility.right
                                })
                                mapEngineRef.current.interactionState.mode = 'placing_exit'
                                mapEngineRef.current.interactionState.activeRoomId =
                                  newlyPlacedRoomId
                                addLog(`Click on eligible walls to place ${actualExits} exit(s).`)
                              }
                            }
                          } catch (err) {
                            console.error(err)
                            addLog('Error rolling for exits.')
                          } finally {
                            setIsRolling(false)
                          }
                        }
                      }}
                      style={{
                        display: newlyPlacedRoomId && exitsToPlace === 0 ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: '#2e3f41',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      ROLL FOR EXITS
                    </button>

                    {/* Step: Place Exits (for newly placed room) */}
                    <button
                      disabled={exitsToPlace === 0}
                      onClick={() => {
                        // This button is just informational - exits are placed via map clicks
                      }}
                      style={{
                        display: exitsToPlace > 0 ? 'block' : 'none',
                        width: '100%',
                        marginTop: '15px',
                        padding: '12px',
                        backgroundColor: '#4a5d5e',
                        border: '1px solid #bcd3d2',
                        color: '#bcd3d2',
                        cursor: 'default',
                        fontFamily: 'inherit',
                        fontSize: '18px'
                      }}
                    >
                      PLACE EXIT ({exitsToPlace} remaining)
                    </button>
                  </div>

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
                      <div
                        key={i}
                        style={{ marginBottom: '5px', color: i === 0 ? '#fff' : '#888' }}
                      >
                        {`> ${log}`}
                      </div>
                    ))}
                  </div>
                </div>
              </>
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

        {isNewMapModalOpen && (
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
        )}

        <DiceSettingsWrapper isOpen={showDiceSettings} onClose={() => setShowDiceSettings(false)} />
        <SettingsSync />
        <DiceOverlay />

        {/* Tooltip */}
        {tooltip.visible && (
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
        )}

        {/* VIEW LOG BUTTON */}

        {/* UNCLAIMED LOG MODAL */}
        {isLogModalOpen && (
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
        )}
      </div>
    </SettingsProvider>
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
