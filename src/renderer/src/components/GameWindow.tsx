import React, { useRef, useEffect, useState } from 'react'
import { Application, Graphics } from 'pixi.js'
import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { MapEngine } from '../engine/MapEngine'
import { GameLayout } from '../engine/ui/GameLayout'
import { BackgroundSystem } from '../engine/ui/BackgroundSystem'

interface GameWindowProps {
  onBack?: () => void
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

  const [mapConfig, setMapConfig] = useState<{ width: number; height: number; id: number }>({
    width: 20,
    height: 20,
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
  const [eligibleWalls, setEligibleWalls] = useState<{ top: boolean; bottom: boolean; left: boolean; right: boolean } | null>(null)

  // Ref to track current newlyPlacedRoomId for use in callbacks (avoids stale closure)
  const newlyPlacedRoomIdRef = useRef<string | null>(null)
  useEffect(() => { newlyPlacedRoomIdRef.current = newlyPlacedRoomId }, [newlyPlacedRoomId])

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
          autoDensity: true,
          resolution: window.devicePixelRatio || 1
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

      // Reset all UI state when creating a new map
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
      setEligibleWalls(null)

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
        onNewRoomPlaced: (roomId, _exitId) => {
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
      bg?.setVisible(true)
      if (mapEngineRef.current) {
        mapEngineRef.current.destroy()
        mapEngineRef.current = null
      }
    }
  }, [showMap, mapConfig, isReady])

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

    // Reset generation state
    setCurrentStep(1)
    setExitCount(0)
    setPendingRoom(null)
    setIsPlacingEntrance(false)
    setIsPlacingRoom(false)
    setIsPlacingExit(false)
    setLogs(['Dungeon Blueprint Initialized.', 'Starting new map...'])

    setMapConfig({
      width: modalWidth,
      height: modalHeight,
      id: Date.now()
    })
    if (!showMap) {
      toggleMap()
    }
  }

  return (
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
          height: '0',
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

        {/* NEW MAP Button */}
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
          NEW MAP
        </div>

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
            padding: '24px',
            boxSizing: 'border-box',
            color: '#bcd3d2',
            fontFamily: 'IMFellEnglishSC-Regular',
            backgroundColor: 'rgba(20, 29, 31, 0.8)'
          }}
        >
          {/* EXIT Button */}
          <div
            onClick={onBack}
            style={{
              width: '100%',
              height: '50px',
              backgroundColor: '#2e3f41',
              border: '1px solid #bcd3d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '24px',
              userSelect: 'none',
              flexShrink: 0,
              marginBottom: '30px'
            }}
          >
            EXIT
          </div>

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
              onClick={() => {
                if (mapEngineRef.current) {
                  const result = mapEngineRef.current.dungeon.rollStartingRoomSize()
                  setPendingRoom(result)
                  addLog(`Rolled ${result.original[0]} (X) & ${result.original[1]} (Y) -> Size: ${result.width}x${result.height}`)
                  setCurrentStep(3)
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
              disabled={!activeExitId}
              onClick={() => {
                if (!mapEngineRef.current || !activeExitId) return

                if (!pendingNewRoom) {
                  // Roll the room size
                  const result = mapEngineRef.current.dungeon.rollNewRoomAttributes(activeExitId)

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
              disabled={!newlyPlacedRoomId || exitsToPlace > 0}
              onClick={() => {
                if (mapEngineRef.current && newlyPlacedRoomId) {
                  const result = mapEngineRef.current.dungeon.rollForExitCount()
                  addLog(`Rolled 1d6: ${result.roll}`)

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
              <input type="range" min="20" max="40" value={modalWidth} onChange={(e) => setModalWidth(Number(e.target.value))} style={{ width: '100%', accentColor: '#2e3f41' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span>Height (Y): {modalHeight}</span>
              <input type="range" min="20" max="40" value={modalHeight} onChange={(e) => setModalHeight(Number(e.target.value))} style={{ width: '100%', accentColor: '#2e3f41' }} />
            </div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
              <button onClick={() => setIsNewMapModalOpen(false)} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid #bcd3d2', color: '#bcd3d2', fontFamily: 'inherit', fontSize: '20px', cursor: 'pointer' }}>CANCEL</button>
              <button onClick={handleCreateNewMap} style={{ flex: 1, padding: '10px', backgroundColor: '#2e3f41', border: '1px solid #bcd3d2', color: '#bcd3d2', fontFamily: 'inherit', fontSize: '20px', cursor: 'pointer' }}>CREATE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

async function buildUI(app: Application, layout: GameLayout): Promise<void> {
  const leftBg = new Graphics().rect(0, 0, 300, app.screen.height).fill(0x141d1f)
  layout.leftPanel.addChild(leftBg)
  const rightBg = new Graphics().rect(0, 0, 300, app.screen.height).fill(0x141d1f)
  layout.rightPanel.addChild(rightBg)
}
