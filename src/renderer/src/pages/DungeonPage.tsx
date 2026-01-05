/**
 * DungeonPage
 * 
 * Main dungeon exploration page with generation controls and the DungeonView.
 * This replaces the dungeon mode of GameWindow.
 * 
 * Features:
 * - Tabbed control panel (Pouch / Seeds)
 * - Dungeon generation with full Pouch settings
 * - Theme selection
 * - Layer visibility toggles
 * - Player movement toggle
 * - Full screen dungeon view with pan/zoom
 */

import { useState, useRef, useCallback, useMemo, CSSProperties } from 'react'
import { PixiApplication } from '@/pixi-components/PixiApplication'
import { DungeonView } from '@/pixi-components/views/DungeonView'
import { SpineSeedGenerator } from '@/engine/seed-growth/generators/SpineSeedGenerator'
import { DungeonAssembler } from '@/engine/seed-growth/generators/DungeonAssembler'
import { createDefaultSpineSeedSettings, DungeonData, SpineSeedState, SpineSeedSettings } from '@/engine/seed-growth/types'
import { ManualSeedConfig } from '@/engine/seed-growth/SeedDefinitions'
import { useAppActions } from '@/stores/useAppStore'
import { TheRing } from '@/components/TheRing'
import { Toggle } from '@/components/ui'
import { PouchSettingsPanel, SeedQueuePanel } from '@/components/panels'
import { THEMES } from '@/engine/themes/ThemeTypes'
import { DungeonAnalysis, DungeonAnalysisResult } from '@/engine/analysis/DungeonAnalysis'

// =============================================================================
// Types
// =============================================================================

type TabId = 'pouch' | 'seeds' | 'display'

// =============================================================================
// Component
// =============================================================================

