/**
 * DungeonStage
 * 
 * Main dungeon rendering component using @pixi/react.
 * Composes all layer hooks to create a complete dungeon visualization.
 * 
 * This is the React-declarative replacement for DungeonViewRenderer.
 * It uses the existing layer classes via hooks, so all rendering logic is preserved.
 * 
 * @example
 * <PixiApplication width={800} height={600}>
 *   <DungeonStage 
 *     dungeonData={generatedDungeon}
 *     showGrid={true}
 *     showRoomNumbers={true}
 *   />
 * </PixiApplication>
 */

import { useEffect, useMemo, useRef, useCallback } from 'react'
import { Container as PixiContainer, Graphics } from 'pixi.js'

// Layer hooks
import {
    useFloorLayer,
    useWallLayer,
    useGridLayer,
    useLabelLayer,
    useBackgroundLayer,
    useSpineDebugLayer
} from '../hooks'

// Data adapters
import {
    toFloorRenderData,
    toWallRenderData,
    toGridRenderData,
    toLabelRenderData,
    toSpineDebugRenderData
} from '@/engine/systems/layers/LayerAdapters'

// Types
import { DungeonData, SpineSeedState, Room } from '@/engine/seed-growth/types'
import { calculateWalls } from '@/engine/processors/WallCalculator'
import { THEMES, RoomLayerConfig } from '@/engine/themes/ThemeTypes'
import { ThemeColors } from '@/engine/systems/layers/ILayer'
import { roomToRenderData } from '@/engine/systems/layers/LayerAdapters'

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

export interface DungeonStageProps {
    /** The generated dungeon data */
    dungeonData: DungeonData | null

    /** Optional spine state for debug overlay */
    spineState?: SpineSeedState | null

    /** Tile size in pixels */
    tileSize?: number

    /** Theme name (uses THEMES lookup) */
    themeName?: string

    /** Theme configuration (overrides themeName if provided) */
    themeConfig?: RoomLayerConfig

    // Visibility toggles
    showGrid?: boolean
    showRoomNumbers?: boolean
    showSpineDebug?: boolean

    /** View dimensions for centering (optional, defaults to auto-fit) */
    viewWidth?: number
    viewHeight?: number

    /** Callback when a room is clicked */
    onRoomClick?: (room: Room | null) => void
}

// =============================================================================
// Component
// =============================================================================

export function DungeonStage({
    dungeonData,
    spineState,
    tileSize = 8,
    themeName = 'Dungeon',
    themeConfig,
    showGrid = false,
    showRoomNumbers = true,
    showSpineDebug = false,
    viewWidth = 800,
    viewHeight = 600,
    onRoomClick: _onRoomClick
}: DungeonStageProps) {

    // Get theme configuration
    const theme = useMemo((): RoomLayerConfig => {
        if (themeConfig) return themeConfig
        return THEMES[themeName] || THEMES['Dungeon']
    }, [themeConfig, themeName])

    // Convert theme to layer-compatible colors (numbers instead of strings)
    const themeColors = useMemo((): ThemeColors => {
        return configToThemeColors(theme)
    }, [theme])

    // ==========================================================================
    // Prepare Layer Data
    // ==========================================================================

    // Pre-compute wall positions
    const wallSet = useMemo(() => {
        if (!dungeonData) return null

        const corridorTiles = dungeonData.spineWidth >= 3
            ? dungeonData.spine.map(t => ({ x: t.x, y: t.y }))
            : []

        const rooms = dungeonData.rooms.map(roomToRenderData)

        const { wallSet } = calculateWalls({
            rooms,
            corridorTiles,
            gridWidth: dungeonData.gridWidth,
            gridHeight: dungeonData.gridHeight
        })

        return wallSet
    }, [dungeonData])

    // Floor layer data
    const floorData = useMemo(() => {
        if (!dungeonData) return null
        const corridorTiles = dungeonData.spineWidth >= 3
            ? dungeonData.spine.map(t => ({ x: t.x, y: t.y }))
            : []
        return toFloorRenderData(dungeonData.rooms, corridorTiles)
    }, [dungeonData])

    // Wall layer data
    const wallData = useMemo(() => {
        if (!wallSet) return null
        return toWallRenderData(wallSet)
    }, [wallSet])

    // Grid layer data
    const gridData = useMemo(() => {
        if (!dungeonData) return null
        const corridorTiles = dungeonData.spineWidth >= 3
            ? dungeonData.spine.map(t => ({ x: t.x, y: t.y }))
            : []
        return toGridRenderData(dungeonData.rooms, corridorTiles)
    }, [dungeonData])

    // Label layer data
    const labelData = useMemo(() => {
        if (!dungeonData) return null
        return toLabelRenderData(dungeonData.rooms)
    }, [dungeonData])

    // Background config
    const backgroundConfig = useMemo(() => {
        if (!dungeonData) return null
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

    // ==========================================================================
    // Layer Hooks
    // ==========================================================================

    const { container: backgroundContainer } = useBackgroundLayer(backgroundConfig)

    const { container: floorContainer } = useFloorLayer(
        floorData,
        { tileSize, theme: themeColors }
    )

    const { container: wallContainer } = useWallLayer(
        wallData,
        { tileSize, theme: themeColors }
    )

    const { container: gridContainer } = useGridLayer(
        showGrid ? gridData : null,
        { tileSize, theme: themeColors }
    )

    const { container: labelContainer } = useLabelLayer(
        showRoomNumbers ? labelData : null,
        { tileSize, showRoomNumbers }
    )

    const { container: spineDebugContainer } = useSpineDebugLayer(
        spineDebugData,
        { tileSize },
        showSpineDebug
    )

    // ==========================================================================
    // Calculate transform for centering
    // ==========================================================================

    const transform = useMemo(() => {
        if (!dungeonData) return { x: 0, y: 0, scale: 1 }

        const contentWidth = dungeonData.gridWidth * tileSize
        const contentHeight = dungeonData.gridHeight * tileSize

        // Calculate scale to fit
        const scaleX = viewWidth / contentWidth
        const scaleY = viewHeight / contentHeight
        const scale = Math.min(scaleX, scaleY) * 0.9 // 90% padding

        // Calculate centering offset
        const x = (viewWidth - contentWidth * scale) / 2
        const y = (viewHeight - contentHeight * scale) / 2

        return { x, y, scale }
    }, [dungeonData, tileSize, viewWidth, viewHeight])

    // ==========================================================================
    // Draw callback for adding layer containers imperatively
    // ==========================================================================

    const drawLayers = useCallback((g: Graphics) => {
        // Clear the graphics (we use it as a container parent)
        g.clear()

        // Remove any existing children (for re-renders)
        while (g.children.length > 0) {
            g.removeChildAt(0)
        }

        // Add layer containers in z-order
        const layers = [
            { container: backgroundContainer, zIndex: 0 },
            { container: floorContainer, zIndex: 10 },
            { container: wallContainer, zIndex: 20 },
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
    }, [backgroundContainer, floorContainer, wallContainer, gridContainer, spineDebugContainer, labelContainer])

    // ==========================================================================
    // Render
    // ==========================================================================

    // Wait for essential containers to be ready
    const isReady = floorContainer && wallContainer

    if (!dungeonData || !isReady) {
        return null
    }

    return (
        <pixiContainer
            x={transform.x}
            y={transform.y}
            scale={transform.scale}
            sortableChildren={true}
        >
            <pixiGraphics draw={drawLayers} />
        </pixiContainer>
    )
}
