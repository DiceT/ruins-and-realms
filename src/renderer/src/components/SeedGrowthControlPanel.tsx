/**
 * Seed Growth Dungeon Control Panel
 * 
 * Tabbed control panel for the seed growth dungeon generator.
 * Tabs: Main | Animation | Mask | Debug | Output
 * Supports two modes: Organic (blob-based) and Spine-Seed (rectangular rooms)
 */

import React, { useCallback, useRef, useState } from 'react'
import {
    SeedGrowthSettings,
    createDefaultSettings,
    SeedPlacement,
    SymmetryAxis,
    RoomClassificationMode,
    DebugFlags,
    MaskToolMode,
    SeedGrowthState,
    GeneratorMode,
    SpineSeedSettings,
    SpineSeedState,
    createDefaultSpineSeedSettings,
    EjectionSide,
    IntervalMode,
    GrowthDirection,
    CollisionBehavior
} from '../engine/seed-growth/types'
import { SeedGrowthDataModal } from './SeedGrowthDataModal'

type TabId = 'main' | 'animation' | 'mask' | 'debug' | 'output'

interface SeedGrowthControlPanelProps {
    // Generator mode
    generatorMode: GeneratorMode
    onGeneratorModeChange: (mode: GeneratorMode) => void

    // Organic mode settings
    settings: SeedGrowthSettings
    onSettingsChange: (settings: SeedGrowthSettings) => void

    // Spine-seed mode settings
    spineSeedSettings: SpineSeedSettings
    onSpineSeedSettingsChange: (settings: SpineSeedSettings) => void

    // Shared callbacks
    onRegenerate: () => void
    onStep: () => void
    onRunSteps: (n: number) => void
    onRunToCompletion: () => void
    tilesGrown: number
    stepCount: number
    isComplete: boolean
    completionReason: string | null
    isAnimating: boolean
    onToggleAnimation: () => void

    // Spine-seed specific status
    spineSeedPhase?: string

    // Mask tool props
    maskToolMode: MaskToolMode
    onMaskToolModeChange: (mode: MaskToolMode) => void
    brushSize: number
    onBrushSizeChange: (size: number) => void
    onClearMask: () => void
    blockedCount: number

    // State for output modals
    seedGrowthState: SeedGrowthState | null
    spineSeedState: SpineSeedState | null

    // View as Dungeon toggle
    viewAsDungeon: boolean
    onViewAsDungeonChange: (enabled: boolean) => void
}

// ============================================================================
// Styles
// ============================================================================

const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    color: '#bcd3d2',
    fontFamily: 'monospace',
    fontSize: 11,
    overflow: 'hidden'
}

const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid #444',
    flexShrink: 0
}

const tabStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace'
}

const activeTabStyle: React.CSSProperties = {
    ...tabStyle,
    color: '#bcd3d2',
    borderBottom: '2px solid #bcd3d2',
    marginBottom: -1
}

const contentStyle: React.CSSProperties = {
    flex: 1,
    padding: 12,
    overflowY: 'auto',
    minHeight: 0
}

const sectionStyle: React.CSSProperties = {
    marginBottom: 12
}

const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap'
}

const labelStyle: React.CSSProperties = {
    minWidth: 70,
    fontSize: 11,
    color: '#888'
}

const inputStyle: React.CSSProperties = {
    width: 50,
    background: '#333',
    color: '#fff',
    border: '1px solid #666',
    padding: '2px 4px',
    fontSize: 11
}

const sliderStyle: React.CSSProperties = {
    width: 80
}

const buttonStyle: React.CSSProperties = {
    padding: '4px 8px',
    backgroundColor: '#2e3f41',
    border: '1px solid #bcd3d2',
    color: '#bcd3d2',
    cursor: 'pointer',
    fontSize: 10
}

const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#4a5d5e'
}

const toggleGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 2
}

const checkboxLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11
}

const statusBarStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderTop: '1px solid #444',
    fontSize: 10,
    color: '#888',
    flexShrink: 0
}

// ============================================================================
// Component
// ============================================================================

