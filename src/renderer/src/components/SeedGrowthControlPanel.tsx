/**
 * Seed Growth Dungeon Control Panel
 * 
 * Floating UI panel for controlling the seed growth dungeon generator.
 * Supports real-time parameter adjustment, step/run modes, and debug overlays.
 */

import React, { useCallback, useRef } from 'react'
import { SeedGrowthSettings, createDefaultSettings, SeedPlacement, SymmetryAxis, RoomClassificationMode, DebugFlags } from '../engine/seed-growth/types'

interface SeedGrowthControlPanelProps {
    settings: SeedGrowthSettings
    onSettingsChange: (settings: SeedGrowthSettings) => void
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
}

const panelStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(20, 29, 31, 0.95)',
    border: '1px solid #bcd3d2',
    padding: 15,
    borderRadius: 8,
    width: 850,
    maxHeight: '40vh',
    overflowY: 'auto',
    color: '#bcd3d2',
    fontFamily: 'monospace',
    fontSize: 12,
    zIndex: 100,
    pointerEvents: 'auto'
}

const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 15,
    marginBottom: 10,
    alignItems: 'center',
    flexWrap: 'wrap'
}

const labelStyle: React.CSSProperties = {
    minWidth: 100,
    textAlign: 'right'
}

const sliderStyle: React.CSSProperties = {
    width: 100
}

const buttonStyle: React.CSSProperties = {
    padding: '5px 10px',
    backgroundColor: '#2e3f41',
    border: '1px solid #bcd3d2',
    color: '#bcd3d2',
    cursor: 'pointer',
    fontSize: 12
}

const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#4a5d5e'
}

