import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Application, Graphics, Sprite } from 'pixi.js'
import { TerrainAssetLoader } from '../engine/map/TerrainAssetLoader'
import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { MapEngine } from '../engine/MapEngine'
import { GameLayout } from '../engine/ui/GameLayout'
import { BackgroundSystem } from '../engine/ui/BackgroundSystem'

interface GameWindowProps {
  onBack?: () => void
}

import { DiceOverlay } from './DiceOverlay'
import { DiceSettingsWrapper } from './DiceSettingsWrapper'
import { SettingsProvider, SettingsSync, diceEngine } from '../integrations/anvil-dice-app'
import { D8IconPanel } from './D8IconPanel'
import diceLanding from '../assets/images/ui/dice-landing.png'

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
  const [pendingNewRoom, setPendingNewRoom] = useState<{ width: number; height: number; type: string } | null>(null)
  const [pendingRoom, setPendingRoom] = useState<{ width: number; height: number } | null>(null)
  const [newlyPlacedRoomId, setNewlyPlacedRoomId] = useState<string | null>(null)
  const [exitsToPlace, setExitsToPlace] = useState(0)
  const [, setEligibleWalls] = useState<{ top: boolean; bottom: boolean; left: boolean; right: boolean } | null>(null)

  // Rolling State
  const [isRolling, setIsRolling] = useState(false)

  // -- OVERWORLD STATE --
  const [gameMode, setGameMode] = useState<'dungeon' | 'overworld'>('dungeon')
  const [overworldStep, setOverworldStep] = useState<number>(0) // 0=Start, 1=City Placed/Roll Terrain, 2=Terrain Rolled/Roll Count, 3=Placing
  const [currentTerrain, setCurrentTerrain] = useState<string | null>(null)
  const [tilesToPlace, setTilesToPlace] = useState(0)
  const [cityPlaced, setCityPlaced] = useState(false)
  const placedOverworldTiles = useRef<Map<string, string>>(new Map()) // "x,y" -> type

  // Ref to track current newlyPlacedRoomId for use in callbacks (avoids stale closure)
  const newlyPlacedRoomIdRef = useRef<string | null>(null)
  useEffect(() => { newlyPlacedRoomIdRef.current = newlyPlacedRoomId }, [newlyPlacedRoomId])

  // Fix: Stale Terrain Ref
  const currentTerrainRef = useRef(currentTerrain)
  useEffect(() => { currentTerrainRef.current = currentTerrain }, [currentTerrain])

  const addLog = (msg: string): void => {
    setLogs((prev) => [msg, ...prev.slice(0, 9)]) // Keep last 10 logs
  }

  /**
   * Initializes the entire Game View (Pixi App, Layout, Backgrounds)
   */
  useEffect(() => {
    const initGame = async () => {
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
          onNewRoomPlaced: (roomId, exitId) => {
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
            if (eligibility.connectedWall) addLog(`  - ${eligibility.connectedWall} wall: Connected (Entry)`)

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
            // If map is empty, any placement is valid (First City)
            if (placedOverworldTiles.current.size === 0) return true

            // Terrain must verify adjacency
            const isOdd = y % 2 !== 0
            const neighbors = isOdd
              ? [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]
              : [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]

            // Check if any neighbor is occupied
            let hasNeighbor = false
            for (const [dx, dy] of neighbors) {
              if (placedOverworldTiles.current.has(`${x + dx},${y + dy}`)) {
                hasNeighbor = true
                break
              }
            }

            if (!hasNeighbor) return false

            // Check overlap
            if (placedOverworldTiles.current.has(`${x},${y}`)) return false

            return true
          },

          onCityPlaced: (x, y) => {
            if (!mapEngineRef.current) return

            // 1. Calculate Hex Center
            const { x: cx, y: cy } = mapEngineRef.current.gridSystem.getPixelCoords(x, y)
            // Use 2x size for height based scaling logic
            const h = 2 * mapEngineRef.current.gridSystem.config.size

            // 2. Try Texture
            const texture = TerrainAssetLoader.getRandom('city')

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
                const angle = (Math.PI / 6) + (i * Math.PI) / 3
                points.push(cx + r * Math.cos(angle))
                points.push(cy + r * Math.sin(angle))
              }
              g.poly(points)
              g.fill({ color: 0x00FFFF, alpha: 0.9 })
              g.stroke({ width: 2, color: 0xFFFFFF })
              mapEngineRef.current.layers.live.addChild(g)
            }

            // 3. Update State
            placedOverworldTiles.current.set(`${x},${y}`, 'city')
            setCityPlaced(true)
            setOverworldStep(1)

            mapEngineRef.current.interactionState.mode = 'idle'
            addLog(`City placed at ${x}, ${y}.`)
          },

          onTerrainPlaced: (x, y) => {
            // Validation is now handled by onValidatePlacement (Ghost Color)
            // But we double check here to prevent placement
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
              placedOverworldTiles.current.set(`${x},${y}`, type)

              // 3. Update Counts
              setTilesToPlace(prev => {
                const newVal = prev - 1
                if (newVal <= 0) {
                  setOverworldStep(1) // Back to Roll
                  if (mapEngineRef.current) mapEngineRef.current.interactionState.mode = 'idle'
                  addLog('Batch complete. Roll for next terrain.')
                  return 0
                }
                return newVal
              })
            }
          }
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
  }, [showMap, mapConfig, isReady, gameMode]) // ADDED gameMode to dependencies

  useEffect(() => {
    if (exitCount >= 3 && currentStep === 4) {
      addLog('3 Exits placed. Finalizing Starter Room (Dead zones).')
      if (mapEngineRef.current) {
        const rooms = mapEngineRef.current.dungeon.getState().rooms
        const starter = rooms.find(r => r.type === 'start')
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

  const handlePlaceCityStart = (): void => {
    // TODO: Interaction mode -> placing_city
    // For now just set step
    setCityPlaced(false)
    setOverworldStep(1) // Advance for demo (Later: wait for click)
    setLogs((prev) => [...prev, 'City Placement Mode: Click on the grid to place the capital.'])

    if (mapEngineRef.current) {
      mapEngineRef.current.interactionState.mode = 'placing_city'
    }
  }

  const handleRollTerrain = async (): Promise<void> => {
    setIsRolling(true)
    setLogs((prev) => [...prev, 'Rolling for Terrain (2d8)...'])

    try {
      // 3D Dice Roll
      const result = await diceEngine.roll('2d8')
      setIsRolling(false)

      const sum = result.total
      // You can also get individual dice from result.breakdown or similar if needed
      // breakdown: [{ value: 3 }, { value: 5 }]

      let type = 'fields' // Default fallback (covers 6)
      if (sum >= 2 && sum <= 3) type = 'barren'
      else if (sum >= 4 && sum <= 6) type = 'fields' // 4-5 + 6
      else if (sum >= 7 && sum <= 8) type = 'forest'
      else if (sum >= 9 && sum <= 10) type = 'grassland'
      else if (sum >= 11 && sum <= 12) type = 'meadow'
      else if (sum >= 13 && sum <= 14) type = 'hills'
      else if (sum >= 15 && sum <= 16) type = 'swamp'

      setCurrentTerrain(type)
      setOverworldStep(2) // Move to Count Roll
      setLogs((prev) => [...prev, `Rolled ${sum}: ${type.toUpperCase()}`])
    } catch (e) {
      console.error(e)
      setIsRolling(false)
    }
  }

  const handleRollCount = async (): Promise<void> => {
    setIsRolling(true)
    setLogs((prev) => [...prev, 'Rolling for Count (1d8)...'])

    try {
      const result = await diceEngine.roll('1d8')
      setIsRolling(false)
      const count = result.total

      setTilesToPlace(count)
      setOverworldStep(3) // Move to Placement
      setLogs((prev) => [...prev, `Rolled ${count}: Place ${count} tile(s).`])

      if (mapEngineRef.current && currentTerrainRef.current) {
        mapEngineRef.current.interactionState.mode = 'placing_terrain'
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
    setCityPlaced(false)
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
      setMapConfig(prev => ({ ...prev, id: Date.now() }))
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
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  overflowY: 'auto', // Enable scrolling
                  minHeight: 0 // Crucial for flex nested scrolling
                }}>
                  <h2 style={{
                    fontSize: '28px',
                    borderBottom: '1px solid #bcd3d2',
                    margin: '0 0 20px 0',
                    paddingBottom: '10px',
                    textAlign: 'center',
                    flexShrink: 0
                  }}>
                    Dungeon Blueprint
                  </h2>

                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: '20px', color: currentStep === 1 ? '#fff' : '#666', textAlign: 'center' }}>
                      Step 1: Place Entrance
                    </div>
                    <div style={{ fontSize: '20px', color: currentStep === 2 ? '#fff' : '#666', textAlign: 'center', marginTop: '10px' }}>
                      Step 2: Roll Room Size
                    </div>
                    <div style={{ fontSize: '20px', color: currentStep === 3 ? '#fff' : '#666', textAlign: 'center', marginTop: '10px' }}>
                      Step 3: Place Room
                    </div>
                    <div style={{ fontSize: '20px', color: currentStep === 4 ? '#fff' : '#666', textAlign: 'center', marginTop: '10px' }}>
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
                            addLog(`Rolled ${result.original[0]} (X) & ${result.original[1]} (Y) -> Size: ${result.width}x${result.height}`)
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
                          mapEngineRef.current.interactionState.pendingRoomSize = { w: pendingRoom.width, h: pendingRoom.height }
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
                          const starter = rooms.find(r => r.type === 'start')
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
                            const result = await mapEngineRef.current.dungeon.rollNewRoomAttributes(activeExitId)

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
                            setPendingNewRoom({ width: finalWidth, height: finalHeight, type: result.type })
                          } catch (err) {
                            console.error(err)
                            addLog('Error rolling room attributes.')
                          } finally {
                            setIsRolling(false)
                          }
                        } else {
                          // Switch to placing mode
                          mapEngineRef.current.interactionState.mode = 'placing_new_room'
                          mapEngineRef.current.interactionState.pendingRoomSize = { w: pendingNewRoom.width, h: pendingNewRoom.height }
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
                              const eligibility = mapEngineRef.current.dungeon.calculateEligibleWalls(newlyPlacedRoomId)

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
                                  addLog(`Capped to ${actualExits} (only ${eligibility.count} wall(s) eligible)`)
                                }
                                setExitsToPlace(actualExits)
                                setEligibleWalls({ top: eligibility.top, bottom: eligibility.bottom, left: eligibility.left, right: eligibility.right })
                                mapEngineRef.current.interactionState.mode = 'placing_exit'
                                mapEngineRef.current.interactionState.activeRoomId = newlyPlacedRoomId
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
                      <div key={i} style={{ marginBottom: '5px', color: i === 0 ? '#fff' : '#888' }}>
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
                  OVERWORLD COMMAND
                </h2>

                {/* STEP 0: PLACE CITY */}
                {!cityPlaced && overworldStep === 0 && (
                  <button
                    onClick={handlePlaceCityStart}
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
                    PLACE CITY
                  </button>
                )}

                {/* MESSAGE IF PLACING CITY */}
                {!cityPlaced && overworldStep === 1 && (
                  <div style={{ textAlign: 'center', color: '#fff' }}>
                    Click map to place City...
                  </div>
                )}

                {/* STEP 1: ROLL TERRAIN */}
                {cityPlaced && overworldStep === 1 && (
                  <button
                    onClick={handleRollTerrain}
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
                    {isRolling ? 'ROLLING...' : 'ROLL TERRAIN (2d8)'}
                  </button>
                )}

                {/* STEP 2: ROLL COUNT */}
                {cityPlaced && overworldStep === 2 && (
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
                {cityPlaced && overworldStep === 3 && (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                <input type="range" min="26" max="50" value={modalWidth} onChange={(e) => setModalWidth(Number(e.target.value))} style={{ width: '100%', accentColor: '#2e3f41' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span>Height (Y): {modalHeight}</span>
                <input type="range" min="26" max="50" value={modalHeight} onChange={(e) => setModalHeight(Number(e.target.value))} style={{ width: '100%', accentColor: '#2e3f41' }} />
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <button onClick={() => setIsNewMapModalOpen(false)} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #bcd3d2', color: '#bcd3d2', fontFamily: 'inherit', fontSize: '20px', cursor: 'pointer' }}>CANCEL</button>
                <button onClick={handleCreateNewMap} style={{ flex: 1, padding: '10px', backgroundColor: '#2e3f41', border: '1px solid #bcd3d2', color: '#bcd3d2', fontFamily: 'inherit', fontSize: '20px', cursor: 'pointer' }}>CREATE</button>
              </div>
            </div>
          </div>
        )}

        <DiceSettingsWrapper isOpen={showDiceSettings} onClose={() => setShowDiceSettings(false)} />
        <SettingsSync />
        <DiceOverlay />
      </div>
    </SettingsProvider >
  )
}

async function buildUI(app: Application, layout: GameLayout): Promise<void> {
  const leftBg = new Graphics().rect(0, 0, 300, app.screen.height).fill(0x141d1f)
  layout.leftPanel.addChild(leftBg)
  const rightBg = new Graphics().rect(0, 0, 300, app.screen.height).fill(0x141d1f)
  layout.rightPanel.addChild(rightBg)
}
