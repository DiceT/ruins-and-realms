import React from 'react';
import { useRealmStore } from '../stores/useRealmStore';
import { getWellnessStatus } from '../types/realmTypes';
import { DELVE_COOLDOWN_TURNS } from '../config/actions';

export const RealmDebugUI: React.FC = () => {
    const state = useRealmStore();

    // Calculate DELVE availability (month-based reset)
    const currentMonth = Math.ceil(state.date.turn / DELVE_COOLDOWN_TURNS);
    const lastDelveMonth = state.lastDelveTurn > 0
        ? Math.ceil(state.lastDelveTurn / DELVE_COOLDOWN_TURNS)
        : 0;
    const delveReady = lastDelveMonth !== currentMonth;
    const nextMonthStart = currentMonth * DELVE_COOLDOWN_TURNS + 1;
    const turnsUntilReset = nextMonthStart - state.date.turn;

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '320px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#eee',
            padding: '15px',
            borderRadius: '8px',
            zIndex: 9999,
            width: '320px',
            fontFamily: 'monospace',
            border: '1px solid #444',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            maxHeight: '90vh',
            overflowY: 'auto'
        }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #666', paddingBottom: '5px' }}>Realm Debug</h3>

            <div style={{ marginBottom: '15px', fontSize: '12px' }}>
                <div><strong>Month {currentMonth}, Week {((state.date.turn - 1) % DELVE_COOLDOWN_TURNS) + 1}</strong> (Turn {state.date.turn})</div>
                <div><strong>Rings:</strong> {state.rings} | <strong>Pop:</strong> {state.population.total}</div>
                <div><strong>Wellness:</strong> {state.wellness} ({getWellnessStatus(state.wellness)})</div>
                <div><strong>Food:</strong> {state.foodStatus}</div>
                <div><strong>Tax:</strong> {state.tax.amount}R in {state.tax.daysUntilDue}d [{state.tax.status}]</div>
                <div><strong>Titles:</strong> {state.titles.join(', ')}</div>
                <div><strong>Threat:</strong> {state.threat} | <strong>DELVE:</strong> {delveReady ? '✓ Ready' : `${turnsUntilReset}t`}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => state.advanceTurn()} style={btnStyle}>Advance Turn</button>

                <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => state.modifyRings(10)} style={{ ...btnStyle, flex: 1 }}>+10 Rings</button>
                    <button onClick={() => state.modifyRings(-10)} style={{ ...btnStyle, flex: 1 }}>-10 Rings</button>
                </div>

                <button onClick={() => state.dispatchAction({
                    type: 'BUILD' as any,
                    payload: { buildingId: 'farmstead', hexId: 'TEST_HEX' }
                })}
                    disabled={state.actionPoints.current < 1}
                    style={{ ...btnStyle, border: '1px solid #6f6' }}
                >
                    Build Farm (25R, 1 AP)
                </button>

                <button onClick={() => state.dispatchAction({
                    type: 'EXPLORE' as any,
                    payload: { targetHexId: 'GENERIC' }
                })}
                    disabled={state.actionPoints.current < 1}
                    style={{ ...btnStyle, border: '1px solid gold', color: 'gold' }}
                >
                    Explore Wilds (1 AP)
                </button>

                <button onClick={() => state.dispatchAction({
                    type: 'DELVE' as any,
                    payload: {}
                })}
                    disabled={state.actionPoints.current < 1 || !delveReady}
                    style={{
                        ...btnStyle,
                        border: delveReady ? '1px solid #f66' : '1px solid #666',
                        color: delveReady ? '#f66' : '#666'
                    }}
                >
                    🗡️ DELVE {!delveReady && `(${turnsUntilReset}t)`}
                </button>

                <button onClick={() => state.dispatchAction({
                    type: 'REST' as any,
                    payload: {}
                })}
                    disabled={state.actionPoints.current < 1}
                    style={{ ...btnStyle, border: '1px solid #88f' }}
                >
                    💤 Rest (+1 Wellness)
                </button>

                <button onClick={() => state.addOwnedHex('DebugHex', ['FERTILE'])}
                    style={{ ...btnStyle, border: '1px dashed #aa5' }}>
                    Add Fertile Land
                </button>
                <button onClick={() => state.resetRealm()}
                    style={{ ...btnStyle, backgroundColor: '#522' }}>
                    Reset
                </button>
            </div>

            <div style={{ borderTop: '1px solid #ccc', margin: '10px 0', paddingTop: '10px' }}>
                <div style={{ marginBottom: '5px' }}><strong>AP: {state.actionPoints.current}/{state.actionPoints.max}</strong></div>
                <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => state.saveRealm()} style={{ ...btnStyle, backgroundColor: '#447', flex: 1 }}>Save</button>
                    <button onClick={() => state.loadRealm()} style={{ ...btnStyle, backgroundColor: '#447', flex: 1 }}>Load</button>
                </div>
            </div>

            {state.buildings.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '11px' }}>
                    <strong>Buildings:</strong>
                    {state.buildings.map((b, i) => (
                        <div key={i} style={{ color: b.isDisabled ? '#888' : '#eee' }}>
                            {b.defId} ({b.isBuilt ? `HP ${b.currentHP}/${b.maxHP}` : `Building ${b.currentHP}/${b.maxHP}`})
                            {b.isDisabled && ' [DISABLED]'}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const btnStyle: React.CSSProperties = {
    padding: '5px 10px',
    cursor: 'pointer',
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px'
};

