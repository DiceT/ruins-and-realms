import React from 'react';
import { useRealmStore } from '../stores/useRealmStore';
import { getWellnessStatus } from '../types/realmTypes';

export const RealmDebugUI: React.FC = () => {
    const state = useRealmStore();

    return (
        <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
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
                <div><strong>Rings:</strong> {state.rings}</div>
                <div><strong>Pop:</strong> {state.population.total} (Avail: {state.population.availableWorkers})</div>
                <div><strong>Wellness:</strong> {state.wellness} ({getWellnessStatus(state.wellness)})</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => state.advanceTurn()} style={btnStyle}>Advance Turn</button>
                <button onClick={() => state.modifyRings(10)} style={btnStyle}>+10 Rings</button>
                <button onClick={() => state.modifyRings(-10)} style={btnStyle}>-10 Rings</button>
                <button onClick={() => state.modifyWellness(1)} style={btnStyle}>+1 Wellness</button>
                <button onClick={() => state.modifyWellness(-1)} style={btnStyle}>-1 Wellness</button>
                <button onClick={() => state.resetRealm()} style={{ ...btnStyle, backgroundColor: '#522' }}>Reset</button>
            </div>
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
