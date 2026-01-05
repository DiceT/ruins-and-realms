/**
 * SeedQueuePanel Component
 * 
 * Tab 2 content for the dungeon generator.
 * Contains the seed queue list and individual seed editor:
 * - Scrollable list of seeds in the pouch
 * - Click to select and edit
 * - Add/Remove/Copy functionality
 */

import { CSSProperties, useState, useCallback } from 'react'
import { RangeSlider, SegmentedControl } from '@/components/ui'
import type { ManualSeedConfig, SeedSide } from '@/engine/seed-growth/SeedDefinitions'

// =============================================================================
// Types
// =============================================================================

interface SeedQueuePanelProps {
    /** Current seed queue */
    queue: ManualSeedConfig[]
    /** Callback to update the entire queue */
    onQueueChange: (queue: ManualSeedConfig[]) => void
    /** Callback when a seed JSON is copied */
    onCopySeed?: (seed: ManualSeedConfig) => void
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
    queueList: {
        maxHeight: '200px',
        overflowY: 'auto' as const,
        marginBottom: '0.5rem'
    },
    queueItem: {
        display: 'flex',
        alignItems: 'center',
        padding: '0.5rem',
        marginBottom: '4px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        transition: 'all 0.15s'
    },
    queueItemNumber: {
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.75rem',
        marginRight: '0.5rem',
        flexShrink: 0
    },
    queueItemName: {
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const
    },
    queueItemDomain: {
        fontSize: '0.7rem',
        color: '#888',
        marginLeft: '0.5rem'
    },
    addButton: {
        width: '100%',
        padding: '0.5rem',
        borderRadius: '4px',
        border: '1px dashed rgba(255,255,255,0.3)',
        background: 'transparent',
        color: '#888',
        cursor: 'pointer',
        fontSize: '0.85rem'
    },
    row: {
        display: 'flex',
        gap: '0.5rem',
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
        flex: 1,
        padding: '0.4rem',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0,0,0,0.3)',
        color: 'white',
        fontSize: '0.85rem'
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
    },
    deleteButton: {
        flex: 1,
        padding: '0.5rem',
        borderRadius: '6px',
        border: '1px solid rgba(255,100,100,0.3)',
        background: 'rgba(255,100,100,0.1)',
        color: '#ff6666',
        cursor: 'pointer',
        fontSize: '0.8rem',
        transition: 'all 0.2s'
    },
    emptyState: {
        textAlign: 'center' as const,
        color: '#666',
        padding: '2rem',
        fontSize: '0.9rem'
    }
}

// =============================================================================
// Constants
// =============================================================================

const SIDE_OPTIONS = [
    { value: 'left' as const, label: 'L' },
    { value: 'right' as const, label: 'R' },
    { value: 'both' as const, label: 'Both' },
    { value: 'any' as const, label: 'Any' }
]

const DOMAINS = ['Any', 'Castle', 'Temple', 'Ruins', 'Mine', 'Dungeon', 'Lair', 'Cavern', 'Catacomb']

// =============================================================================
// Helpers
// =============================================================================

function createEmptySeed(): ManualSeedConfig {
    return {
        schemaVersion: 1,
        type: 'Room',
        domain: 'Any',
        interval: { min: 3, max: 7 },
        distance: { min: 3, max: 7 },
        width: { min: 3, max: 7 },
        height: { min: 3, max: 7 },
        side: 'any'
    }
}

function getRangeValue(value: number | { min: number; max: number } | undefined): [number, number] {
    if (value === undefined) return [3, 7]
    if (typeof value === 'number') return [value, value]
    return [value.min, value.max]
}

// =============================================================================
// Component
// =============================================================================