export const SeedGrowthControlPanel: React.FC<SeedGrowthControlPanelProps> = ({
    settings,
    onSettingsChange,
    onRegenerate,
    onStep,
    onRunSteps,
    onRunToCompletion,
    tilesGrown,
    stepCount,
    isComplete,
    completionReason,
    isAnimating,
    onToggleAnimation
}) => {
    // Debounced settings update
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

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

    const randomizeSeed = useCallback(() => {
        updateSetting('seed', Math.floor(Math.random() * 1000000))
    }, [updateSetting])

    const resetDefaults = useCallback(() => {
        onSettingsChange(createDefaultSettings())
        setTimeout(onRegenerate, 50)
    }, [onSettingsChange, onRegenerate])

    const copyToClipboard = useCallback(async () => {
        try {
            const json = JSON.stringify(settings, null, 2)
            await navigator.clipboard.writeText(json)
            console.log('Settings copied to clipboard')
        } catch (err) {
            console.error('Failed to copy settings:', err)
        }
    }, [settings])

    const pasteFromClipboard = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText()
            const parsed = JSON.parse(text.trim()) // Trim whitespace
            // Validate it has expected fields
            if (typeof parsed.seed === 'number' && typeof parsed.gridWidth === 'number' && typeof parsed.tileBudget === 'number') {
                onSettingsChange(parsed)
                setTimeout(onRegenerate, 50)
                console.log('Settings loaded from clipboard:', parsed.seed)
            } else {
                console.error('Invalid settings format - missing required fields (seed, gridWidth, tileBudget)')
            }
        } catch (err) {
            console.error('Failed to paste settings - invalid JSON:', err)
        }
    }, [onSettingsChange, onRegenerate])

    return (
        <div style={panelStyle}>
            {/* Header */}
            <div style={{ ...rowStyle, justifyContent: 'space-between', borderBottom: '1px solid #444', paddingBottom: 10, marginBottom: 15 }}>
                <strong style={{ fontSize: 14 }}>SEED GROWTH DUNGEON</strong>
                <div style={{ display: 'flex', gap: 10 }}>
                    <span>Tiles: {tilesGrown} / {settings.tileBudget}</span>
                    <span>Step: {stepCount}</span>
                    <span style={{ color: isComplete ? '#4ad94a' : '#d9d94a' }}>
                        {isComplete ? `Done (${completionReason})` : 'Running'}
                    </span>
                </div>
            </div>

            {/* Row 1: Seed & Controls */}
            <div style={rowStyle}>
                <label style={labelStyle}>Seed:</label>
                <input
                    type="number"
                    value={settings.seed}
                    onChange={(e) => updateSetting('seed', parseInt(e.target.value) || 0)}
                    style={{ width: 80, background: '#333', color: '#fff', border: '1px solid #666', padding: 3 }}
                />
                <button style={buttonStyle} onClick={randomizeSeed}>🎲</button>
                <button style={buttonStyle} onClick={onRegenerate}>Regenerate</button>
                <button style={buttonStyle} onClick={resetDefaults}>Reset</button>
                <button style={buttonStyle} onClick={copyToClipboard} title="Copy settings to clipboard">📋 Copy</button>
                <button style={buttonStyle} onClick={pasteFromClipboard} title="Paste settings from clipboard">📥 Paste</button>
            </div>

            {/* Row 2: Grid Size & Budget */}
            <div style={rowStyle}>
                <label style={labelStyle}>Grid:</label>
                <input
                    type="number"
                    min={16}
                    max={100}
                    value={settings.gridWidth}
                    onChange={(e) => updateSetting('gridWidth', Math.min(100, Math.max(16, parseInt(e.target.value) || 64)))}
                    style={{ width: 50, background: '#333', color: '#fff', border: '1px solid #666', padding: 3 }}
                />
                <span>×</span>
                <input
                    type="number"
                    min={16}
                    max={100}
                    value={settings.gridHeight}
                    onChange={(e) => updateSetting('gridHeight', Math.min(100, Math.max(16, parseInt(e.target.value) || 64)))}
                    style={{ width: 50, background: '#333', color: '#fff', border: '1px solid #666', padding: 3 }}
                />

                <label style={{ marginLeft: 20 }}>Budget:</label>
                <input
                    type="range"
                    min={5}
                    max={80}
                    step={5}
                    value={Math.round(settings.tileBudget / (settings.gridWidth * settings.gridHeight) * 100)}
                    onChange={(e) => {
                        const percent = parseInt(e.target.value)
                        const budget = Math.floor(settings.gridWidth * settings.gridHeight * percent / 100)
                        updateSetting('tileBudget', budget)
                    }}
                    style={sliderStyle}
                />
                <span>{Math.round(settings.tileBudget / (settings.gridWidth * settings.gridHeight) * 100)}% ({settings.tileBudget})</span>
            </div>

            {/* Row 3: Seeds */}
            <div style={rowStyle}>
                <label style={labelStyle}>Seeds:</label>
                <input
                    type="range"
                    min={1}
                    max={12}
                    value={settings.seedCount}
                    onChange={(e) => updateSetting('seedCount', parseInt(e.target.value))}
                    style={{ width: 80 }}
                />
                <span>{settings.seedCount}</span>

                <label style={{ marginLeft: 20 }}>Placement:</label>
                <select
                    value={settings.seedPlacement}
                    onChange={(e) => updateSetting('seedPlacement', e.target.value as SeedPlacement)}
                    style={{ background: '#333', color: '#fff', border: '1px solid #666', padding: 3 }}
                >
                    <option value="center">Center</option>
                    <option value="random">Random</option>
                    <option value="symmetricPairs">Symmetric Pairs</option>
                </select>

                <label style={{ marginLeft: 20 }}>Min Dist:</label>
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

            {/* Row 4: Growth Physics */}
            <div style={rowStyle}>
                <label style={labelStyle}>Gamma:</label>
                <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.1}
                    value={settings.gamma}
                    onChange={(e) => updateSetting('gamma', parseFloat(e.target.value))}
                    style={sliderStyle}
                />
                <span>{settings.gamma.toFixed(1)}</span>

                <label style={{ marginLeft: 15 }}>Straight:</label>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.straightBias}
                    onChange={(e) => updateSetting('straightBias', parseFloat(e.target.value))}
                    style={{ width: 60 }}
                />
                <span>{settings.straightBias.toFixed(2)}</span>

                <label style={{ marginLeft: 15 }}>Turn:</label>
                <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.2}
                    value={settings.turnPenalty}
                    onChange={(e) => updateSetting('turnPenalty', parseFloat(e.target.value))}
                    style={{ width: 60 }}
                />
                <span>{settings.turnPenalty.toFixed(1)}</span>

                <label style={{ marginLeft: 15 }}>Branch:</label>
                <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.2}
                    value={settings.branchPenalty}
                    onChange={(e) => updateSetting('branchPenalty', parseFloat(e.target.value))}
                    style={{ width: 60 }}
                />
                <span>{settings.branchPenalty.toFixed(1)}</span>
            </div>

            {/* Row 5: Symmetry */}
            <div style={rowStyle}>
                <label style={labelStyle}>Symmetry:</label>
                <input
                    type="range"
                    min={0}
                    max={100}
                    value={settings.symmetry}
                    onChange={(e) => updateSetting('symmetry', parseInt(e.target.value))}
                    style={sliderStyle}
                />
                <span>{settings.symmetry}%</span>

                <label style={{ marginLeft: 20 }}>Axis:</label>
                <select
                    value={settings.symmetryAxis}
                    onChange={(e) => updateSetting('symmetryAxis', e.target.value as SymmetryAxis)}
                    style={{ background: '#333', color: '#fff', border: '1px solid #666', padding: 3 }}
                >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                </select>

                <label style={{ marginLeft: 15, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <input
                        type="checkbox"
                        checked={settings.symmetryStrict}
                        onChange={(e) => updateSetting('symmetryStrict', e.target.checked)}
                    />
                    Strict
                </label>
            </div>

            {/* Row 6: Room Classification */}
            <div style={rowStyle}>
                <label style={labelStyle}>Classification:</label>
                <select
                    value={settings.classificationMode}
                    onChange={(e) => updateSetting('classificationMode', e.target.value as RoomClassificationMode)}
                    style={{ background: '#333', color: '#fff', border: '1px solid #666', padding: 3 }}
                >
                    <option value="floodFill">Flood Fill (Simple)</option>
                    <option value="thickness">Thickness (Robust)</option>
                </select>

                <label style={{ marginLeft: 20 }}>Min Room:</label>
                <input
                    type="range"
                    min={4}
                    max={50}
                    value={settings.minRoomArea}
                    onChange={(e) => updateSetting('minRoomArea', parseInt(e.target.value))}
                    style={{ width: 60 }}
                />
                <span>{settings.minRoomArea}</span>

                <label style={{ marginLeft: 15 }}>Max Corridor:</label>
                <input
                    type="range"
                    min={1}
                    max={5}
                    value={settings.maxCorridorWidth}
                    onChange={(e) => updateSetting('maxCorridorWidth', parseInt(e.target.value))}
                    style={{ width: 60 }}
                />
                <span>{settings.maxCorridorWidth}</span>
            </div>

            {/* Row 7: Step Controls */}
            <div style={{ ...rowStyle, borderTop: '1px solid #444', paddingTop: 10 }}>
                <button style={buttonStyle} onClick={onStep}>Step</button>
                <button style={buttonStyle} onClick={() => onRunSteps(10)} disabled={isComplete}>+10</button>
                <button style={buttonStyle} onClick={() => onRunSteps(50)} disabled={isComplete}>+50</button>
                <button style={buttonStyle} onClick={() => onRunSteps(100)} disabled={isComplete}>+100</button>
                <button style={buttonStyle} onClick={onRunToCompletion} disabled={isComplete}>Run All</button>
                <button
                    style={isAnimating ? activeButtonStyle : buttonStyle}
                    onClick={onToggleAnimation}
                    disabled={isComplete}
                >
                    {isAnimating ? '⏸ Pause' : '▶ Animate'}
                </button>
            </div>

            {/* Row 8: Debug Toggles */}
            <div style={{ ...rowStyle, flexWrap: 'wrap', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input type="checkbox" checked={settings.debug.showRegions} onChange={(e) => updateDebug('showRegions', e.target.checked)} />
                    Regions
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input type="checkbox" checked={settings.debug.showFrontier} onChange={(e) => updateDebug('showFrontier', e.target.checked)} />
                    Frontier
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input type="checkbox" checked={settings.debug.showSymmetryAxis} onChange={(e) => updateDebug('showSymmetryAxis', e.target.checked)} />
                    Symmetry
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input type="checkbox" checked={settings.debug.showRoomBounds} onChange={(e) => updateDebug('showRoomBounds', e.target.checked)} />
                    Rooms
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input type="checkbox" checked={settings.debug.showCorridors} onChange={(e) => updateDebug('showCorridors', e.target.checked)} />
                    Corridors
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input type="checkbox" checked={settings.debug.showGrowthOrder} onChange={(e) => updateDebug('showGrowthOrder', e.target.checked)} />
                    Heatmap
                </label>
            </div>
        </div>
    )
}
