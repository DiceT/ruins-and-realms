import React from 'react';
import { Creature, EnemyGambit, Riposte, DiceRoll, StatusEffect, EFFECT_ICONS } from '../types';
import { useSettings } from '../../../integrations/anvil-dice-app';

interface EnemyCardProps {
    enemy: Creature;
    currentHp?: number;  // Override HP from EnemyInstance
    activeEffects?: StatusEffect[];
    currentRoll?: DiceRoll | null;
    playerRoll?: DiceRoll | null;
    initiativeRoll?: number | null;  // Display initiative on portrait
    isSelected?: boolean;  // Target selection highlight
    isCurrentTurn?: boolean;  // Whose turn it is
    onGambitClick?: (gambit: EnemyGambit, index: number) => void;
}

// Enemy dice triangle - uses fixed enemy colors (distinct from player)
const DiceTriangle: React.FC<{ value: number; isPrimary: boolean }> = ({ value, isPrimary }) => {
    // Enemy uses distinct colors: dark crimson for primary, burnt orange for secondary
    const color = isPrimary ? '#8b2323' : '#cc5500';
    const labelColor = '#fff';

    return (
        <div style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderBottom: `20px solid ${color}`,
            position: 'relative',
            display: 'inline-block',
            marginRight: '3px'
        }}>
            <span style={{
                position: 'absolute',
                top: '5px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: labelColor
            }}>{value}</span>
        </div>
    );
};

// Riposte triangle - uses PLAYER's dice colors since ripostes trigger off player's roll
const RiposteTriangle: React.FC<{ value: number; isPrimary: boolean }> = ({ value, isPrimary }) => {
    const { settings } = useSettings();
    const color = isPrimary
        ? settings.theme.diceColor
        : (settings.theme.diceColorSecondary || settings.theme.diceColor);
    const labelColor = isPrimary
        ? settings.theme.labelColor
        : (settings.theme.labelColorSecondary || settings.theme.labelColor);

    return (
        <div style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderBottom: `20px solid ${color}`,
            position: 'relative',
            display: 'inline-block',
            marginRight: '3px'
        }}>
            <span style={{
                position: 'absolute',
                top: '5px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: labelColor || 'white'
            }}>{value}</span>
        </div>
    );
};

const ManeuverRow: React.FC<{ maneuver: EnemyManeuver }> = ({ maneuver }) => (
    <div style={styles.maneuverRow}>
        <div style={styles.diceContainer}>
            <DiceTriangle value={maneuver.dice[0]} isPrimary={true} />
            <DiceTriangle value={maneuver.dice[1]} isPrimary={false} />
        </div>
        <div style={styles.maneuverInfo}>
            <span style={styles.maneuverName}>{maneuver.name}</span>
            <span style={styles.maneuverDamage}>{maneuver.damage}</span>
            {maneuver.effect && <span style={styles.maneuverEffect}>{maneuver.effect}</span>}
        </div>
    </div>
);