export const SeedGrowthControlPanel: React.FC<SeedGrowthControlPanelProps> = ({
    generatorMode,
    onGeneratorModeChange,
    settings,
    onSettingsChange,
    spineSeedSettings,
    onSpineSeedSettingsChange,
    onRegenerate,
    onStep,
    onRunSteps,
    onRunToCompletion,
    tilesGrown,
    stepCount,
    isComplete,
    completionReason,
    isAnimating,
    onToggleAnimation,
    spineSeedPhase,
    maskToolMode,
    onMaskToolModeChange,
    brushSize,
    onBrushSizeChange,
    onClearMask,
    blockedCount,
    seedGrowthState,
    spineSeedState,
    viewAsDungeon,
    onViewAsDungeonChange
}) => {
    const [activeTab, setActiveTab] = useState<TabId>('main')
    const [modalData, setModalData] = useState<{ title: string; data: unknown } | null>(null)

    // Debounced settings update
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    // Organic mode setting updater
    const updateSetting = useCallback(<K extends keyof SeedGrowthSettings>(key: K, value: SeedGrowthSettings[K]) => {
        const newSettings = { ...settings, [key]: value }
        onSettingsChange(newSettings)

        // Debounced regenerate
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            onRegenerate()
        }, 200)
    }, [settings, onSettingsChange, onRegenerate])

    const updateDebug = useCallback(<K extends keyof DebugFlags>(key: K, value: DebugFlags[K]) => {
        const newDebug = { ...settings.debug, [key]: value }
        onSettingsChange({ ...settings, debug: newDebug })
    }, [settings, onSettingsChange])

    // Spine-seed mode setting updater
    const updateSpineSetting = useCallback(<K extends keyof SpineSeedSettings>(key: K, value: SpineSeedSettings[K]) => {
        const newSettings = { ...spineSeedSettings, [key]: value }
        onSpineSeedSettingsChange(newSettings)

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            onRegenerate()
        }, 200)
    }, [spineSeedSettings, onSpineSeedSettingsChange, onRegenerate])

    // Nested spine settings updaters
    const updateSpineConfig = useCallback(<K extends keyof SpineSeedSettings['spine']>(key: K, value: SpineSeedSettings['spine'][K]) => {
        updateSpineSetting('spine', { ...spineSeedSettings.spine, [key]: value })
    }, [spineSeedSettings, updateSpineSetting])

    const updateEjectionConfig = useCallback(<K extends keyof SpineSeedSettings['ejection']>(key: K, value: SpineSeedSettings['ejection'][K]) => {
        updateSpineSetting('ejection', { ...spineSeedSettings.ejection, [key]: value })
    }, [spineSeedSettings, updateSpineSetting])

    const updateRoomGrowthConfig = useCallback(<K extends keyof SpineSeedSettings['roomGrowth']>(key: K, value: SpineSeedSettings['roomGrowth'][K]) => {
        updateSpineSetting('roomGrowth', { ...spineSeedSettings.roomGrowth, [key]: value })
    }, [spineSeedSettings, updateSpineSetting])

    const randomizeSeed = useCallback(() => {
        if (generatorMode === 'organic') {
            updateSetting('seed', Math.floor(Math.random() * 1000000))
        } else {
            updateSpineSetting('seed', Math.floor(Math.random() * 1000000))
        }
    }, [generatorMode, updateSetting, updateSpineSetting])

    const resetDefaults = useCallback(() => {
        if (generatorMode === 'organic') {
            onSettingsChange(createDefaultSettings())
        } else {
            onSpineSeedSettingsChange(createDefaultSpineSeedSettings())
        }
        setTimeout(onRegenerate, 50)
    }, [generatorMode, onSettingsChange, onSpineSeedSettingsChange, onRegenerate])

    const copyToClipboard = useCallback(async () => {
        const data = generatorMode === 'organic' ? settings : spineSeedSettings
        const json = JSON.stringify(data, null, 2)
        await navigator.clipboard.writeText(json)
    }, [generatorMode, settings, spineSeedSettings])

    const pasteFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText()
            const parsed = JSON.parse(text.trim())
            if (typeof parsed.seed === 'number' && typeof parsed.gridWidth === 'number') {
                if (generatorMode === 'organic') {
                    onSettingsChange(parsed)
                } else {
                    // Basic validation for spine settings
                    if (parsed.spine) {
                        onSpineSeedSettingsChange(parsed)
                    } else {
                        console.warn('Invalid spine settings clipboard data')
                    }
                }
                setTimeout(onRegenerate, 50)
            }
        } catch { /* ignore */ }
    }, [generatorMode, onSettingsChange, onSpineSeedSettingsChange, onRegenerate])

    // ---- TABS ----
    const tabs: { id: TabId; label: string }[] = [
        { id: 'main', label: 'Main' },
        { id: 'animation', label: 'Anim' },
        { id: 'mask', label: 'Mask' },
        { id: 'debug', label: 'Debug' },
        { id: 'output', label: 'Output' }
    ]

    // ---- Toggle Button Helper ----
    const ToggleButton: React.FC<{
        active: boolean
        onClick: () => void
        children: React.ReactNode
    }> = ({ active, onClick, children }) => (
        <button style={active ? activeButtonStyle : buttonStyle} onClick={onClick}>
            {children}
        </button>
    )

    // ---- RENDER TAB CONTENT ----
    const renderMainTab = () => (
        <>
            {/* Generator Mode Toggle (Locked to Spine-Seed) */}
            <div style={{ ...sectionStyle, marginBottom: 12 }}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Mode:</span>
                    <div style={toggleGroupStyle}>
                        {/* <ToggleButton
                            active={generatorMode === 'organic'}
                            onClick={() => onGeneratorModeChange('organic')}
                        >
                            🌿 Organic
                        </ToggleButton> */}
                        <ToggleButton
                            active={true}
                            onClick={() => { }}
                        >
                            🦴 Spine-Seed
                        </ToggleButton>
                    </div>
                </div>
            </div>

            {/* View as Dungeon Toggle */}
            <div style={{ ...sectionStyle, marginBottom: 16 }}>
                <button
                    style={{
                        ...(viewAsDungeon ? activeButtonStyle : buttonStyle),
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: 12
                    }}
                    onClick={() => onViewAsDungeonChange(!viewAsDungeon)}
                >
                    {viewAsDungeon ? '✓ View as Dungeon' : 'View as Dungeon'}
                </button>
            </div>

            {/* Seed & Actions */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Seed:</span>
                    <input
                        type="number"
                        value={generatorMode === 'organic' ? settings.seed : spineSeedSettings.seed}
                        onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            if (generatorMode === 'organic') {
                                updateSetting('seed', val)
                            } else {
                                updateSpineSetting('seed', val)
                            }
                        }}
                        style={{ ...inputStyle, flex: 1 }}
                    />
                </div>
                <div style={{ ...rowStyle, justifyContent: 'flex-start' }}>
                    <button style={buttonStyle} onClick={randomizeSeed}>🎲</button>
                    <button style={buttonStyle} onClick={onRegenerate}>Regen</button>
                    <button style={buttonStyle} onClick={resetDefaults}>Reset</button>
                    <button style={buttonStyle} onClick={copyToClipboard}>📋 Copy</button>
                    <button style={buttonStyle} onClick={pasteFromClipboard}>📥 Paste</button>
                </div>
            </div>

            {/* Grid (shared between modes) */}
            <div style={sectionStyle}>
                <div style={rowStyle}>
                    <span style={labelStyle}>Grid:</span>
                    <input
                        type="number"
                        min={16}
                        max={100}
                        value={generatorMode === 'organic' ? settings.gridWidth : spineSeedSettings.gridWidth}
                        onChange={(e) => {
                            const val = Math.min(100, Math.max(16, parseInt(e.target.value) || 64))
                            if (generatorMode === 'organic') {
                                updateSetting('gridWidth', val)
                            } else {
                                updateSpineSetting('gridWidth', val)
                            }
                        }}
                        style={{ ...inputStyle, width: 40 }}
                    />
                    <span>×</span>
                    <input
                        type="number"
                        min={16}
                        max={100}
                        value={generatorMode === 'organic' ? settings.gridHeight : spineSeedSettings.gridHeight}
                        onChange={(e) => {
                            const val = Math.min(100, Math.max(16, parseInt(e.target.value) || 64))
                            if (generatorMode === 'organic') {
                                updateSetting('gridHeight', val)
                            } else {
                                updateSpineSetting('gridHeight', val)
                            }
                        }}
                        style={{ ...inputStyle, width: 40 }}
                    />
                </div>
                {/* Budget - only for organic mode */}
                {generatorMode === 'organic' && (
                    <div style={rowStyle}>
                        <span style={labelStyle}>Budget:</span>
                        <input
                            type="range"
                            min={5}
                            max={80}
                            step={5}
                            value={Math.round(settings.tileBudget / (settings.gridWidth * settings.gridHeight) * 100)}
                            onChange={(e) => {
                                const percent = parseInt(e.target.value)
                                updateSetting('tileBudget', Math.floor(settings.gridWidth * settings.gridHeight * percent / 100))
                            }}
                            style={sliderStyle}
                        />
                        <span>{Math.round(settings.tileBudget / (settings.gridWidth * settings.gridHeight) * 100)}%</span>
                    </div>
                )}
            </div >

            {/* ============== ORGANIC MODE SECTIONS ============== */}
            {generatorMode === 'organic' && (
                <>
                    {/* Seeds (organic only) */}
                    <div style={sectionStyle}>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Seeds:</span>
                            <input
                                type="range"
                                min={1}
                                max={24}
                                value={settings.seedCount}
                                onChange={(e) => updateSetting('seedCount', parseInt(e.target.value))}
                                style={{ width: 60 }}
                            />
                            <span>{settings.seedCount}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Placement:</span>
                            <div style={toggleGroupStyle}>
                                <ToggleButton active={settings.seedPlacement === 'center'} onClick={() => updateSetting('seedPlacement', 'center')}>
                                    Center
                                </ToggleButton>
                                <ToggleButton active={settings.seedPlacement === 'random'} onClick={() => updateSetting('seedPlacement', 'random')}>
                                    Random
                                </ToggleButton>
                                <ToggleButton active={settings.seedPlacement === 'symmetricPairs'} onClick={() => updateSetting('seedPlacement', 'symmetricPairs')}>
                                    Symmetric
                                </ToggleButton>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Min Dist:</span>
                            <input
                                type="range"
                                min={3}
                                max={30}
                                value={settings.minSeedDistance}
                                onChange={(e) => updateSetting('minSeedDistance', parseInt(e.target.value))}
                                style={{ width: 60 }}
                            />
                            <span>{settings.minSeedDistance}</span>
                        </div>
                    </div>

                    {/* Growth Physics (organic) */}
                    <div style={sectionStyle}>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Gamma:</span>
                            <input type="range" min={0.2} max={3} step={0.1} value={settings.gamma}
                                onChange={(e) => updateSetting('gamma', parseFloat(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.gamma.toFixed(1)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Straight:</span>
                            <input type="range" min={0} max={1} step={0.05} value={settings.straightBias}
                                onChange={(e) => updateSetting('straightBias', parseFloat(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.straightBias.toFixed(2)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Turn:</span>
                            <input type="range" min={0} max={5} step={0.2} value={settings.turnPenalty}
                                onChange={(e) => updateSetting('turnPenalty', parseFloat(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.turnPenalty.toFixed(1)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Branch:</span>
                            <input type="range" min={0} max={5} step={0.2} value={settings.branchPenalty}
                                onChange={(e) => updateSetting('branchPenalty', parseFloat(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.branchPenalty.toFixed(1)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Neighbors:</span>
                            <input type="range" min={1} max={4} step={1} value={settings.neighborLimit}
                                onChange={(e) => updateSetting('neighborLimit', parseInt(e.target.value))} style={{ width: 50 }} />
                            <span>{settings.neighborLimit}</span>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={settings.allowLoops} onChange={(e) => updateSetting('allowLoops', e.target.checked)} />
                                Loops %
                            </label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.round(settings.loopChance * 100)}
                                onChange={(e) => updateSetting('loopChance', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100)}
                                style={{ ...inputStyle, width: 35, padding: '1px 2px' }}
                            />
                        </div>
                    </div>

                    {/* Symmetry (organic) */}
                    <div style={sectionStyle}>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Symmetry:</span>
                            <input type="range" min={0} max={100} value={settings.symmetry}
                                onChange={(e) => updateSetting('symmetry', parseInt(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.symmetry}%</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Axis:</span>
                            <div style={toggleGroupStyle}>
                                <ToggleButton active={settings.symmetryAxis === 'vertical'} onClick={() => updateSetting('symmetryAxis', 'vertical')}>
                                    Vertical
                                </ToggleButton>
                                <ToggleButton active={settings.symmetryAxis === 'horizontal'} onClick={() => updateSetting('symmetryAxis', 'horizontal')}>
                                    Horizontal
                                </ToggleButton>
                            </div>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={settings.symmetryStrict} onChange={(e) => updateSetting('symmetryStrict', e.target.checked)} />
                                Strict
                            </label>
                        </div>
                    </div>

                    {/* Classification (organic only) */}
                    <div style={sectionStyle}>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Classify:</span>
                            <div style={toggleGroupStyle}>
                                <ToggleButton active={settings.classificationMode === 'floodFill'} onClick={() => updateSetting('classificationMode', 'floodFill')}>
                                    Flood
                                </ToggleButton>
                                <ToggleButton active={settings.classificationMode === 'thickness'} onClick={() => updateSetting('classificationMode', 'thickness')}>
                                    Thickness
                                </ToggleButton>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Min Room:</span>
                            <input type="range" min={4} max={50} value={settings.minRoomArea}
                                onChange={(e) => updateSetting('minRoomArea', parseInt(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.minRoomArea}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Max Room:</span>
                            <input type="range" min={20} max={200} step={10} value={settings.maxRoomArea}
                                onChange={(e) => updateSetting('maxRoomArea', parseInt(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.maxRoomArea}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Max Corr:</span>
                            <input type="range" min={1} max={5} value={settings.maxCorridorWidth}
                                onChange={(e) => updateSetting('maxCorridorWidth', parseInt(e.target.value))} style={{ width: 60 }} />
                            <span>{settings.maxCorridorWidth}</span>
                        </div>
                        <div style={rowStyle}>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={settings.collisionCorridors} onChange={(e) => updateSetting('collisionCorridors', e.target.checked)} />
                                Collision Corridors
                            </label>
                        </div>
                    </div>
                </>
            )}

            {/* ============== SPINE-SEED MODE SECTIONS ============== */}
            {generatorMode === 'spineSeed' && (
                <>
                    {/* Spine Settings */}
                    <div style={sectionStyle}>
                        <div style={{ ...rowStyle, color: '#9b59b6', fontWeight: 'bold', marginBottom: 4 }}>🦴 Spine</div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Seeds:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" min={1} max={32} value={spineSeedSettings.seedCount}
                                    onChange={(e) => updateSpineSetting('seedCount', Math.max(1, parseInt(e.target.value) || 1))}
                                    style={inputStyle} />
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <span style={labelStyle}>Max Forks:</span>
                            <input type="range" min={0} max={4} step={1} value={spineSeedSettings.spine.maxForks}
                                onChange={(e) => updateSpineConfig('maxForks', parseInt(e.target.value))} style={{ width: 60 }} />
                            <span>{spineSeedSettings.spine.maxForks}</span>
                        </div>


                        <div style={rowStyle}>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={spineSeedSettings.spine.spineActsAsWall}
                                    onChange={(e) => updateSpineConfig('spineActsAsWall', e.target.checked)} />
                                Acts as Wall
                            </label>
                        </div>
                    </div>

                    {/* Growth Physics (spine-seed) */}
                    <div style={sectionStyle}>

                        <div style={rowStyle}>
                            <span style={labelStyle}>Straight:</span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input type="range" min={0} max={1} step={0.05} value={spineSeedSettings.straightBias}
                                    onChange={(e) => updateSpineSetting('straightBias', parseFloat(e.target.value))} style={{ width: 60 }} />
                                <span>{spineSeedSettings.straightBias.toFixed(2)}</span>
                                <label style={{ ...checkboxLabelStyle, marginLeft: 8 }}>
                                    <input type="checkbox" checked={!!spineSeedSettings.forceStraight}
                                        onChange={(e) => updateSpineSetting('forceStraight', e.target.checked)} />
                                    Force
                                </label>
                            </div>
                            <div style={rowStyle}>
                                <span style={labelStyle}>Width:</span>
                                <input type="range" min={1} max={7} step={2} value={spineSeedSettings.spine.spineWidth}
                                    onChange={(e) => updateSpineConfig('spineWidth', parseInt(e.target.value) || 1)} style={{ width: 60 }} />
                                <span>{spineSeedSettings.spine.spineWidth}</span>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Override:</span>
                            <div style={toggleGroupStyle}>
                                <ToggleButton active={spineSeedSettings.turnOverride === 'N'} onClick={() => updateSpineSetting('turnOverride', 'N')}>N</ToggleButton>
                                <ToggleButton active={spineSeedSettings.turnOverride === 'S'} onClick={() => updateSpineSetting('turnOverride', 'S')}>S</ToggleButton>
                                <ToggleButton active={spineSeedSettings.turnOverride === 'U'} onClick={() => updateSpineSetting('turnOverride', 'U')}>U</ToggleButton>
                                <ToggleButton active={spineSeedSettings.turnOverride === 'F'} onClick={() => updateSpineSetting('turnOverride', 'F')}>F</ToggleButton>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Turn:</span>
                            <input type="range" min={0} max={25} step={1} value={spineSeedSettings.turnPenalty}
                                onChange={(e) => updateSpineSetting('turnPenalty', parseFloat(e.target.value))} style={{ width: 60 }} />
                            <span>{spineSeedSettings.turnPenalty.toFixed(1)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Branch:</span>
                            <input type="range" min={0} max={5} step={0.2} value={spineSeedSettings.branchPenalty}
                                onChange={(e) => updateSpineSetting('branchPenalty', parseFloat(e.target.value))} style={{ width: 60 }} />
                            <span>{spineSeedSettings.branchPenalty.toFixed(1)}</span>
                        </div>
                    </div>

                    {/* Seed Ejection */}
                    <div style={sectionStyle}>
                        <div style={{ ...rowStyle, color: '#f1c40f', fontWeight: 'bold', marginBottom: 4 }}>💫 Ejection</div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Interval:</span>
                            <input type="number" min={2} max={16} value={spineSeedSettings.ejection.minInterval}
                                onChange={(e) => updateEjectionConfig('minInterval', Math.max(2, parseInt(e.target.value) || 3))}
                                style={{ ...inputStyle, width: 35 }} />
                            <span>-</span>
                            <input type="number" min={2} max={16} value={spineSeedSettings.ejection.maxInterval}
                                onChange={(e) => updateEjectionConfig('maxInterval', Math.max(2, parseInt(e.target.value) || 8))}
                                style={{ ...inputStyle, width: 35 }} />
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Distance:</span>
                            <input type="number" min={0} max={24} value={spineSeedSettings.ejection.minDistance}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value)
                                    updateEjectionConfig('minDistance', Math.max(0, isNaN(val) ? 0 : val))
                                }}
                                style={{ ...inputStyle, width: 35 }} />
                            <span>-</span>
                            <input type="number" min={0} max={24} value={spineSeedSettings.ejection.maxDistance}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value)
                                    updateEjectionConfig('maxDistance', Math.max(0, isNaN(val) ? 12 : val))
                                }}
                                style={{ ...inputStyle, width: 35 }} />
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Side:</span>
                            <div style={toggleGroupStyle}>
                                <ToggleButton active={spineSeedSettings.ejection.ejectionSide === 'both'} onClick={() => updateEjectionConfig('ejectionSide', 'both')}>Both</ToggleButton>
                                <ToggleButton active={spineSeedSettings.ejection.ejectionSide === 'left'} onClick={() => updateEjectionConfig('ejectionSide', 'left')}>L</ToggleButton>
                                <ToggleButton active={spineSeedSettings.ejection.ejectionSide === 'right'} onClick={() => updateEjectionConfig('ejectionSide', 'right')}>R</ToggleButton>
                                <ToggleButton active={spineSeedSettings.ejection.ejectionSide === 'random'} onClick={() => updateEjectionConfig('ejectionSide', 'random')}>?</ToggleButton>
                            </div>
                        </div>
                        <div style={rowStyle}>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={spineSeedSettings.ejection.pairedEjection}
                                    onChange={(e) => updateEjectionConfig('pairedEjection', e.target.checked)} />
                                Paired
                            </label>
                            <span style={{ ...labelStyle, minWidth: 50 }}>Dud%:</span>
                            <input type="range" min={0} max={50} step={5} value={Math.round(spineSeedSettings.ejection.dudChance * 100)}
                                onChange={(e) => updateEjectionConfig('dudChance', parseInt(e.target.value) / 100)} style={{ width: 40 }} />
                            <span>{Math.round(spineSeedSettings.ejection.dudChance * 100)}</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Wall%:</span>
                            <input type="range" min={0} max={50} step={5} value={Math.round(spineSeedSettings.ejection.wallSeedChance * 100)}
                                onChange={(e) => updateEjectionConfig('wallSeedChance', parseInt(e.target.value) / 100)} style={{ width: 60 }} />
                            <span>{Math.round(spineSeedSettings.ejection.wallSeedChance * 100)}</span>
                        </div>
                    </div>

                    {/* Room Growth */}
                    <div style={sectionStyle}>
                        <div style={{ ...rowStyle, color: '#3498db', fontWeight: 'bold', marginBottom: 4 }}>📦 Rooms</div>
                        <div style={rowStyle}>
                            <span style={{ ...labelStyle, width: 25, minWidth: 25 }}>W:</span>
                            <input type="number" min={2} max={32} value={spineSeedSettings.roomGrowth.minWidth}
                                onChange={(e) => updateRoomGrowthConfig('minWidth', Math.max(2, parseInt(e.target.value) || 3))}
                                style={{ ...inputStyle, width: 35 }} />
                            <span>-</span>
                            <input type="number" min={2} max={32} value={spineSeedSettings.roomGrowth.maxWidth}
                                onChange={(e) => updateRoomGrowthConfig('maxWidth', Math.max(2, parseInt(e.target.value) || 9))}
                                style={{ ...inputStyle, width: 35 }} />
                            <span style={{ ...labelStyle, minWidth: 20 }}>H:</span>
                            <input type="number" min={2} max={32} value={spineSeedSettings.roomGrowth.minHeight}
                                onChange={(e) => updateRoomGrowthConfig('minHeight', Math.max(2, parseInt(e.target.value) || 3))}
                                style={{ ...inputStyle, width: 35 }} />
                            <span>-</span>
                            <input type="number" min={2} max={32} value={spineSeedSettings.roomGrowth.maxHeight}
                                onChange={(e) => updateRoomGrowthConfig('maxHeight', Math.max(2, parseInt(e.target.value) || 9))}
                                style={{ ...inputStyle, width: 35 }} />
                        </div>

                    </div>

                    {/* Symmetry (spine-seed) */}
                    <div style={sectionStyle}>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Symmetry:</span>
                            <input type="range" min={0} max={100} value={spineSeedSettings.symmetry}
                                onChange={(e) => updateSpineSetting('symmetry', parseInt(e.target.value))} style={{ width: 60 }} />
                            <span>{spineSeedSettings.symmetry}%</span>
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Strict:</span>
                            <label style={checkboxLabelStyle}>
                                <input type="checkbox" checked={!!spineSeedSettings.symmetryStrictPrimary} onChange={(e) => updateSpineSetting('symmetryStrictPrimary', e.target.checked)} />
                                Primary
                            </label>
                            <label style={{ ...checkboxLabelStyle, marginLeft: 8 }}>
                                <input type="checkbox" checked={!!spineSeedSettings.symmetryStrictSecondary} onChange={(e) => updateSpineSetting('symmetryStrictSecondary', e.target.checked)} />
                                Secondary
                            </label>
                        </div>

                    </div>
                </>
            )}
        </>
    )

    const renderAnimationTab = () => (
        <div style={sectionStyle}>
            <div style={rowStyle}>
                <button style={buttonStyle} onClick={onStep}>Step</button>
                <button style={buttonStyle} onClick={() => onRunSteps(10)} disabled={isComplete}>+10</button>
                <button style={buttonStyle} onClick={() => onRunSteps(50)} disabled={isComplete}>+50</button>
                <button style={buttonStyle} onClick={() => onRunSteps(100)} disabled={isComplete}>+100</button>
            </div>
            <div style={rowStyle}>
                <button style={buttonStyle} onClick={onRunToCompletion} disabled={isComplete}>Run All</button>
                <button style={isAnimating ? activeButtonStyle : buttonStyle} onClick={onToggleAnimation} disabled={isComplete}>
                    {isAnimating ? '⏸ Pause' : '▶ Animate'}
                </button>
            </div>
        </div>
    )

    const renderMaskTab = () => (
        <div style={sectionStyle}>
            <div style={rowStyle}>
                <span style={labelStyle}>Tool:</span>
                <div style={toggleGroupStyle}>
                    <ToggleButton active={maskToolMode === 'off'} onClick={() => onMaskToolModeChange('off')}>Off</ToggleButton>
                    <ToggleButton active={maskToolMode === 'paint'} onClick={() => onMaskToolModeChange('paint')}>🖌️ Paint</ToggleButton>
                    <ToggleButton active={maskToolMode === 'erase'} onClick={() => onMaskToolModeChange('erase')}>🧹 Erase</ToggleButton>
                </div>
            </div>
            <div style={rowStyle}>
                <span style={labelStyle}>Brush:</span>
                {[1, 2, 3, 5].map(size => (
                    <ToggleButton key={size} active={brushSize === size} onClick={() => onBrushSizeChange(size)}>
                        {size}
                    </ToggleButton>
                ))}
            </div>
            <div style={rowStyle}>
                <button style={buttonStyle} onClick={onClearMask}>Clear Mask</button>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showMask} onChange={(e) => updateDebug('showMask', e.target.checked)} />
                    Show Mask
                </label>
            </div>
            <div style={{ ...rowStyle, color: '#666' }}>
                Blocked: {blockedCount} ({Math.round(blockedCount / (settings.gridWidth * settings.gridHeight) * 100)}%)
            </div>
        </div>
    )

    const renderDebugTab = () => (
        <div style={sectionStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showRegions} onChange={(e) => updateDebug('showRegions', e.target.checked)} />
                    Show Regions
                </label>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showFrontier} onChange={(e) => updateDebug('showFrontier', e.target.checked)} />
                    Show Frontier
                </label>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showSymmetryAxis} onChange={(e) => updateDebug('showSymmetryAxis', e.target.checked)} />
                    Show Symmetry Axis
                </label>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showRoomBounds} onChange={(e) => updateDebug('showRoomBounds', e.target.checked)} />
                    Show Room Bounds
                </label>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showCorridors} onChange={(e) => updateDebug('showCorridors', e.target.checked)} />
                    Show Corridors
                </label>
                <label style={checkboxLabelStyle}>
                    <input type="checkbox" checked={settings.debug.showGrowthOrder} onChange={(e) => updateDebug('showGrowthOrder', e.target.checked)} />
                    Show Growth Heatmap
                </label>
            </div>
        </div>
    )

    const renderOutputTab = () => {
        if (generatorMode === 'spineSeed') {
            return (
                <div style={sectionStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Spine Mode Controls */}
                        <div style={{ padding: '4px 0', borderBottom: '1px solid #444', marginBottom: 4, color: '#888', fontSize: 10 }}>
                            SPINE DEBUG
                        </div>
                        <button style={buttonStyle} onClick={() => setModalData({ title: 'Grid', data: spineSeedState?.grid })}>
                            View Grid
                        </button>
                        <button style={buttonStyle} onClick={() => setModalData({ title: 'Spine Tiles', data: spineSeedState?.spineTiles })}>
                            View Spine ({spineSeedState?.spineTiles?.length ?? 0})
                        </button>
                        <button style={buttonStyle} onClick={() => setModalData({ title: 'Room Seeds', data: spineSeedState?.roomSeeds })}>
                            View Rooms ({spineSeedState?.roomSeeds?.length ?? 0})
                        </button>
                    </div>
                </div>
            )
        }

        return (
            <div style={sectionStyle}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button style={buttonStyle} onClick={() => setModalData({ title: 'Grid', data: seedGrowthState?.grid })}>
                        View Grid
                    </button>
                    <button style={buttonStyle} onClick={() => setModalData({ title: 'Rooms', data: seedGrowthState?.rooms })}>
                        View Rooms ({seedGrowthState?.rooms?.length ?? 0})
                    </button>
                    <button style={buttonStyle} onClick={() => setModalData({ title: 'Corridors', data: seedGrowthState?.corridors })}>
                        View Corridors ({seedGrowthState?.corridors?.length ?? 0})
                    </button>
                    <button style={buttonStyle} onClick={() => setModalData({ title: 'Connections', data: seedGrowthState?.connections })}>
                        View Connections ({seedGrowthState?.connections?.length ?? 0})
                    </button>
                    <button style={buttonStyle} onClick={() => setModalData({ title: 'Regions', data: seedGrowthState?.regions })}>
                        View Regions ({seedGrowthState?.regions?.size ?? 0})
                    </button>
                </div>
            </div>
        )
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'main': return renderMainTab()
            case 'animation': return renderAnimationTab()
            case 'mask': return renderMaskTab()
            case 'debug': return renderDebugTab()
            case 'output': return renderOutputTab()
        }
    }

    return (
        <div style={panelStyle}>
            {/* Tab Bar */}
            <div style={tabBarStyle}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        style={activeTab === tab.id ? activeTabStyle : tabStyle}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={contentStyle}>
                {renderTabContent()}
            </div>

            {/* Status Bar */}
            <div style={statusBarStyle}>
                <span>Tiles: {tilesGrown}/{settings.tileBudget}</span>
                <span>Step: {stepCount}</span>
                <span style={{ color: isComplete ? '#4ad94a' : '#d9d94a' }}>
                    {isComplete ? completionReason : 'Running'}
                </span>
            </div>

            {/* Data Modal */}
            <SeedGrowthDataModal
                isOpen={modalData !== null}
                onClose={() => setModalData(null)}
                title={modalData?.title ?? ''}
                data={modalData?.data}
            />
        </div>
    )
}