export function DungeonPage() {
    const { setGamePhase } = useAppActions()
    const containerRef = useRef<HTMLDivElement>(null)

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    // Generation state
    const [dungeonData, setDungeonData] = useState<DungeonData | null>(null)
    const [spineState, setSpineState] = useState<SpineSeedState | null>(null)
    const [analysisResult, setAnalysisResult] = useState<DungeonAnalysisResult | null>(null)
    const [settings, setSettings] = useState<SpineSeedSettings>(() => createDefaultSpineSeedSettings())
    const [isGenerating, setIsGenerating] = useState(false)

    // Seed queue (for manual seed configuration)
    const [seedQueue, setSeedQueue] = useState<ManualSeedConfig[]>([])

    // UI state
    const [activeTab, setActiveTab] = useState<TabId>('pouch')
    const [showGrid, setShowGrid] = useState(true)
    const [showRoomNumbers, setShowRoomNumbers] = useState(true)
    const [showSpineDebug, setShowSpineDebug] = useState(false)
    const [showWalkmap, setShowWalkmap] = useState(false)
    const [showHeatmap, setShowHeatmap] = useState(false)
    const [themeName, setThemeName] = useState('None')
    const [playerEnabled, setPlayerEnabled] = useState(false)
    const [showLeftPanel, setShowLeftPanel] = useState(true)
    const [showRing, setShowRing] = useState(false)

    // Player state
    const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 })

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────

    // Generate dungeon
    const generateDungeon = useCallback(() => {
        setIsGenerating(true)

        requestAnimationFrame(() => {
            try {
                // Inject manual seed queue into settings if present
                const genSettings: SpineSeedSettings = {
                    ...settings,
                    manualSeedQueue: seedQueue.length > 0 ? seedQueue : undefined
                }

                const generator = new SpineSeedGenerator(genSettings)
                generator.runToCompletion()

                const state = generator.getState()
                setSpineState(state)

                const data = DungeonAssembler.assembleSpine(state, genSettings)
                setDungeonData(data)

                // Run analysis for walkmap scores and furthest rooms
                const analysis = DungeonAnalysis.analyze(data)
                setAnalysisResult(analysis)

                // Reset player to start position
                const stairs = data.objects?.find(o => o.type === 'stairs_up')
                if (stairs) {
                    setPlayerPosition({ x: stairs.x, y: stairs.y })
                } else if (data.rooms.length > 0) {
                    const room = data.rooms[0]
                    setPlayerPosition({ x: room.centroid.x, y: room.centroid.y })
                }
            } catch (error) {
                console.error('[DungeonPage] Generation failed:', error)
            } finally {
                setIsGenerating(false)
            }
        })
    }, [settings, seedQueue])

    // Randomize seed and regenerate
    const randomize = useCallback(() => {
        const newSeed = Math.floor(Math.random() * 1_000_000)
        setSettings(prev => ({ ...prev, seed: newSeed }))
        // Trigger regeneration after state update
        setTimeout(() => {
            setIsGenerating(true)
            requestAnimationFrame(() => {
                try {
                    const genSettings: SpineSeedSettings = {
                        ...settings,
                        seed: newSeed,
                        manualSeedQueue: seedQueue.length > 0 ? seedQueue : undefined
                    }
                    const generator = new SpineSeedGenerator(genSettings)
                    generator.runToCompletion()
                    const state = generator.getState()
                    setSpineState(state)
                    const data = DungeonAssembler.assembleSpine(state, genSettings)
                    setDungeonData(data)

                    // Run analysis for walkmap scores and furthest rooms
                    const analysis = DungeonAnalysis.analyze(data)
                    setAnalysisResult(analysis)

                    const stairs = data.objects?.find(o => o.type === 'stairs_up')
                    if (stairs) {
                        setPlayerPosition({ x: stairs.x, y: stairs.y })
                    } else if (data.rooms.length > 0) {
                        const room = data.rooms[0]
                        setPlayerPosition({ x: room.centroid.x, y: room.centroid.y })
                    }
                } catch (error) {
                    console.error('[DungeonPage] Generation failed:', error)
                } finally {
                    setIsGenerating(false)
                }
            })
        }, 0)
    }, [settings, seedQueue])

    // Handle player movement
    const handlePlayerMove = useCallback((x: number, y: number) => {
        setPlayerPosition({ x, y })
    }, [])

    // Copy Pouch settings to clipboard
    const handleCopyPouch = useCallback(() => {
        const pouchData = {
            settings,
            seedQueue
        }
        navigator.clipboard.writeText(JSON.stringify(pouchData, null, 2))
    }, [settings, seedQueue])

    // Load Pouch settings from clipboard
    const handleLoadPouch = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText()
            const pouchData = JSON.parse(text)
            if (pouchData.settings) {
                setSettings(pouchData.settings)
            }
            if (pouchData.seedQueue) {
                setSeedQueue(pouchData.seedQueue)
            }
        } catch (error) {
            console.error('[DungeonPage] Failed to load Pouch:', error)
        }
    }, [])

    // Save Pouch (same as copy for now)
    const handleSavePouch = handleCopyPouch

    // Copy individual seed to clipboard
    const handleCopySeed = useCallback((seed: ManualSeedConfig) => {
        navigator.clipboard.writeText(JSON.stringify(seed, null, 2))
    }, [])

    // ─────────────────────────────────────────────────────────────────────────
    // Styles
    // ─────────────────────────────────────────────────────────────────────────

    const styles = useMemo((): Record<string, CSSProperties> => ({
        container: {
            width: '100vw',
            height: '100vh',
            display: 'flex',
            background: '#0a0a0f',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#e0e0e0',
            overflow: 'hidden'
        },
        leftPanel: {
            width: showLeftPanel ? '340px' : '0px',
            minWidth: showLeftPanel ? '340px' : '0px',
            height: '100%',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
            transition: 'width 0.3s, min-width 0.3s',
            display: 'flex',
            flexDirection: 'column'
        },
        panelHeader: {
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        },
        panelTitle: {
            margin: 0,
            fontSize: '1.1rem',
            background: 'linear-gradient(90deg, #7c3aed, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
        },
        tabs: {
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
        },
        tab: {
            flex: 1,
            padding: '0.75rem',
            border: 'none',
            background: 'transparent',
            color: '#888',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            transition: 'all 0.2s',
            borderBottom: '2px solid transparent'
        },
        tabActive: {
            color: '#e0e0e0',
            borderBottom: '2px solid #7c3aed'
        },
        panelContent: {
            flex: 1,
            overflow: 'auto',
            padding: '1rem 1.25rem'
        },
        section: {
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px'
        },
        sectionTitle: {
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#7c3aed',
            marginBottom: '0.75rem',
            fontWeight: 600
        },
        row: {
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            alignItems: 'center'
        },
        input: {
            flex: 1,
            padding: '0.4rem',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.3)',
            color: 'white',
            fontSize: '0.85rem'
        },
        button: {
            padding: '0.6rem 1.2rem',
            borderRadius: '6px',
            border: 'none',
            background: '#7c3aed',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '0.9rem',
            transition: 'all 0.2s'
        },
        buttonSecondary: {
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'transparent',
            color: '#e0e0e0',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'all 0.2s'
        },
        select: {
            flex: 1,
            padding: '0.4rem',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.3)',
            color: 'white',
            fontSize: '0.85rem'
        },
        mainArea: {
            flex: 1,
            position: 'relative',
            overflow: 'hidden'
        },
        togglePanelBtn: {
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            zIndex: 100,
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1.2rem'
        },
        stats: {
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            zIndex: 100,
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.7)',
            fontSize: '0.8rem',
            color: '#aaa'
        },
        emptyState: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666'
        },
        footer: {
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid rgba(255,255,255,0.1)'
        }
    }), [showLeftPanel])

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div style={styles.container}>
            {/* Left Control Panel */}
            <div style={styles.leftPanel}>
                {/* Header */}
                <div style={styles.panelHeader}>
                    <h1 style={styles.panelTitle}>Dungeon Generator</h1>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'pouch' ? styles.tabActive : {})
                        }}
                        onClick={() => setActiveTab('pouch')}
                    >
                        Pouch
                    </button>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'seeds' ? styles.tabActive : {})
                        }}
                        onClick={() => setActiveTab('seeds')}
                    >
                        Seeds ({seedQueue.length})
                    </button>
                    <button
                        style={{
                            ...styles.tab,
                            ...(activeTab === 'display' ? styles.tabActive : {})
                        }}
                        onClick={() => setActiveTab('display')}
                    >
                        Display
                    </button>
                </div>

                {/* Tab Content */}
                <div style={styles.panelContent}>
                    {activeTab === 'pouch' ? (
                        <>
                            {/* Generation Section */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>Generation</div>
                                <div style={styles.row}>
                                    <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Seed:</span>
                                    <input
                                        type="number"
                                        value={settings.seed}
                                        onChange={(e) => setSettings(prev => ({ ...prev, seed: Number(e.target.value) }))}
                                        style={styles.input}
                                    />
                                    <button style={styles.buttonSecondary} onClick={randomize}>🎲</button>
                                </div>
                                <div style={{ ...styles.row, marginTop: '0.75rem' }}>
                                    <button
                                        style={{ ...styles.button, flex: 1, opacity: isGenerating ? 0.6 : 1 }}
                                        onClick={generateDungeon}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? '⏳ Generating...' : '⚡ Generate Dungeon'}
                                    </button>
                                </div>
                            </div>

                            {/* Pouch Settings */}
                            <PouchSettingsPanel
                                settings={settings}
                                onSettingsChange={setSettings}
                                onCopyPouch={handleCopyPouch}
                                onLoadPouch={handleLoadPouch}
                                onSavePouch={handleSavePouch}
                            />
                        </>
                    ) : activeTab === 'seeds' ? (
                        <SeedQueuePanel
                            queue={seedQueue}
                            onQueueChange={setSeedQueue}
                            onCopySeed={handleCopySeed}
                        />
                    ) : (
                        <>
                            {/* Display Section */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>Overlays</div>
                                <Toggle checked={showGrid} onChange={setShowGrid} label="Grid" />
                                <Toggle checked={showRoomNumbers} onChange={setShowRoomNumbers} label="Room Numbers" />
                                <Toggle checked={showSpineDebug} onChange={setShowSpineDebug} label="Spine Debug" />
                                <Toggle checked={showWalkmap} onChange={setShowWalkmap} label="Walkmap" />
                                <Toggle checked={showHeatmap} onChange={setShowHeatmap} label="Heat Map" />
                                <Toggle checked={showRing} onChange={setShowRing} label="✨ The Ring" />
                            </div>

                            {/* Theme Section */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>Theme</div>
                                <select
                                    style={styles.select}
                                    value={themeName}
                                    onChange={(e) => setThemeName(e.target.value)}
                                >
                                    <optgroup label="Domains">
                                        <option value="Dungeon">Dungeon (Prison)</option>
                                        <option value="Castle">Castle</option>
                                        <option value="Temple">Temple</option>
                                        <option value="Cavern">Cavern</option>
                                        <option value="Catacombs">Catacombs</option>
                                        <option value="Lair">Lair</option>
                                        <option value="Mine">Mine</option>
                                        <option value="Ruins">Ruins</option>
                                    </optgroup>
                                    <optgroup label="Other">
                                        <option value="Old School">Old School</option>
                                        <option value="None">None (Debug)</option>
                                    </optgroup>
                                </select>
                            </div>

                            {/* Player Section */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>Player</div>
                                <Toggle
                                    checked={playerEnabled}
                                    onChange={setPlayerEnabled}
                                    label="Enable Player (WASD/Arrows)"
                                />
                                {playerEnabled && dungeonData && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
                                        Position: ({playerPosition.x}, {playerPosition.y})
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button
                        style={{ ...styles.buttonSecondary, width: '100%' }}
                        onClick={() => setGamePhase('menu')}
                    >
                        ← Back to Menu
                    </button>
                </div>
            </div>

            {/* Main Dungeon View */}
            <div style={styles.mainArea} ref={containerRef}>
                {/* Toggle Panel Button */}
                <button
                    style={styles.togglePanelBtn}
                    onClick={() => setShowLeftPanel(!showLeftPanel)}
                    title={showLeftPanel ? 'Hide Panel' : 'Show Panel'}
                >
                    {showLeftPanel ? '◀' : '▶'}
                </button>

                {dungeonData ? (
                    <>
                        <PixiApplication
                            resizeTo={containerRef}
                            backgroundColor={parseColor(THEMES[themeName]?.background || '#1a1a2e')}
                        >
                            <DungeonView
                                dungeonData={dungeonData}
                                spineState={spineState}
                                analysisResult={analysisResult}
                                themeName={themeName}
                                showGrid={showGrid}
                                showRoomNumbers={showRoomNumbers}
                                showSpineDebug={showSpineDebug}
                                showWalkmap={showWalkmap}
                                showHeatmap={showHeatmap}
                                playerEnabled={playerEnabled}
                                initialPlayerPosition={playerPosition}
                                onPlayerMove={handlePlayerMove}
                            />
                        </PixiApplication>

                        {/* Stats Overlay */}
                        <div style={styles.stats}>
                            {dungeonData.rooms.length} rooms • {dungeonData.gridWidth}×{dungeonData.gridHeight} • Seed: {settings.seed}
                        </div>
                    </>
                ) : !showRing ? (
                    <div style={styles.emptyState}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏰</div>
                        <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Dungeon Generated</div>
                        <div style={{ fontSize: '0.9rem' }}>Click "Generate Dungeon" to begin</div>
                    </div>
                ) : null}

                {/* The Ring Overlay */}
                <TheRing visible={showRing} size={Math.min(800, window.innerHeight * 0.8)} />
            </div>
        </div>
    )
}

// =============================================================================
// Helpers
// =============================================================================

function parseColor(color: string): number {
    if (color.startsWith('#')) {
        return parseInt(color.slice(1), 16)
    }
    return parseInt(color.replace('0x', ''), 16)
}
