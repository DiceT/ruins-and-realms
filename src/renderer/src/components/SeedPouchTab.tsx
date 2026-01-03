
import React, { useState } from 'react'
import { ManualSeedConfig } from '../engine/seed-growth/SeedDefinitions'
import { validateSeedBatch, expandRepeats } from '../engine/seed-growth/ManualSeedSystem'

interface SeedPouchTabProps {
    queue: ManualSeedConfig[]
    onQueueChange: (queue: ManualSeedConfig[]) => void
    onGrow: () => void
}

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        color: '#bcd3d2',
        fontFamily: 'monospace',
        fontSize: 11
    },
    textArea: {
        width: '100%',
        minHeight: 100,
        backgroundColor: '#1a2224',
        color: '#bcd3d2',
        border: '1px solid #444',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: 8,
        marginBottom: 8
    },
    button: {
        padding: '4px 8px',
        backgroundColor: '#2e3f41',
        border: '1px solid #bcd3d2',
        color: '#bcd3d2',
        cursor: 'pointer',
        fontSize: 10
    },
    list: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4,
        maxHeight: 300,
        overflowY: 'auto' as const,
        border: '1px solid #444',
        padding: 4
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#222',
        padding: 4,
        border: '1px solid #333'
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
    },
    tag: {
        backgroundColor: '#34495e',
        padding: '1px 4px',
        borderRadius: 2,
        fontSize: 9
    },
    error: {
        color: '#e74c3c',
        marginTop: 4
    }
}

export const SeedPouchTab: React.FC<SeedPouchTabProps> = ({ queue, onQueueChange, onGrow }) => {
    const [jsonInput, setJsonInput] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [editingIndex, setEditingIndex] = useState<number | null>(null)

    const handleAdd = () => {
        try {
            const parsed = JSON.parse(jsonInput)

            // Use Isolation System for Validation
            const { valid, errors } = validateSeedBatch(parsed)

            if (errors.length > 0) {
                // Reject entire batch if any error (Strict Mode v1)
                setError('Validation Failed:\n' + errors.join('\n'))
                return
            }

            // Expand Repeats
            const expanded = expandRepeats(valid)

            onQueueChange([...queue, ...expanded])
            setJsonInput('')
            setError(null)
        } catch (e) {
            setError('Invalid JSON syntax')
        }
    }

    const handlePastePouch = async () => {
        try {
            const text = await navigator.clipboard.readText()
            const parsed = JSON.parse(text)

            // Use Isolation System
            const { valid, errors } = validateSeedBatch(parsed)

            if (errors.length > 0) {
                setError('Clipboard validation failed:\n' + errors.join('\n'))
                return
            }

            const expanded = expandRepeats(valid)
            onQueueChange(expanded) // Overwrite
            setError(null)
        } catch (e) {
            setError('Clipboard content is not valid JSON')
        }
    }

    const handleCopyPouch = async () => {
        await navigator.clipboard.writeText(JSON.stringify(queue, null, 2))
    }

    const handleDelete = (index: number) => {
        const next = [...queue]
        next.splice(index, 1)
        onQueueChange(next)
    }

    const handleMove = (index: number, dir: -1 | 1) => {
        if (index + dir < 0 || index + dir >= queue.length) return
        const next = [...queue]
        const temp = next[index]
        next[index] = next[index + dir]
        next[index + dir] = temp
        onQueueChange(next)
    }

    const handleEdit = (index: number) => {
        setEditingIndex(index)
        setJsonInput(JSON.stringify(queue[index], null, 2))
    }

    const handleSaveEdit = () => {
        if (editingIndex === null) return
        try {
            const parsed = JSON.parse(jsonInput)
            // Validate single item
            const { valid, errors } = validateSeedBatch([parsed])

            if (errors.length > 0) {
                setError(errors[0])
                return
            }

            // Note: Editing a single item shouldn't really expand repeats right there in place in the list 
            // unless we want to replace one row with N rows. 
            // For v1 simplicity, let's treat edit as 1-to-1.
            // But if user adds repeat: 5, we should probably expand it?
            // Locked Scope says: "The queue contains only fully-expanded seed entries".
            // So yes, we should expand.

            const expanded = expandRepeats(valid)

            const next = [...queue]
            // Remove the old item, insert the new item(s)
            next.splice(editingIndex, 1, ...expanded)

            onQueueChange(next)
            setEditingIndex(null)
            setJsonInput('')
            setError(null)
        } catch (e: any) {
            setError('Invalid JSON: ' + e.message)
        }
    }

    const handleCancelEdit = () => {
        setEditingIndex(null)
        setJsonInput('')
        setError(null)
    }

    return (
        <div style={styles.container}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button style={{ ...styles.button, backgroundColor: '#27ae60', color: '#fff' }} onClick={onGrow}>🌱 Grow</button>
                <button style={styles.button} onClick={handleCopyPouch}>📋 Copy Pouch</button>
                <button style={styles.button} onClick={handlePastePouch}>📥 Paste Pouch (Overwrite)</button>
                <button style={styles.button} onClick={() => onQueueChange([])}>🗑 Clear</button>
            </div>

            <div style={{ borderTop: '1px solid #444', paddingTop: 8 }}>
                {editingIndex !== null ? (
                    <strong>Editing Seed #{editingIndex + 1}</strong>
                ) : (
                    <strong>Add New Seed(s)</strong>
                )}
                <textarea
                    style={styles.textArea}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='Paste seed JSON here...'
                />
                {error && <div style={styles.error}>{error}</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                    {editingIndex !== null ? (
                        <>
                            <button style={styles.button} onClick={handleSaveEdit}>Save Changes</button>
                            <button style={styles.button} onClick={handleCancelEdit}>Cancel</button>
                        </>
                    ) : (
                        <button style={styles.button} onClick={handleAdd}>Add to Queue</button>
                    )}
                </div>
            </div>

            <div style={styles.list}>
                {queue.map((seed, i) => (
                    <div key={i} style={{ ...styles.item, borderColor: editingIndex === i ? '#3498db' : '#333' }}>
                        <div>
                            <div style={{ fontWeight: 'bold' }}>
                                #{i + 1} {seed.id || seed.type || 'Seed'}
                                <span style={{ marginLeft: 8, color: '#888', fontSize: 10 }}>W:{fmt(seed.width)} H:{fmt(seed.height)}</span>
                            </div>
                            <div style={styles.row}>
                                <span style={{ fontSize: 10, color: '#666' }}>Int:{fmt((seed as any).interval)}</span>
                                {seed.tags?.map(t => <span key={t} style={styles.tag}>{t}</span>)}
                            </div>
                        </div>
                        <div style={styles.row}>
                            <button style={styles.button} onClick={() => handleMove(i, -1)}>↑</button>
                            <button style={styles.button} onClick={() => handleMove(i, 1)}>↓</button>
                            <button style={styles.button} onClick={() => handleEdit(i)}>✎</button>
                            <button style={{ ...styles.button, color: '#e74c3c' }} onClick={() => handleDelete(i)}>×</button>
                        </div>
                    </div>
                ))}
                {queue.length === 0 && <div style={{ padding: 8, textAlign: 'center', color: '#666' }}>Queue Empty (Using Random)</div>}
            </div>
        </div>
    )
}

function fmt(val: number | { min: number, max: number } | undefined): string {
    if (val === undefined) return '?'
    if (typeof val === 'number') return String(val)
    return `${val.min}-${val.max}`
}
