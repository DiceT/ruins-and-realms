/**
 * RangeSlider Component
 * 
 * A dual-thumb slider for selecting min/max value pairs.
 * Wraps rc-slider for consistent styling.
 */

import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'
import { CSSProperties } from 'react'

interface RangeSliderProps {
    /** Current [min, max] values */
    value: [number, number]
    /** Callback when values change */
    onChange: (value: [number, number]) => void
    /** Minimum possible value */
    min?: number
    /** Maximum possible value */
    max?: number
    /** Step increment */
    step?: number
    /** Label to display */
    label?: string
    /** Whether to show current values */
    showValues?: boolean
    /** Disabled state */
    disabled?: boolean
}

export function RangeSlider({
    value,
    onChange,
    min = 1,
    max = 10,
    step = 1,
    label,
    showValues = true,
    disabled = false
}: RangeSliderProps) {
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
        if (Array.isArray(newValue) && newValue.length === 2) {
            onChange([newValue[0], newValue[1]])
        }
    }

    return (
        <div style={containerStyle}>
            {(label || showValues) && (
                <div style={headerStyle}>
                    {label && <span style={labelStyle}>{label}</span>}
                    {showValues && <span style={valueStyle}>{value[0]} – {value[1]}</span>}
                </div>
            )}
            <Slider
                range
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