export const EnemyCard: React.FC<EnemyCardProps> = ({
    enemy,
    currentHp,
    activeEffects = [],
    currentRoll,
    playerRoll,
    initiativeRoll,
    isSelected,
    isCurrentTurn,
    onGambitClick
}) => {
    // Use currentHp from props if provided, otherwise fall back to enemy.hp
    const displayHp = currentHp !== undefined ? currentHp : enemy.hp;
    // Calculate if gambit is reachable (enemy uses their own guide)
    const getGambitStatus = (m: EnemyGambit): 'exact' | 'reachable' | 'none' => {
        if (!currentRoll) return 'none';
        const [p, s] = currentRoll;
        const [tp, ts] = m.dice;

        if (p === tp && s === ts) return 'exact';

        const distance = Math.abs(p - tp) + Math.abs(s - ts);
        if (distance <= enemy.guide) return 'reachable';

        return 'none';
    };

    // Check if riposte is triggered by PLAYER'S roll
    const isRiposteActive = (riposte: Riposte): boolean => {
        if (!playerRoll) return false;
        const trigger = riposte.trigger;
        const comparison = trigger.comparison || '=';
        const targetVal = trigger.value;

        const dieValue = trigger.die === 'primary' ? playerRoll[0]
            : trigger.die === 'secondary' ? playerRoll[1]
                : Math.max(playerRoll[0], playerRoll[1]); // 'either'

        switch (comparison) {
            case '=': return dieValue === targetVal;
            case '<': return dieValue < targetVal;
            case '>': return dieValue > targetVal;
            case '<=': return dieValue <= targetVal;
            case '>=': return dieValue >= targetVal;
            default: return dieValue === targetVal;
        }
    };

    return (
        <div style={{
            ...styles.card,
            border: isSelected ? '2px solid #ffcc00' : styles.card.border,
            boxShadow: isCurrentTurn ? '0 0 15px rgba(255,100,100,0.6)' : styles.card.boxShadow,
        }}>
            {/* Header with Level */}
            <div style={styles.header}>
                <span style={{
                    ...styles.name,
                    color: isSelected ? '#ffcc00' : styles.name.color,
                    textShadow: isSelected ? '1px 1px 2px #000' : 'none',
                }}>{enemy.name}</span>
                <span style={styles.level}>Lvl {enemy.level}</span>
            </div>

            {/* Portrait - with border and initiative overlay */}
            <div style={styles.portrait}>
                <span style={{ color: '#555', fontSize: '12px' }}>Portrait</span>
                {initiativeRoll !== null && initiativeRoll !== undefined && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textAlign: 'center',
                    }}>
                        Initiative<br />{initiativeRoll}
                    </div>
                )}
            </div>

            {/* Active Effects Badges */}
            {activeEffects && activeEffects.length > 0 && (
                <div style={styles.effectBadges}>
                    {activeEffects.map((effect, i) => (
                        <div
                            key={`${effect.id}-${i}`}
                            style={styles.effectBadge}
                            title={`${effect.name}${typeof effect.duration === 'number' ? ` (${effect.duration} turns)` : ''}`}
                        >
                            <span>{EFFECT_ICONS[effect.action.type] || '✨'}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Stats Row: HP left, Guide right */}
            <div style={styles.statsRow}>
                <div style={styles.statBox}>
                    <div style={styles.statValue}>{displayHp}<span style={styles.statDivider}>/</span>{enemy.maxHp}</div>
                    <div style={styles.statLabel}>HP</div>
                </div>
                <div style={styles.statBox}>
                    <div style={styles.statValue}>{enemy.guide}</div>
                    <div style={styles.statLabel}>GUIDE</div>
                </div>
            </div>

            {/* Gambits */}
            <div style={styles.maneuvers}>
                {enemy.gambits.map((m, i) => {
                    const status = getGambitStatus(m);
                    return (
                        <div
                            key={i}
                            style={{
                                ...styles.maneuverRow,
                                ...(status === 'exact' ? styles.maneuverExact : {}),
                                ...(status === 'reachable' ? styles.maneuverReachable : {}),
                                cursor: status !== 'none' ? 'pointer' : 'default'
                            }}
                            onClick={() => status !== 'none' && onGambitClick?.(m, i)}
                        >
                            <div style={styles.diceContainer}>
                                <DiceTriangle value={m.dice[0]} isPrimary={true} />
                                <DiceTriangle value={m.dice[1]} isPrimary={false} />
                            </div>
                            <div style={styles.maneuverInfo}>
                                <span style={styles.maneuverName}>{m.name}</span>
                                <span style={styles.maneuverDamage}>{m.damage}</span>
                                {m.effect && <span style={styles.maneuverEffect}>{m.effect.name}</span>}
                            </div>
                        </div>
                    );
                })}

                {/* Ripostes - right under gambits */}
                {enemy.ripostes && enemy.ripostes.length > 0 && enemy.ripostes.map((riposte, i) => {
                    return (
                        <div key={`riposte-${i}`} style={{
                            ...styles.interruptRow,
                            ...(isRiposteActive(riposte) ? styles.interruptActive : {})
                        }}>
                            <div style={styles.diceContainer}>
                                <RiposteTriangle
                                    value={riposte.trigger.value}
                                    isPrimary={riposte.trigger.die === 'primary'}
                                />
                            </div>
                            <div style={styles.interruptInfo}>
                                <span style={styles.interruptName}>{riposte.name}</span>
                                <span style={styles.interruptEffect}>
                                    {riposte.effect.type === 'modifyDamage' && riposte.effect.value
                                        ? `${riposte.effect.value > 0 ? '+' : ''}${riposte.effect.value} damage`
                                        : riposte.effect.type}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Apex/Nadir */}
            <div style={styles.specialSection}>
                <div style={styles.specialRow}>
                    <div style={styles.apexHeader}>{enemy.apex.name}</div>
                    <div style={styles.apexText}>{enemy.apex.damage}{enemy.apex.effect ? ` - ${enemy.apex.effect}` : ''}</div>
                </div>
                <div style={styles.specialRow}>
                    <div style={styles.nadirHeader}>{enemy.nadir.name}</div>
                    <div style={styles.nadirText}>{enemy.nadir.effect.name || 'Effect'}</div>
                </div>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    card: {
        width: '280px',
        height: '750px',
        backgroundColor: '#3a2a2a',
        border: '2px solid #644',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        fontSize: '10px',
    },
    header: {
        backgroundColor: '#4a3a3a',
        padding: '6px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #644'
    },
    name: {
        fontWeight: 'bold',
        color: '#f88',
        fontSize: '14px',
        textTransform: 'uppercase'
    },
    level: {
        color: '#aaa',
        fontSize: '10px'
    },
    portrait: {
        margin: '8px',
        flex: 1,
        minHeight: 0,
        maxHeight: '220px',
        backgroundColor: '#2a1a1a',
        border: '2px solid #533',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statsRow: {
        display: 'flex',
        backgroundColor: '#352525',
        borderTop: '1px solid #533'
    },
    statBox: {
        flex: 1,
        textAlign: 'center',
        padding: '6px',
        borderRight: '1px solid #533'
    },
    statLabel: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: '9px'
    },
    statValue: {
        color: '#eee',
        fontSize: '16px',
        fontWeight: 'bold'
    },
    statDivider: {
        color: '#666',
        margin: '0 2px'
    },
    maneuvers: {
        flex: 1,
        padding: '4px',
        overflowY: 'auto'
    },
    maneuverRow: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '4px',
        padding: '6px',
        backgroundColor: '#453535',
        borderRadius: '4px'
    },
    diceContainer: {
        display: 'flex',
        marginRight: '4px'
    },
    maneuverInfo: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1
    },
    maneuverName: {
        color: '#ccc',
        fontWeight: 'bold',
        fontSize: '12px'
    },
    maneuverDamage: {
        color: '#f88',
        fontSize: '10px'
    },
    maneuverEffect: {
        color: '#fa8',
        fontSize: '9px',
        fontStyle: 'italic'
    },
    interruptsSection: {
        padding: '3px 4px',
        backgroundColor: '#302020',
        borderTop: '1px solid #533'
    },
    sectionTitle: {
        color: '#999',
        fontSize: '8px',
        fontWeight: 'bold',
        marginBottom: '2px'
    },
    interruptRow: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '4px',
        padding: '6px',
        backgroundColor: '#402828',
        borderRadius: '4px'
    },
    interruptTrigger: {
        color: '#f99',
        fontWeight: 'bold',
        fontSize: '10px',
        marginRight: '8px',
        whiteSpace: 'nowrap'
    },
    interruptInfo: {
        display: 'flex',
        flexDirection: 'column',
        flex: 1
    },
    interruptName: {
        color: '#ccc',
        fontWeight: 'bold',
        fontSize: '12px'
    },
    interruptEffect: {
        color: '#fa8',
        fontSize: '9px',
        fontStyle: 'italic'
    },
    specialSection: {
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 8px',
        backgroundColor: '#252020',
        borderTop: '1px solid #533',
        gap: '6px'
    },
    specialRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
    },
    nadirHeader: {
        color: '#a66',
        fontSize: '11px',
        fontWeight: 'bold'
    },
    nadirText: {
        color: '#888',
        fontSize: '10px',
        lineHeight: '1.3'
    },
    apexHeader: {
        color: '#da6',
        fontSize: '11px',
        fontWeight: 'bold'
    },
    apexText: {
        color: '#888',
        fontSize: '10px',
        lineHeight: '1.3'
    },
    maneuverExact: {
        backgroundColor: '#6a4a4a',
        border: '2px solid #f88',
        boxShadow: '0 0 8px #f44'
    },
    maneuverReachable: {
        backgroundColor: '#5a4a4a',
        border: '1px solid #fa8'
    },
    interruptActive: {
        backgroundColor: '#604040',
        border: '1px solid #f99',
        boxShadow: '0 0 6px #f66'
    },
    statDivider: {
        color: '#666',
        fontSize: '10px'
    },
    landingTray: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '8px',
        backgroundColor: '#2a1a1a',
        borderTop: '2px solid #533'
    },
    landingDice: {
        display: 'flex',
        gap: '8px'
    },
    landingDie: {
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        fontWeight: 'bold',
        color: 'white',
        borderRadius: '4px',
        border: '2px solid rgba(255,255,255,0.3)'
    },
    effectBadges: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '4px',
        padding: '4px 8px',
        backgroundColor: '#201515',
        minHeight: '24px'
    },
    effectBadge: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '22px',
        height: '22px',
        backgroundColor: '#4a2a2a',
        border: '1px solid #644',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'help'
    }
};

export default EnemyCard;
