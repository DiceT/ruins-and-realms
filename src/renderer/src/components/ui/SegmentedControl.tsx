/**
 * SegmentedControl Component
 * 
 * A button group for mutually exclusive options.
 * Used for Side (L/R/Both/Any), EjectionCount (Single/Paired/Triplets), etc.
 */

import { CSSProperties } from 'react'

interface SegmentedControlOption<T> {
    value: T
    label: string
}

interface SegmentedControlProps<T> {
    /** Available options */
    options: SegmentedControlOption<T>[]
    /** Currently selected value */
    value: T
    /** Callback when selection changes */
    onChange: (value: T) => void
    /** Optional label */
    label?: string
    /** Disabled state */
    disabled?: boolean
}

export function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    label,
    disabled = false
}: SegmentedControlProps<T>) {
    const containerStyle: CSSProperties = {
        marginBottom: '0.75rem'
    }

    const labelStyle: CSSProperties = {
        fontSize: '0.85rem',
        color: '#aaa',
        display: 'block',
        marginBottom: '0.5rem'
    }

    const groupStyle: CSSProperties = {
        display: 'flex',
        gap: '2px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '6px',
        padding: '2px'
    }

    const getButtonStyle = (isSelected: boolean): CSSProperties => ({
        flex: 1,
        padding: '0.4rem 0.6rem',
        border: 'none',
        borderRadius: '4px',
        background: isSelected ? '#7c3aed' : 'transparent',
        color: isSelected ? 'white' : '#aaa',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.8rem',
        fontWeight: isSelected ? 600 : 400,
        transition: 'all 0.15s ease',
        opacity: disabled ? 0.5 : 1
    })

    return (
        <div style={containerStyle}>
            {label && <span style={labelStyle}>{label}</span>}
            <div style={groupStyle}>
                {options.map((option) => (
                    <button
                        key={String(option.value)}
                        style={getButtonStyle(option.value === value)}
                        onClick={() => !disabled && onChange(option.value)}
                        disabled={disabled}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
