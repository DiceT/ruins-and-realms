import React from 'react'
import { LightSourceType } from '../engine/data/LightingData'

interface DungeonControlPanelProps {
    showFog: boolean
    onShowFogChange: (show: boolean) => void
    showLight: boolean
    onShowLightChange: (show: boolean) => void
    showPlayer: boolean
    onShowPlayerChange: (show: boolean) => void
    activeLight: LightSourceType
    onActiveLightChange: (type: LightSourceType) => void
}

export const DungeonControlPanel: React.FC<DungeonControlPanelProps> = ({
    showFog,
    onShowFogChange,
    showLight,
    onShowLightChange,
    showPlayer,
    onShowPlayerChange,
    activeLight,
    onActiveLightChange
}) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: 20,
                right: 320, // To left of existing right panel
                background: 'rgba(0,0,0,0.85)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #444',
                color: 'white',
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
        >
            <h3
                style={{
                    margin: 0,
                    fontSize: '14px',
                    borderBottom: '1px solid #666',
                    paddingBottom: '6px',
                    fontWeight: 'bold'
                }}
            >
                Light & Fog
            </h3>

            <div style={{ display: 'flex', gap: '12px' }}>
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    <input
                        type="checkbox"
                        checked={showFog}
                        onChange={(e) => onShowFogChange(e.target.checked)}
                    />
                    Fog
                </label>
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    <input
                        type="checkbox"
                        checked={showLight}
                        onChange={(e) => onShowLightChange(e.target.checked)}
                    />
                    Light
                </label>
                <label
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    <input
                        type="checkbox"
                        checked={showPlayer}
                        onChange={(e) => onShowPlayerChange(e.target.checked)}
                    />
                    Player
                </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#aaa' }}>Light Source:</label>
                <select
                    value={activeLight}
                    onChange={(e) => onActiveLightChange(e.target.value as LightSourceType)}
                    style={{
                        background: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        padding: '4px',
                        borderRadius: '4px',
                        fontSize: '12px'
                    }}
                >
                    <option value="torch">Torch (20/40)</option>
                    <option value="hooded">Hooded (30/60)</option>
                    <option value="bullseye">Bullseye (60/120)</option>
                </select>
            </div>

            <div style={{ fontSize: '10px', color: '#777', marginTop: '4px' }}>
                WASD or Arrows to move
            </div>
        </div>
    )
}
