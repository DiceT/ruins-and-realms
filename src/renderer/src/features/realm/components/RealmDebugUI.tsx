import React from 'react';
import { useRealmStore } from '../stores/useRealmStore';
import { getWellnessStatus } from '../types/realmTypes';
import { calculateFoodStatus } from '../logic/economy/foodCalculator';

export const RealmDebugUI: React.FC = () => {
    const state = useRealmStore();

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
            width: '300px',
            fontFamily: 'monospace',
            border: '1px solid #444',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
            <h3 style={{ marginTop: 0, borderBottom: '1px solid #666', paddingBottom: '5px' }}>Realm Debug</h3>

            <div style={{ marginBottom: '15px' }}>
                <div><strong>Turn:</strong> {state.date.turn}</div>
                <div><strong>Phase:</strong> {state.phase}</div>
                <div><strong>Rings:</strong> {state.rings}</div>
                <div><strong>Pop:</strong> {state.population.total} (Avail: {state.population.availableWorkers})</div>
                <div><strong>Wellness:</strong> {state.wellness} ({getWellnessStatus(state.wellness)})</div>
                <div><strong>Food:</strong> {state.foodStatus}</div>
                <div><strong>Tax:</strong> {state.tax.amount} Rings (Due in {state.tax.daysUntilDue} Days) [{state.tax.status}]</div>
                <div><strong>Patience:</strong> {state.baronPatience}</div>
                <div><strong>Tags:</strong> {state.ownedHexes.flatMap(h => h.landTags).join(', ')}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => state.advanceTurn()} style={btnStyle}>Advance Turn</button>
                <button onClick={() => state.modifyRings(10)} style={btnStyle}>+10 Rings</button>
                <button onClick={() => state.modifyRings(-10)} style={btnStyle}>-10 Rings</button>
                <button onClick={() => state.dispatchAction({
                    type: 'BUILD' as any,
                    payload: { buildingId: 'farmstead', hexId: 'TEST_HEX' }
                })}
                    disabled={state.actionPoints.current < 1}
                    style={{ ...btnStyle, border: '1px solid #6f6' }}
                >
                    Build Farm (25 Rings, 1 AP)
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
                <button onClick={() => state.addOwnedHex('DebugHex', ['FERTILE'])} style={{ ...btnStyle, border: '1px dashed #aa5' }}>Add Fertile Land</button>
                <button onClick={() => state.resetRealm()} style={{ ...btnStyle, backgroundColor: '#522' }}>Reset</button>
            </div>

            <div style={{ borderTop: '1px solid #ccc', margin: '10px 0', paddingTop: '10px' }}>
                <div style={{ marginBottom: '5px' }}><strong>Actions (AP: {state.actionPoints.current}/{state.actionPoints.max})</strong></div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                    <button onClick={() => state.saveRealm()} style={{ ...btnStyle, backgroundColor: '#447' }}>Save</button>
                    <button onClick={() => state.loadRealm()} style={{ ...btnStyle, backgroundColor: '#447' }}>Load</button>
                </div>
            </div>

            {state.buildings.length > 0 && (
                <div style={{ marginTop: '10px', fontSize: '12px' }}>
                    <strong>Buildings:</strong>
                    {state.buildings.map((b, i) => (
                        <div key={i}>{b.defId} ({b.isBuilt ? 'Built' : `Constr: ${b.constructionPoints}`})</div>
                    ))}
                </div>
            )}
        </div>
    );
};

const btnStyle = {
    padding: '5px 10px',
    cursor: 'pointer',
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #555',
    borderRadius: '4px'
};