export function SeedQueuePanel({
    queue,
    onQueueChange,
    onCopySeed
}: SeedQueuePanelProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const selectedSeed = selectedIndex !== null ? queue[selectedIndex] : null

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────

    const handleAddSeed = useCallback(() => {
        const newQueue = [...queue, createEmptySeed()]
        onQueueChange(newQueue)
        setSelectedIndex(newQueue.length - 1)
    }, [queue, onQueueChange])

    const handleRemoveSeed = useCallback(() => {
        if (selectedIndex === null) return
        const newQueue = queue.filter((_, i) => i !== selectedIndex)
        onQueueChange(newQueue)
        setSelectedIndex(null)
    }, [queue, selectedIndex, onQueueChange])

    const handleUpdateSeed = useCallback((partial: Partial<ManualSeedConfig>) => {
        if (selectedIndex === null) return
        const newQueue = [...queue]
        newQueue[selectedIndex] = { ...newQueue[selectedIndex], ...partial }
        onQueueChange(newQueue)
    }, [queue, selectedIndex, onQueueChange])

    const handleCopySeed = useCallback(() => {
        if (selectedSeed && onCopySeed) {
            onCopySeed(selectedSeed)
        }
    }, [selectedSeed, onCopySeed])

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div>
            {/* ─────────────────────────────────────────────────────────────── */}
            {/* SEED QUEUE LIST */}
            {/* ─────────────────────────────────────────────────────────────── */}
            <div style={styles.section}>
                <div style={styles.sectionTitle}>Seed Queue ({queue.length})</div>

                <div style={styles.queueList}>
                    {queue.map((seed, index) => {
                        const isSelected = index === selectedIndex
                        return (
                            <div
                                key={index}
                                style={{
                                    ...styles.queueItem,
                                    background: isSelected
                                        ? 'rgba(124, 58, 237, 0.3)'
                                        : 'rgba(255,255,255,0.05)',
                                    borderLeft: isSelected
                                        ? '3px solid #7c3aed'
                                        : '3px solid transparent'
                                }}
                                onClick={() => setSelectedIndex(index)}
                            >
                                <div style={styles.queueItemNumber}>{index + 1}</div>
                                <span style={styles.queueItemName}>
                                    {seed.type || 'Unnamed'}
                                </span>
                                {seed.domain && seed.domain !== 'Any' && (
                                    <span style={styles.queueItemDomain}>
                                        ({seed.domain})
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>

                <button style={styles.addButton} onClick={handleAddSeed}>
                    + Add Seed
                </button>
            </div>

            {/* ─────────────────────────────────────────────────────────────── */}
            {/* SEED EDITOR */}
            {/* ─────────────────────────────────────────────────────────────── */}
            {selectedSeed ? (
                <div style={styles.section}>
                    <div style={styles.sectionTitle}>Edit Seed #{selectedIndex! + 1}</div>

                    <div style={styles.row}>
                        <span style={styles.label}>Type:</span>
                        <input
                            type="text"
                            value={selectedSeed.type || ''}
                            onChange={(e) => handleUpdateSeed({ type: e.target.value })}
                            style={styles.input}
                            placeholder="e.g., Guard Room"
                        />
                    </div>

                    <div style={styles.row}>
                        <span style={styles.label}>Domain:</span>
                        <select
                            value={selectedSeed.domain || 'Any'}
                            onChange={(e) => handleUpdateSeed({ domain: e.target.value })}
                            style={styles.select}
                        >
                            {DOMAINS.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <RangeSlider
                        label="Interval"
                        value={getRangeValue(selectedSeed.interval)}
                        onChange={([min, max]) => handleUpdateSeed({ interval: { min, max } })}
                        min={0}
                        max={15}
                    />

                    <RangeSlider
                        label="Distance"
                        value={getRangeValue(selectedSeed.distance)}
                        onChange={([min, max]) => handleUpdateSeed({ distance: { min, max } })}
                        min={0}
                        max={15}
                    />

                    <RangeSlider
                        label="Width"
                        value={getRangeValue(selectedSeed.width)}
                        onChange={([min, max]) => handleUpdateSeed({ width: { min, max } })}
                        min={1}
                        max={15}
                    />

                    <RangeSlider
                        label="Height"
                        value={getRangeValue(selectedSeed.height)}
                        onChange={([min, max]) => handleUpdateSeed({ height: { min, max } })}
                        min={1}
                        max={15}
                    />

                    <SegmentedControl
                        label="Side"
                        options={SIDE_OPTIONS}
                        value={selectedSeed.side || 'any'}
                        onChange={(v) => handleUpdateSeed({ side: v as SeedSide })}
                    />

                    <div style={styles.row}>
                        <span style={styles.label}>Trellis:</span>
                        <input
                            type="text"
                            defaultValue={(selectedSeed.trellis || []).join(', ')}
                            key={`trellis-${selectedIndex}`}
                            onBlur={(e) => handleUpdateSeed({
                                trellis: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                            })}
                            style={styles.input}
                            placeholder="e.g., #spawn, #boss"
                        />
                    </div>

                    <div style={styles.buttonRow}>
                        <button style={styles.button} onClick={handleCopySeed}>
                            📋 Copy
                        </button>
                        <button style={styles.deleteButton} onClick={handleRemoveSeed}>
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            ) : (
                <div style={styles.emptyState}>
                    Select a seed to edit, or add a new one.
                </div>
            )}
        </div>
    )
}
