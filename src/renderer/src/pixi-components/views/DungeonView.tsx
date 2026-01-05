/**
 * DungeonView
 * 
 * Production-ready dungeon view component using @pixi/react.
 * Provides full interactivity including pan/zoom, player movement,
 * and visibility systems.
 * 
 * This is the main rendering component for dungeon exploration and combat.
 * 
 * @example
 * <PixiApplication resizeTo={containerRef}>
 *   <DungeonView
 *     dungeonData={dungeon}
 *     playerEnabled={true}
 *     onPlayerMove={(x, y) => console.log('Moved to', x, y)}
 *   />
 * </PixiApplication>
 */

import { useEffect, useMemo, useCallback, useRef, useState } from 'react'
import { Container as PixiContainer, Graphics } from 'pixi.js'
import { useApplication } from '@pixi/react'

// Layer hooks
import {
    useFloorLayer,
    useWallLayer,
    useGridLayer,
    useLabelLayer,
    useBackgroundLayer,
    useSpineDebugLayer,
    useWalkmapLayer,
    useHeatmapLayer,
    useObjectLayer
} from '../hooks'

// Data adapters
import {
    toFloorRenderData,
    toWallRenderData,
    toGridRenderData,
    toLabelRenderData,
    toSpineDebugRenderData,
    roomToRenderData
} from '@/engine/systems/layers/LayerAdapters'

// Types
import { DungeonData, SpineSeedState, Room } from '@/engine/seed-growth/types'
import { DungeonAnalysisResult } from '@/engine/analysis/DungeonAnalysis'
import { calculateWalls } from '@/engine/processors/WallCalculator'
import { THEMES, RoomLayerConfig } from '@/engine/themes/ThemeTypes'
import { ThemeColors } from '@/engine/systems/layers/ILayer'

// =============================================================================
// Helper: Convert string colors to numbers
// =============================================================================

function parseColor(color: string): number {
    if (color.startsWith('#')) {
        return parseInt(color.slice(1), 16)
    }
    if (color.startsWith('0x')) {
        return parseInt(color, 16)
    }
    return parseInt(color, 16)
}

function configToThemeColors(config: RoomLayerConfig): ThemeColors {
    return {
        background: parseColor(config.background),
        floor: { color: parseColor(config.floor.color) },
        walls: {
            color: parseColor(config.walls.color),
            width: config.walls.width,
            roughness: config.walls.roughness
        },
        shadow: config.shadow ? {
            color: parseColor(config.shadow.color),
            x: config.shadow.x,
            y: config.shadow.y
        } : undefined
    }
}

// =============================================================================
// Types
// =============================================================================

export interface DungeonViewProps {
    /** The generated dungeon data */
    dungeonData: DungeonData

    /** Optional spine state for debug overlay */
    spineState?: SpineSeedState | null

    /** Optional analysis result for walkmap scores and furthest rooms */
    analysisResult?: DungeonAnalysisResult | null

    /** Tile size in pixels */
    tileSize?: number

    /** Theme name (uses THEMES lookup) */
    themeName?: string

    // Visibility toggles
    showGrid?: boolean
    showRoomNumbers?: boolean
    showSpineDebug?: boolean
    showWalkmap?: boolean
    showHeatmap?: boolean
    showFog?: boolean
    showLight?: boolean

    // Player
    playerEnabled?: boolean
    initialPlayerPosition?: { x: number, y: number }
    onPlayerMove?: (x: number, y: number) => void

    // Interaction callbacks
    onRoomClick?: (room: Room) => void
    onRoomHover?: (room: Room | null) => void
    onTileClick?: (x: number, y: number) => void

    // Camera
    onZoomChange?: (zoom: number) => void
}

// =============================================================================
// Component
// =============================================================================

