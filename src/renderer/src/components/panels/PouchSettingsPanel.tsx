/**
 * PouchSettingsPanel Component
 * 
 * Tab 1 content for the dungeon generator.
 * Contains all Pouch-level settings organized into logical sections:
 * - Grid (size, room count)
 * - Spine (forks, width, wall, straight, turn, branch, override)
 * - Ejection (count, side, interval, distance, dud%)
 * - Room Size (width, height ranges)
 * - Copy/Load/Save buttons
 */

import { CSSProperties } from 'react'
import { Toggle, RangeSlider, ValueSlider, SegmentedControl } from '@/components/ui'
import type { SpineSeedSettings, EjectionSide } from '@/engine/seed-growth/types'

// =============================================================================
// Types
// =============================================================================

interface PouchSettingsPanelProps {
    settings: SpineSeedSettings
    onSettingsChange: (settings: SpineSeedSettings) => void
    onCopyPouch?: () => void
    onLoadPouch?: () => void
    onSavePouch?: () => void
}

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
    section: {
        marginBottom: '1.25rem',
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
        gap: '0.75rem',
        marginBottom: '0.5rem',
        alignItems: 'center'
    },
    label: {
        fontSize: '0.85rem',
        color: '#aaa',
        width: '70px',
        flexShrink: 0
    },
    input: {
        width: '60px',
        padding: '0.4rem',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.3)',
        color: 'white',
        fontSize: '0.85rem',
        textAlign: 'center' as const
    },
    buttonRow: {
        display: 'flex',
        gap: '0.5rem',
        marginTop: '1rem'
    },
    button: {
        flex: 1,
        padding: '0.5rem',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(255,255,255,0.05)',
        color: '#e0e0e0',
        cursor: 'pointer',
        fontSize: '0.8rem',
        transition: 'all 0.2s'
    }
}

// =============================================================================
// Option Definitions
// =============================================================================

const SIDE_OPTIONS = [
    { value: 'left' as const, label: 'L' },
    { value: 'right' as const, label: 'R' },
    { value: 'both' as const, label: 'Both' },
    { value: 'any' as const, label: 'Any' }
]

const EJECTION_COUNT_OPTIONS = [
    { value: 1 as const, label: 'Single' },
    { value: 2 as const, label: 'Paired' },
    { value: 3 as const, label: 'Triplets' }
]

const OVERRIDE_OPTIONS = [
    { value: 'N' as const, label: 'N' },
    { value: 'S' as const, label: 'S' },
    { value: 'U' as const, label: 'U' },
    { value: 'F' as const, label: 'F' }
]

const SPINE_WIDTH_OPTIONS = [
    { value: 1, label: '1' },
    { value: 3, label: '3' },
    { value: 5, label: '5' },
    { value: 7, label: '7' }
]

// =============================================================================
// Component
// =============================================================================

