import React from 'react'

interface LandTypeEntry {
    land: string
    rank: number
    coordX: number
    coordY: number
}

interface Plot {
    plotTag: string
    landType: string
    size: number
    rank: number
    rankModifier: number
    ownerAndDetails: string
    landTypeList: LandTypeEntry[]
}

interface UnclaimedLogModalProps {
    isOpen: boolean
    onClose: () => void
    plots: Plot[]
}

export const UnclaimedLogModal: React.FC<UnclaimedLogModalProps> = ({ isOpen, onClose, plots }) => {
    if (!isOpen) return null

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.85)',
                zIndex: 2000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}
        >
            <div
                style={{
                    width: '80%',
                    height: '80%',
                    backgroundColor: '#1a2628',
                    border: '2px solid #bcd3d2',
                    padding: '20px',
                    overflow: 'auto',
                    color: '#bcd3d2',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px' }}>UNCLAIMED LAND LOG</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: '1px solid #bcd3d2',
                            color: '#bcd3d2',
                            cursor: 'pointer',
                            padding: '5px 10px',
                            fontSize: '16px'
                        }}
                    >
                        CLOSE
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #bcd3d2' }}>
                            <th style={{ padding: '10px' }}>TAG</th>
                            <th style={{ padding: '10px' }}>LAND TYPE</th>
                            <th style={{ padding: '10px' }}>SIZE</th>
                            <th style={{ padding: '10px' }}>RANK</th>
                            <th style={{ padding: '10px' }}>MOD</th>
                            <th style={{ padding: '10px' }}>COORDS (First)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {plots.map((plot, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #4a5d5e' }}>
                                <td style={{ padding: '10px' }}>{plot.plotTag}</td>
                                <td style={{ padding: '10px' }}>{plot.landType}</td>
                                <td style={{ padding: '10px' }}>{plot.size}</td>
                                <td style={{ padding: '10px' }}>{plot.rank}</td>
                                <td style={{ padding: '10px' }}>{plot.rankModifier}</td>
                                <td style={{ padding: '10px' }}>
                                    {plot.landTypeList[0]
                                        ? `${plot.landTypeList[0].coordX}, ${plot.landTypeList[0].coordY}`
                                        : 'N/A'}
                                </td>
                            </tr>
                        ))}
                        {plots.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                                    No unclaimed land logged yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