export function DungeonView({
    dungeonData,
    spineState,
    analysisResult,
    tileSize = 50,
    themeName = 'Dungeon',
    showGrid = false,
    showRoomNumbers = true,
    showSpineDebug = false,
    showWalkmap = false,
    showHeatmap = false,
    showFog: _showFog = false,
    showLight: _showLight = false,
    playerEnabled = false,
    initialPlayerPosition,
    onPlayerMove,
    onRoomClick: _onRoomClick,
    onRoomHover: _onRoomHover,
    onTileClick: _onTileClick,
    onZoomChange: _onZoomChange
}: DungeonViewProps) {

    const { app } = useApplication()
    const containerRef = useRef<PixiContainer | null>(null)

    // Player state
    const [playerPos, setPlayerPos] = useState(() => {
        if (initialPlayerPosition) return initialPlayerPosition
        // Default to first room center or stairs
        const stairs = dungeonData.objects?.find(o => o.type === 'stairs_up')
        if (stairs) return { x: stairs.x, y: stairs.y }
        if (dungeonData.rooms.length > 0) {
            const room = dungeonData.rooms[0]
            return { x: room.centroid.x, y: room.centroid.y }
        }
        return { x: Math.floor(dungeonData.gridWidth / 2), y: Math.floor(dungeonData.gridHeight / 2) }
    })

    // Camera state
    const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 })
    const isDragging = useRef(false)
    const lastDrag = useRef({ x: 0, y: 0 })

    // Walkable tiles set for movement validation
    const walkableSet = useMemo(() => {
        const set = new Set<string>()

        // Add all room tiles
        for (const room of dungeonData.rooms) {
            for (const tile of room.tiles) {
                set.add(`${tile.x},${tile.y}`)
            }
        }

        // Add all corridor tiles
        const corridors = (dungeonData as any).corridors as Array<{ id: string, tiles: { x: number, y: number }[] }> | undefined
        if (corridors) {
            for (const corridor of corridors) {
                for (const tile of corridor.tiles) {
                    set.add(`${tile.x},${tile.y}`)
                }
            }
        }

        // Add door/stairs positions
        for (const obj of dungeonData.objects || []) {
            if (obj.type.startsWith('door') || obj.type === 'stairs_up' || obj.type === 'stairs_down') {
                set.add(`${obj.x},${obj.y}`)
            }
        }

        return set
    }, [dungeonData])

    // ==========================================================================
    // Theme and Layer Data
    // ==========================================================================

    const theme = useMemo((): RoomLayerConfig => {
        return THEMES[themeName] || THEMES['Dungeon']
    }, [themeName])

    const themeColors = useMemo((): ThemeColors => {
        return configToThemeColors(theme)
    }, [theme])

    // Pre-compute wall positions
    const wallSet = useMemo(() => {
        // Get corridor tiles from assembled corridors
        const corridorTiles: { x: number, y: number }[] = []
        const corridors = (dungeonData as any).corridors as Array<{ id: string, tiles: { x: number, y: number }[] }> | undefined
        if (corridors) {
            for (const corridor of corridors) {
                for (const tile of corridor.tiles) {
                    corridorTiles.push({ x: tile.x, y: tile.y })
                }
            }
        }

        const rooms = dungeonData.rooms.map(roomToRenderData)

        const { wallSet } = calculateWalls({
            rooms,
            corridorTiles,
            gridWidth: dungeonData.gridWidth,
            gridHeight: dungeonData.gridHeight
        })

        return wallSet
    }, [dungeonData])

    // Floor layer data - includes room tiles AND corridor tiles
    const floorData = useMemo(() => {
        // Gather all corridor tiles from all corridor paths
        const corridorTiles: { x: number, y: number }[] = []

        // Get corridors from dungeonData.corridors (added by DungeonAssembler)
        const corridors = (dungeonData as any).corridors as Array<{ id: string, tiles: { x: number, y: number }[] }> | undefined
        if (corridors) {
            for (const corridor of corridors) {
                for (const tile of corridor.tiles) {
                    corridorTiles.push({ x: tile.x, y: tile.y })
                }
            }
        }

        return toFloorRenderData(dungeonData.rooms, corridorTiles)
    }, [dungeonData])

    // Wall layer data
    const wallData = useMemo(() => {
        return toWallRenderData(wallSet)
    }, [wallSet])

    // Grid layer data - includes grid for rooms AND corridors
    const gridData = useMemo(() => {
        const corridorTiles: { x: number, y: number }[] = []
        const corridors = (dungeonData as any).corridors as Array<{ id: string, tiles: { x: number, y: number }[] }> | undefined
        if (corridors) {
            for (const corridor of corridors) {
                for (const tile of corridor.tiles) {
                    corridorTiles.push({ x: tile.x, y: tile.y })
                }
            }
        }
        return toGridRenderData(dungeonData.rooms, corridorTiles)
    }, [dungeonData])

    // Label layer data - includes furthest room highlighting from analysis
    const labelData = useMemo(() => {
        const baseData = toLabelRenderData(dungeonData.rooms)

        // Add furthest room info if analysis is available
        if (analysisResult?.furthest && analysisResult.furthest.length > 0) {
            const furthestMap = new Map<string, { roomId: string, distance: number, rank: number }>()
            for (const f of analysisResult.furthest) {
                furthestMap.set(f.roomId, { roomId: f.roomId, distance: f.cost, rank: f.rank + 1 })
            }
            return {
                ...baseData,
                furthestMap,
                totalFurthest: analysisResult.furthest.length
            }
        }

        return baseData
    }, [dungeonData, analysisResult])

    // Background config
    const backgroundConfig = useMemo(() => {
        return {
            gridWidth: dungeonData.gridWidth,
            gridHeight: dungeonData.gridHeight,
            tileSize,
            padding: 2,
            theme: themeColors
        }
    }, [dungeonData, tileSize, themeColors])

    // Spine debug data
    const spineDebugData = useMemo(() => {
        if (!spineState) return null
        return toSpineDebugRenderData(
            spineState.spineTiles,
            spineState.roomSeeds
        )
    }, [spineState])

    // Walkmap data - uses existing walkableSet
    const walkmapData = useMemo(() => {
        return {
            walkableSet,
            gridWidth: dungeonData.gridWidth,
            gridHeight: dungeonData.gridHeight
        }
    }, [walkableSet, dungeonData])

    // Heatmap data - from spineState grid if available
    const heatmapData = useMemo(() => {
        if (!spineState?.grid) return null

        const tiles: { x: number, y: number, growthOrder: number }[] = []
        let maxGrowthOrder = 0

        for (let y = 0; y < spineState.grid.length; y++) {
            for (let x = 0; x < spineState.grid[y].length; x++) {
                const tile = spineState.grid[y][x]
                if (tile.growthOrder !== null && tile.growthOrder !== undefined) {
                    tiles.push({ x, y, growthOrder: tile.growthOrder })
                    if (tile.growthOrder > maxGrowthOrder) {
                        maxGrowthOrder = tile.growthOrder
                    }
                }
            }
        }

        return { tiles, maxGrowthOrder }
    }, [spineState])

    // Object layer data - doors, stairs, traps, etc.
    const objectData = useMemo(() => {
        if (!dungeonData.objects || dungeonData.objects.length === 0) return null

        return {
            objects: dungeonData.objects.map(obj => ({
                type: obj.type,
                position: { x: obj.x, y: obj.y },
                rotation: obj.rotation || 0,
                properties: obj.properties
            }))
        }
    }, [dungeonData])

    // ==========================================================================
    // Layer Hooks
    // ==========================================================================

    const { container: backgroundContainer } = useBackgroundLayer(backgroundConfig)
    const { container: floorContainer } = useFloorLayer(floorData, { tileSize, theme: themeColors })
    const { container: wallContainer } = useWallLayer(wallData, { tileSize, theme: themeColors })
    const { container: objectContainer } = useObjectLayer(objectData, { tileSize })
    const { container: gridContainer } = useGridLayer(showGrid ? gridData : null, { tileSize, theme: themeColors })
    const { container: labelContainer } = useLabelLayer(showRoomNumbers ? labelData : null, { tileSize, showRoomNumbers })
    const { container: spineDebugContainer } = useSpineDebugLayer(spineDebugData, { tileSize }, showSpineDebug)
    const { container: walkmapContainer } = useWalkmapLayer(showWalkmap ? walkmapData : null, { tileSize, alpha: 0.25 })
    const { container: heatmapContainer } = useHeatmapLayer(showHeatmap ? heatmapData : null, { tileSize, alpha: 0.4 })

    // ==========================================================================
    // Camera Controls
    // ==========================================================================

    // Calculate initial camera to center on dungeon
    useEffect(() => {
        // Guard: app must be fully initialized with screen
        if (!app || !app.screen) return

        const viewWidth = app.screen.width
        const viewHeight = app.screen.height

        // Guard: screen must have valid dimensions
        if (viewWidth === 0 || viewHeight === 0) return

        const contentWidth = dungeonData.gridWidth * tileSize
        const contentHeight = dungeonData.gridHeight * tileSize

        // Fit to view with padding
        const scaleX = viewWidth / contentWidth
        const scaleY = viewHeight / contentHeight
        const scale = Math.min(scaleX, scaleY) * 0.85

        // Center
        const x = (viewWidth - contentWidth * scale) / 2
        const y = (viewHeight - contentHeight * scale) / 2

        setCamera({ x, y, scale })
    }, [dungeonData, tileSize, app])

    // Pan handling
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // Right-click or middle-click for panning
        if (e.button === 1 || e.button === 2) {
            isDragging.current = true
            lastDrag.current = { x: e.clientX, y: e.clientY }
            e.preventDefault()
        }
    }, [])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging.current) return

        const dx = e.clientX - lastDrag.current.x
        const dy = e.clientY - lastDrag.current.y
        lastDrag.current = { x: e.clientX, y: e.clientY }

        setCamera(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
        }))
    }, [])

    const handlePointerUp = useCallback(() => {
        isDragging.current = false
    }, [])

    // Zoom handling - center-based zoom (PixiJS events don't have DOM rect)
    const handleWheel = useCallback((e: any) => {
        // PixiJS wheel event - use deltaY for zoom direction
        const delta = e.deltaY ?? e.nativeEvent?.deltaY ?? 0
        const zoomFactor = delta > 0 ? 0.9 : 1.1
        const minZoom = 0.1
        const maxZoom = 5

        setCamera(prev => {
            const newScale = Math.max(minZoom, Math.min(maxZoom, prev.scale * zoomFactor))

            // Center-based zoom (simpler, works with PixiJS events)
            // Get view center from app if available
            const viewWidth = app?.screen?.width ?? 800
            const viewHeight = app?.screen?.height ?? 600
            const centerX = viewWidth / 2
            const centerY = viewHeight / 2

            const scaleRatio = newScale / prev.scale
            const newX = centerX - (centerX - prev.x) * scaleRatio
            const newY = centerY - (centerY - prev.y) * scaleRatio

            return { x: newX, y: newY, scale: newScale }
        })
    }, [app])

    // ==========================================================================
    // Player Movement
    // ==========================================================================

    const movePlayer = useCallback((dx: number, dy: number) => {
        if (!playerEnabled) return

        const newX = playerPos.x + dx
        const newY = playerPos.y + dy
        const key = `${newX},${newY}`

        if (walkableSet.has(key)) {
            setPlayerPos({ x: newX, y: newY })
            onPlayerMove?.(newX, newY)
        }
    }, [playerEnabled, playerPos, walkableSet, onPlayerMove])

    // Keyboard controls
    useEffect(() => {
        if (!playerEnabled) return

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    movePlayer(0, -1)
                    e.preventDefault()
                    break
                case 'ArrowDown':
                case 's':
                case 'S':
                    movePlayer(0, 1)
                    e.preventDefault()
                    break
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    movePlayer(-1, 0)
                    e.preventDefault()
                    break
                case 'ArrowRight':
                case 'd':
                case 'D':
                    movePlayer(1, 0)
                    e.preventDefault()
                    break
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [playerEnabled, movePlayer])

    // ==========================================================================
    // Draw Callbacks
    // ==========================================================================

    const drawLayers = useCallback((g: Graphics) => {
        g.clear()

        // Remove existing children
        while (g.children.length > 0) {
            g.removeChildAt(0)
        }

        // Add layer containers in z-order
        const layers = [
            { container: backgroundContainer, zIndex: 0 },
            { container: floorContainer, zIndex: 10 },
            { container: wallContainer, zIndex: 20 },
            { container: objectContainer, zIndex: 30 },    // Doors, stairs, objects
            { container: walkmapContainer, zIndex: 35 },   // Walkmap overlay
            { container: heatmapContainer, zIndex: 36 },   // Heatmap overlay
            { container: gridContainer, zIndex: 40 },
            { container: spineDebugContainer, zIndex: 80 },
            { container: labelContainer, zIndex: 100 }
        ]

        for (const { container, zIndex } of layers) {
            if (container) {
                container.zIndex = zIndex
                g.addChild(container)
            }
        }
    }, [backgroundContainer, floorContainer, wallContainer, objectContainer, walkmapContainer, heatmapContainer, gridContainer, spineDebugContainer, labelContainer])

    const drawPlayer = useCallback((g: Graphics) => {
        if (!playerEnabled) {
            g.clear()
            return
        }

        g.clear()

        const px = playerPos.x * tileSize + tileSize / 2
        const py = playerPos.y * tileSize + tileSize / 2
        const radius = tileSize * 0.4

        // Glow effect
        g.circle(px, py, radius * 1.5)
        g.fill({ color: 0x22d3ee, alpha: 0.3 })

        // Player dot
        g.circle(px, py, radius)
        g.fill({ color: 0x22d3ee })

        // Border
        g.circle(px, py, radius)
        g.stroke({ color: 0xffffff, width: 2 })
    }, [playerEnabled, playerPos, tileSize])

    // ==========================================================================
    // Render
    // ==========================================================================

    const isReady = floorContainer && wallContainer

    if (!isReady) {
        return null
    }

    return (
        <pixiContainer
            ref={containerRef}
            x={camera.x}
            y={camera.y}
            scale={camera.scale}
            sortableChildren={true}
            eventMode="static"
            onPointerDown={handlePointerDown as any}
            onPointerMove={handlePointerMove as any}
            onPointerUp={handlePointerUp as any}
            onPointerUpOutside={handlePointerUp as any}
            onWheel={handleWheel as any}
        >
            {/* Dungeon layers */}
            <pixiGraphics draw={drawLayers} />

            {/* Player sprite */}
            <pixiGraphics draw={drawPlayer} zIndex={200} />
        </pixiContainer>
    )
}
