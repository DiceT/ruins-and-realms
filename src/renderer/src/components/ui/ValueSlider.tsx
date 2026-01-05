/**
 * ValueSlider Component
 * 
 * A single-thumb slider for percentage/single values.
 * Used for Dud%, Turn, Branch, etc.
 */

import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'
import { CSSProperties } from 'react'

interface ValueSliderProps {
    /** Current value */
    value: number
    /** Callback when value changes */
    onChange: (value: number) => void
    /** Minimum possible value */
    min?: number
    /** Maximum possible value */
    max?: number
    /** Step increment */
    step?: number
    /** Label to display */
    label?: string
    /** Format function for display value */
    formatValue?: (value: number) => string
    /** Disabled state */
    disabled?: boolean
}

export function ValueSlider({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    label,
    formatValue = (v) => String(v),
    disabled = false
}: ValueSliderProps) {
    const containerStyle: CSSProperties = {
        marginBottom: '0.75rem'
    }

    const headerStyle: CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem'
    }

    const labelStyle: CSSProperties = {
        fontSize: '0.85rem',
        color: '#aaa'
    }

    const valueStyle: CSSProperties = {
        fontSize: '0.85rem',
        color: '#e0e0e0',
        fontFamily: 'monospace'
    }

    const handleChange = (newValue: number | number[]) => {
        if (typeof newValue === 'number') {
            onChange(newValue)
        }
    }

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                {label && <span style={labelStyle}>{label}</span>}
                <span style={valueStyle}>{formatValue(value)}</span>
            </div>
            <Slider
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
                disabled={disabled}
                styles={{
                    track: {
                        background: '#7c3aed',
                        height: 6
                    },
                    rail: {
                        background: 'rgba(255,255,255,0.2)',
                        height: 6
                    },
                    handle: {
                        background: '#fff',
                        border: '2px solid #7c3aed',
                        width: 16,
                        height: 16,
                        marginTop: -5,
                        opacity: 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                    }
                }}
            />
        </div>
    )
}
