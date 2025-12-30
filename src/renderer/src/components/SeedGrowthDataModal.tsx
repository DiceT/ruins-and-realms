/**
 * Seed Growth Data Modal
 * 
 * A reusable modal for displaying JSON data from the seed growth generator.
 * Used by the Output tab to inspect grid, rooms, corridors, connections, and regions.
 */

import React from 'react'

interface SeedGrowthDataModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    data: unknown
}

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
}

const modalStyle: React.CSSProperties = {
    backgroundColor: 'rgba(20, 29, 31, 0.98)',
    border: '1px solid #bcd3d2',
    borderRadius: 8,
    padding: 20,
    maxWidth: '80vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    color: '#bcd3d2',
    fontFamily: 'monospace'
}

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottom: '1px solid #444'
}

const titleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 'bold',
    margin: 0
}

const closeButtonStyle: React.CSSProperties = {
    padding: '5px 15px',
    backgroundColor: '#2e3f41',
    border: '1px solid #bcd3d2',
    color: '#bcd3d2',
    cursor: 'pointer',
    fontSize: 14
}

const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#1a2224',
    border: '1px solid #333',
    borderRadius: 4,
    padding: 10
}

const preStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
}

/**
 * Serialize data for display, handling Maps and Sets
 */
function serializeForDisplay(data: unknown): string {
    return JSON.stringify(
        data,
        (key, value) => {
            if (value instanceof Map) {
                return {
                    _type: 'Map',
                    entries: Array.from(value.entries())
                }
            }
            if (value instanceof Set) {
                return {
                    _type: 'Set',
                    values: Array.from(value.values())
                }
            }
            return value
        },
        2
    )
}

export const SeedGrowthDataModal: React.FC<SeedGrowthDataModalProps> = ({
    isOpen,
    onClose,
    title,
    data
}) => {
    if (!isOpen) return null

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div style={overlayStyle} onClick={handleOverlayClick}>
            <div style={modalStyle}>
                <div style={headerStyle}>
                    <h3 style={titleStyle}>{title}</h3>
                    <button style={closeButtonStyle} onClick={onClose}>
                        Close
                    </button>
                </div>
                <div style={contentStyle}>
                    <pre style={preStyle}>
                        {serializeForDisplay(data)}
                    </pre>
                </div>
            </div>
        </div>
    )
}
