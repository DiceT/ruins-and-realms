import React, { useEffect, useState } from 'react';
import { combatEngine } from '../CombatEngine';
import { CombatState } from '../types';
import PlayerCard from './PlayerCard';
import EnemyCard from './EnemyCard';
import { DiceOverlay } from '../../../components/DiceOverlay';
import { DiceSettingsWrapper } from '../../../components/DiceSettingsWrapper';
import { SettingsProvider, SettingsSync } from '../../../integrations/anvil-dice-app';

const CombatDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [state, setState] = useState<CombatState>(combatEngine.getState());
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        const unsubscribe = combatEngine.subscribe((newState) => {
            setState({ ...newState });
        });
        return () => unsubscribe();
    }, []);

    const handleRoll = () => {
        combatEngine.rollDice();
    };

    const handleManeuver = (id: string) => {
        combatEngine.executeManeuver(id);
    };

    const handlePass = () => {
        combatEngine.passTurn();
    };

    const handleEnemyRoll = () => {
        combatEngine.rollEnemyDicePublic();
    };

    const handleStart = () => {
        combatEngine.startCombat('skeleton'); // Hardcoded for test
    };

    if (!state.isActive && !state.gameEnded) { // gameEnded is heuristic, using isActive for now
        // If just opened and inactive, maybe auto-start or show start button
        return (
            <div style={styles.overlay}>
                <div style={styles.window}>
                    <h2>Combat Simulator</h2>
                    <button onClick={handleStart} style={styles.button}>Start Test Combat vs Skeleton</button>
                    <button onClick={onClose} style={{ ...styles.button, marginTop: 10 }}>Close</button>
                </div>
            </div>
        )
    }

    return (
        <SettingsProvider>
            <SettingsSync />
            <div style={styles.overlay}>
                <div style={styles.window}>
                    {/* 3D Dice Overlay */}
                    <DiceOverlay />

                    {/* Card Arena */}
                    <div style={styles.cardArena}>
                        {/* Henchman Slot */}
                        <div style={styles.cardColumn}>
                            <div style={{ width: '280px', height: '750px', border: '1px dashed #444', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '12px' }}>
                                Henchman
                            </div>
                        </div>

                        {/* Player Card + Tray */}
                        <div style={styles.cardColumn}>
                            <PlayerCard
                                name="Hero"
                                hp={state.player.hp}
                                maxHp={state.player.maxHp}
                                maxShift={state.player.maxShift}
                                maneuvers={combatEngine.getAllEquippedManeuvers()}
                                armor={state.player.armor}
                                currentRoll={state.currentRoll}
                                enemyRoll={state.enemyRoll}
                                onManeuverClick={(m) => handleManeuver(m.id)}
                            />
                            {/* Player Landing Tray */}
                            <div style={styles.landingTray}>
                                {state.currentRoll ? (
                                    <>
                                        <div style={{ ...styles.landingDie, backgroundColor: '#d64541' }}>
                                            {state.currentRoll[0]}
                                        </div>
                                        <div style={{ ...styles.landingDie, backgroundColor: '#4183d7' }}>
                                            {state.currentRoll[1]}
                                        </div>
                                        {/* MISS button if no maneuvers available */}
                                        {combatEngine.getAvailableManeuvers().length === 0 && (
                                            <button style={styles.missButton} onClick={handlePass}>MISS</button>
                                        )}
                                    </>
                                ) : state.turnPhase === 'player-roll' ? (
                                    <button style={styles.rollButton} onClick={handleRoll}>ROLL D88</button>
                                ) : (
                                    <span style={{ color: '#666', fontSize: '10px' }}>Waiting...</span>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div style={{ width: '3px', height: '520px', backgroundColor: '#555', margin: '0 15px' }} />

                        {/* Enemy Card + Tray */}
                        {state.enemy && (
                            <div style={styles.cardColumn}>
                                <EnemyCard
                                    enemy={state.enemy}
                                    currentRoll={state.enemyRoll}
                                    playerRoll={state.currentRoll}
                                    onManeuverClick={(m, i) => {
                                        if (state.turnPhase === 'enemy-resolve') {
                                            combatEngine.resolveEnemyManeuver(i);
                                        }
                                    }}
                                />
                                {/* Enemy Landing Tray */}
                                <div style={styles.landingTray}>
                                    {state.turnPhase === 'enemy-roll' && !state.enemyRoll ? (
                                        <button style={styles.rollButton} onClick={handleEnemyRoll}>ROLL D88</button>
                                    ) : state.enemyRoll ? (
                                        <>
                                            <div style={{ ...styles.landingDie, backgroundColor: '#8b2323' }}>
                                                {state.enemyRoll[0]}
                                            </div>
                                            <div style={{ ...styles.landingDie, backgroundColor: '#cc5500' }}>
                                                {state.enemyRoll[1]}
                                            </div>
                                            {/* MISS button if no enemy maneuvers match */}
                                            {combatEngine.getAvailableEnemyManeuvers().length === 0 && (
                                                <button style={styles.missButton} onClick={() => combatEngine.enemyMiss()}>MISS</button>
                                            )}
                                        </>
                                    ) : (
                                        <span style={{ color: '#666', fontSize: '10px' }}>Waiting...</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Placeholder enemy slots */}
                        {[...Array(3)].map((_, i) => (
                            <div key={i} style={styles.cardColumn}>
                                <div style={{ width: '280px', height: '750px', border: '1px dashed #533', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '12px' }}>
                                    Enemy {i + 2}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Row: Controls + Log */}
                    <div style={styles.bottomRow}>
                        <div style={styles.bottomControls}>
                            <button
                                style={styles.controlButton}
                                onClick={() => setShowSettings(true)}
                                title="Dice Settings"
                            >
                                ⚙️
                            </button>
                            <button
                                style={styles.controlButton}
                                onClick={handleStart}
                                title="Restart Combat"
                            >
                                🔄
                            </button>
                            <button
                                style={styles.controlButton}
                                onClick={onClose}
                                title="Exit Combat"
                            >
                                🚪
                            </button>
                        </div>
                        <div style={styles.logArea}>
                            {state.log.slice().reverse().map((entry, i) => (
                                <div key={i} style={{ marginBottom: 4, color: getColorForType(entry.type) }}>
                                    [{entry.round}] {entry.message}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dice Settings Modal */}
                    <DiceSettingsWrapper
                        isOpen={showSettings}
                        onClose={() => setShowSettings(false)}
                    />

                </div>
            </div>
        </SettingsProvider>
    );
};

const getColorForType = (type: string) => {
    switch (type) {
        case 'damage': return '#ff4444';
        case 'effect': return '#aaaa22';
        case 'player-action': return '#aaf';
        case 'enemy-action': return '#faa';
        default: return '#ccc';
    }
}

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#222',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    window: {
        width: '100%',
        height: '100%',
        backgroundColor: '#222',
        color: '#eee',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        gap: '10px',
        boxSizing: 'border-box'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #444',
        paddingBottom: '10px'
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '1.2em',
        cursor: 'pointer'
    },
    grid: {
        display: 'flex',
        gap: '20px',
    },
    panel: {
        flex: 1,
        backgroundColor: '#333',
        padding: '10px',
        borderRadius: '4px'
    },
    diceArea: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '40px',
        padding: '20px',
        backgroundColor: '#2a2a2a',
        borderRadius: '4px',
        minHeight: '120px'
    },
    dieContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px'
    },
    die: {
        width: '60px',
        height: '60px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '2em',
        fontWeight: 'bold',
        color: 'white',
        borderRadius: '8px',
        border: '2px solid rgba(255,255,255,0.2)'
    },
    controls: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        fontSize: '0.8em'
    },
    button: {
        padding: '10px 20px',
        fontSize: '1.2em',
        cursor: 'pointer',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '4px'
    },
    restartButton: {
        padding: '5px 10px',
        cursor: 'pointer',
        backgroundColor: '#555',
        color: 'white',
        border: '1px solid #777',
        borderRadius: '4px'
    },
    rollButton: {
        padding: '15px 30px',
        fontSize: '1.5em',
        cursor: 'pointer',
        backgroundColor: '#e67e22',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold'
    },
    maneuversArea: {
        flex: 1,
        backgroundColor: '#333',
        padding: '10px',
        borderRadius: '4px',
        overflowY: 'auto'
    },
    maneuverList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px'
    },
    maneuverButton: {
        padding: '10px',
        backgroundColor: '#444',
        border: '1px solid #666',
        color: 'white',
        cursor: 'pointer',
        textAlign: 'left',
        flex: '1 1 45%', // 2 cols
        borderRadius: '4px'
    },
    logArea: {
        flex: 1,
        backgroundColor: '#111',
        padding: '10px',
        borderRadius: '4px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '11px'
    },
    cardArena: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '15px',
        backgroundColor: '#1a1a2a',
        borderRadius: '8px',
        overflowX: 'auto',
        minHeight: '540px'
    },
    cardColumn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
    },
    landingTray: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '10px',
        backgroundColor: '#222233',
        borderRadius: '6px',
        minWidth: '200px',
        minHeight: '50px'
    },
    landingDie: {
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: 'bold',
        color: 'white',
        borderRadius: '4px',
        border: '2px solid rgba(255,255,255,0.3)'
    },
    missButton: {
        padding: '8px 20px',
        backgroundColor: '#622',
        border: '1px solid #944',
        borderRadius: '4px',
        color: '#faa',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '12px'
    },
    bottomRow: {
        display: 'flex',
        alignItems: 'stretch',
        gap: '10px',
        flex: 1,
        minHeight: 0
    },
    bottomControls: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },
    controlButton: {
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#333',
        border: '1px solid #555',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '18px'
    }
};

export default CombatDialog;