export function PouchSettingsPanel({
    settings,
    onSettingsChange,
    onCopyPouch,
    onLoadPouch,
    onSavePouch
}: PouchSettingsPanelProps) {
    // Helper to update nested settings
    const updateSettings = (partial: Partial<SpineSeedSettings>) => {
        onSettingsChange({ ...settings, ...partial })
    }

    const updateSpine = (partial: Partial<SpineSeedSettings['spine']>) => {
        onSettingsChange({
            ...settings,
            spine: { ...settings.spine, ...partial }
        })
    }

    const updateEjection = (partial: Partial<SpineSeedSettings['ejection']>) => {
        onSettingsChange({
            ...settings,
            ejection: { ...settings.ejection, ...partial }
        })
    }

    const updateRoomGrowth = (partial: Partial<SpineSeedSettings['roomGrowth']>) => {
        onSettingsChange({
            ...settings,
            roomGrowth: { ...settings.roomGrowth, ...partial }
        })
    }

    return (
        <div>
            {/* ─────────────────────────────────────────────────────────────── */}
            {/* GRID SECTION */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Grid</div>

                <div style={styles.row}>
                    <span style={styles.label}>Size:</span>
                    <input
                        type="number"
                        value={settings.gridWidth}
                        onChange={(e) => {
                            const size = Number(e.target.value)
                            updateSettings({ gridWidth: size, gridHeight: size })
                        }}
                        style={styles.input}
                        min={32}
                        max={128}
                    />
                    <span style={{ color: '#666' }}>×</span>
                    <input
                        type="number"
                        value={settings.gridHeight}
                        onChange={(e) => updateSettings({ gridHeight: Number(e.target.value) })}
                        style={styles.input}
                        min={32}
                        max={128}
                    />
                </div>

                <div style={styles.row}>
                    <span style={styles.label}>Rooms:</span>
                    <input
                        type="number"
                        value={settings.seedCount}
                        onChange={(e) => updateSettings({ seedCount: Number(e.target.value) })}
                        style={styles.input}
                        min={4}
                        max={64}
                    />
                </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* SPINE SECTION */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Spine</div>

                <SegmentedControl
                    label="Spine Width"
                    options={SPINE_WIDTH_OPTIONS}
                    value={settings.spine.spineWidth}
                    onChange={(v) => updateSpine({ spineWidth: v })}
                />

                <div style={{ ...styles.row, marginTop: '0.75rem' }}>
                    <Toggle
                        checked={settings.spine.spineActsAsWall}
                        onChange={(checked) => updateSpine({ spineActsAsWall: checked })}
                        label="Acts as Wall"
                    />
                </div>

                <div style={styles.row}>
                    <Toggle
                        checked={settings.forceStraight}
                        onChange={(checked) => updateSettings({ forceStraight: checked })}
                        label="Force Straight"
                    />
                </div>

                <div style={styles.row}>
                    <span style={styles.label}>Forks:</span>
                    <input
                        type="number"
                        value={settings.spine.maxForks}
                        onChange={(e) => updateSpine({ maxForks: Number(e.target.value) })}
                        style={styles.input}
                        min={0}
                        max={5}
                    />
                </div>

                <ValueSlider
                    label="Turn Penalty"
                    value={settings.turnPenalty}
                    onChange={(v) => updateSettings({ turnPenalty: v })}
                    min={0}
                    max={20}
                    step={0.5}
                />

                <ValueSlider
                    label="Branch Penalty"
                    value={settings.branchPenalty}
                    onChange={(v) => updateSettings({ branchPenalty: v })}
                    min={0}
                    max={2}
                    step={0.1}
                    formatValue={(v) => v.toFixed(1)}
                />

                <SegmentedControl
                    label="Override"
                    options={OVERRIDE_OPTIONS}
                    value={settings.turnOverride}
                    onChange={(v) => updateSettings({ turnOverride: v })}
                />
            </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* EJECTION SECTION */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Ejection</div>

                <SegmentedControl
                    label="Count"
                    options={EJECTION_COUNT_OPTIONS}
                    value={settings.ejection.ejectionCount}
                    onChange={(v) => updateEjection({ ejectionCount: v as 1 | 2 | 3 })}
                />

                <SegmentedControl
                    label="Side"
                    options={SIDE_OPTIONS}
                    value={settings.ejection.ejectionSide}
                    onChange={(v) => updateEjection({ ejectionSide: v as EjectionSide })}
                />

                <RangeSlider
                    label="Interval"
                    value={[settings.ejection.minInterval, settings.ejection.maxInterval]}
                    onChange={([min, max]) => updateEjection({ minInterval: min, maxInterval: max })}
                    min={0}
                    max={15}
                />

                <RangeSlider
                    label="Distance"
                    value={[settings.ejection.minDistance, settings.ejection.maxDistance]}
                    onChange={([min, max]) => updateEjection({ minDistance: min, maxDistance: max })}
                    min={0}
                    max={15}
                />

                <ValueSlider
                    label="Dud %"
                    value={settings.ejection.dudChance * 100}
                    onChange={(v) => updateEjection({ dudChance: v / 100 })}
                    min={0}
                    max={50}
                    step={5}
                    formatValue={(v) => `${v}%`}
                />
            </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* ROOM SIZE SECTION */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Room Size</div>

                <RangeSlider
                    label="Width"
                    value={[settings.roomGrowth.minWidth, settings.roomGrowth.maxWidth]}
                    onChange={([min, max]) => updateRoomGrowth({ minWidth: min, maxWidth: max })}
                    min={1}
                    max={15}
                />

                <RangeSlider
                    label="Height"
                    value={[settings.roomGrowth.minHeight, settings.roomGrowth.maxHeight]}
                    onChange={([min, max]) => updateRoomGrowth({ minHeight: min, maxHeight: max })}
                    min={1}
                    max={15}
                />
            </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* SYMMETRY SECTION */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Symmetry</div>

                <ValueSlider
                    label="Chance"
                    value={settings.symmetry}
                    onChange={(v) => updateSettings({ symmetry: v })}
                    min={0}
                    max={100}
                    step={5}
                    formatValue={(v) => `${v}%`}
                />

                <div style={{ ...styles.row, marginTop: '0.75rem' }}>
                    <Toggle
                        checked={settings.symmetryStrictPrimary}
                        onChange={(checked) => updateSettings({ symmetryStrictPrimary: checked })}
                        label="Strict Primary"
                    />
                </div>

                <div style={styles.row}>
                    <Toggle
                        checked={settings.symmetryStrictSecondary}
                        onChange={(checked) => updateSettings({ symmetryStrictSecondary: checked })}
                        label="Strict Secondary"
                    />
                </div>

                <div style={styles.row}>
                    <Toggle
                        checked={settings.symmetryStrictTertiary}
                        onChange={(checked) => updateSettings({ symmetryStrictTertiary: checked })}
                        label="Strict Tertiary"
                    />
                </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* ACTIONS */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.buttonRow}>
                <button style={styles.button} onClick={onCopyPouch}>📋 Copy</button>
                <button style={styles.button} onClick={onLoadPouch}>📂 Load</button>
                <button style={styles.button} onClick={onSavePouch}>💾 Save</button>
            </div>
        </div>
    )
}
