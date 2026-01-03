/**
 * DungeonTestPage
 * 
 * Integration test page for the new @pixi/react DungeonStage.
 * Generates a dungeon using the existing SpineSeedGenerator and DungeonAssembler,
 * then renders it with the new declarative components.
 * 
 * Access via game phase 'pixi-test' (press 'D' on loading screen)
 */

import { useState, useRef, useCallback, useMemo } from 'react'
import { PixiApplication } from './PixiApplication'
import { DungeonStage } from './stages/DungeonStage'
import { SpineSeedGenerator } from '@/engine/seed-growth/generators/SpineSeedGenerator'
import { DungeonAssembler } from '@/engine/seed-growth/generators/DungeonAssembler'
import { createDefaultSpineSeedSettings, DungeonData, SpineSeedState } from '@/engine/seed-growth/types'
import { useAppActions } from '@/stores/useAppStore'

// =============================================================================
// Component
// =============================================================================

export function DungeonTestPage() {
    const { setGamePhase } = useAppActions()
    const containerRef = useRef<HTMLDivElement>(null)

    // State
    const [dungeonData, setDungeonData] = useState<DungeonData | null>(null)
    const [spineState, setSpineState] = useState<SpineSeedState | null>(null)
    const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1_000_000))
    const [isGenerating, setIsGenerating] = useState(false)
    const [showSpineDebug, setShowSpineDebug] = useState(false)
    const [showGrid, setShowGrid] = useState(false)
    const [showRoomNumbers, setShowRoomNumbers] = useState(true)
    const [themeName, setThemeName] = useState('Dungeon')

    // Generate dungeon
    const generateDungeon = useCallback(() => {
        setIsGenerating(true)

        // Use requestAnimationFrame to avoid blocking UI
        requestAnimationFrame(() => {
            try {
                // Create settings with current seed
                const settings = createDefaultSpineSeedSettings()
                settings.seed = seed
                settings.gridWidth = 64
                settings.gridHeight = 64
                settings.seedCount = 16
                settings.spine.spineWidth = 3

                // Generate dungeon
                const generator = new SpineSeedGenerator(settings)
                generator.runToCompletion()

                const state = generator.getState()
                setSpineState(state)

                // Assemble final dungeon
                const data = DungeonAssembler.assembleSpine(state, settings)
                setDungeonData(data)

                console.log('[DungeonTestPage] Generated dungeon:', {
                    rooms: data.rooms.length,
                    spineLength: data.spine.length,
                    gridSize: `${data.gridWidth}x${data.gridHeight}`
                })
            } catch (error) {
                console.error('[DungeonTestPage] Generation failed:', error)
            } finally {
                setIsGenerating(false)
            }
        })
    }, [seed])

    // Random seed
    const randomizeSeed = useCallback(() => {
        setSeed(Math.floor(Math.random() * 1_000_000))
    }, [])

    // Style objects
    const styles = useMemo(() => ({
        container: {
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            display: 'flex',
            flexDirection: 'column' as const,
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#e0e0e0'
        },
        header: {
            padding: '1rem 2rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        },
        title: {
            margin: 0,
            fontSize: '1.5rem',
            background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
        },
        controls: {
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap' as const,
            alignItems: 'center',
            padding: '1rem 2rem',
            background: 'rgba(0, 0, 0, 0.2)'
        },
        button: {
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            background: '#7c3aed',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.2s'
        },
        buttonSecondary: {
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'transparent',
            color: '#e0e0e0',
            cursor: 'pointer',
            transition: 'all 0.2s'
        },
        input: {
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'white',
            width: '100px'
        },
        select: {
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(0, 0, 0, 0.3)',
            color: 'white'
        },
        canvasContainer: {
            flex: 1,
            margin: '1rem 2rem',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid rgba(124, 58, 237, 0.3)',
            background: '#000'
        },
        checkbox: {
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer'
        },
        label: {
            fontSize: '0.85rem',
            color: '#aaa'
        },
        stats: {
            fontSize: '0.8rem',
            color: '#888',
            marginLeft: 'auto'
        }
    }), [])

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>@pixi/react DungeonStage Test</h1>
                <p style={{ margin: '0.5rem 0 0', color: '#888', fontSize: '0.9rem' }}>
                    Testing the new declarative rendering layer
                </p>
            </div>

            {/* Controls */}
            <div style={styles.controls}>
                <label style={styles.label}>
                    Seed:
                    <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                        style={styles.input}
                    />
                </label>

                <button style={styles.buttonSecondary} onClick={randomizeSeed}>
                    🎲 Random
                </button>

                <button
                    style={{ ...styles.button, opacity: isGenerating ? 0.6 : 1 }}
                    onClick={generateDungeon}
                    disabled={isGenerating}
                >
                    {isGenerating ? '⏳ Generating...' : '⚡ Generate'}
                </button>

                <select
                    style={styles.select}
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                >
                    <option value="Dungeon">Dungeon</option>
                    <option value="Old School">Old School</option>
                    <option value="Rough Cavern">Rough Cavern</option>
                    <option value="None">None</option>
                </select>

                <label style={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                    />
                    Grid
                </label>

                <label style={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={showRoomNumbers}
                        onChange={(e) => setShowRoomNumbers(e.target.checked)}
                    />
                    Room #
                </label>

                <label style={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={showSpineDebug}
                        onChange={(e) => setShowSpineDebug(e.target.checked)}
                    />
                    Spine Debug
                </label>

                <button
                    style={styles.buttonSecondary}
                    onClick={() => setGamePhase('menu')}
                >
                    ← Back to Menu
                </button>

                {dungeonData && (
                    <span style={styles.stats}>
                        {dungeonData.rooms.length} rooms |
                        {dungeonData.spine.length} spine tiles |
                        {dungeonData.gridWidth}×{dungeonData.gridHeight}
                    </span>
                )}
            </div>

            {/* Canvas */}
            <div ref={containerRef} style={styles.canvasContainer}>
                {dungeonData ? (
                    <PixiApplication
                        resizeTo={containerRef}
                        backgroundColor={0x1a1a2e}
                    >
                        <DungeonStage
                            dungeonData={dungeonData}
                            spineState={spineState}
                            tileSize={8}
                            themeName={themeName}
                            showGrid={showGrid}
                            showRoomNumbers={showRoomNumbers}
                            showSpineDebug={showSpineDebug}
                        />
                    </PixiApplication>
                ) : (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <div style={{ fontSize: '4rem' }}>🏰</div>
                        <div>Click "Generate" to create a dungeon</div>
                    </div>
                )}
            </div>
        </div>
    )
}
