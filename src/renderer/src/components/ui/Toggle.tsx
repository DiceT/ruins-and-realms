/**
 * Toggle Component
 * 
 * A simple toggle switch for boolean values.
 * Replaces checkboxes with a more visual control.
 */

import { CSSProperties } from 'react'

interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label?: string
    disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
    const trackStyle: CSSProperties = {
        position: 'relative',
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        background: checked ? '#7c3aed' : 'rgba(255,255,255,0.2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0
    }

    const thumbStyle: CSSProperties = {
        position: 'absolute',
        top: '2px',
        left: checked ? '22px' : '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        transition: 'left 0.2s ease'
    }

    const containerStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        cursor: disabled ? 'not-allowed' : 'pointer'
    }

    const labelStyle: CSSProperties = {
        fontSize: '0.9rem',
        color: disabled ? '#666' : '#e0e0e0',
        userSelect: 'none'
    }

    const handleClick = () => {
        if (!disabled) {
            onChange(!checked)
        }
    }

    return (
        <div style={containerStyle} onClick={handleClick}>
            <div style={trackStyle}>
                <div style={thumbStyle} />
            </div>
            {label && <span style={labelStyle}>{label}</span>}
        </div>
    )
}
