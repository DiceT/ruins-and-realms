import React from 'react';
import { Creature, EnemyManeuver, Interrupt, DiceRoll } from '../types';
import { useSettings } from '../../../integrations/anvil-dice-app';

interface EnemyCardProps {
    enemy: Creature;
    currentRoll?: DiceRoll | null;  // Enemy's roll for maneuver highlighting
    playerRoll?: DiceRoll | null;   // Player's roll for interrupt checking
    onManeuverClick?: (maneuver: EnemyManeuver, index: number) => void;
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

// Interrupt triangle - uses PLAYER's dice colors since interrupts trigger off player's roll
const InterruptTriangle: React.FC<{ value: number; isPrimary: boolean }> = ({ value, isPrimary }) => {
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

export const EnemyCard: React.FC<EnemyCardProps> = ({ enemy, currentRoll, playerRoll, onManeuverClick }) => {
    // Calculate if maneuver is reachable (enemy uses their own shift)
    const getManeuverStatus = (m: EnemyManeuver): 'exact' | 'reachable' | 'none' => {
        if (!currentRoll) return 'none';
        const [p, s] = currentRoll;
        const [tp, ts] = m.dice;

        if (p === tp && s === ts) return 'exact';

        const distance = Math.abs(p - tp) + Math.abs(s - ts);
        if (distance <= enemy.shift) return 'reachable';

        return 'none';
    };

    // Check if interrupt is triggered by PLAYER'S roll
    const isInterruptActive = (intr: Interrupt): boolean => {
        if (!playerRoll) return false;
        // Parse trigger like "Primary 4" or "Secondary 3"
        const match = intr.trigger.match(/(Primary|Secondary)\s*(\d+)/i);
        if (!match) return false;
        const [, die, value] = match;
        const targetVal = parseInt(value);
        if (die.toLowerCase() === 'primary' && playerRoll[0] === targetVal) return true;
        if (die.toLowerCase() === 'secondary' && playerRoll[1] === targetVal) return true;
        return false;
    };

    // Parse interrupt trigger to get die type and value for DiceTriangle
    const parseInterruptTrigger = (trigger: string): { isPrimary: boolean; value: number } | null => {
        const match = trigger.match(/(Primary|Secondary)\s*(\d+)/i);
        if (!match) return null;
        const [, die, value] = match;
        return {
            isPrimary: die.toLowerCase() === 'primary',
            value: parseInt(value)
        };
    };

    return (
        <div style={styles.card}>
            {/* Header with Level */}
            <div style={styles.header}>
                <span style={styles.name}>{enemy.name}</span>
                <span style={styles.level}>Lvl {enemy.level}</span>
            </div>

            {/* Portrait - with border */}
            <div style={styles.portrait}>
                <span style={{ color: '#555', fontSize: '12px' }}>Portrait</span>
            </div>

            {/* Stats Row: HP left, Shift right */}
            <div style={styles.statsRow}>
                <div style={styles.statBox}>
                    <div style={styles.statValue}>{enemy.hp}<span style={styles.statDivider}>/</span>{enemy.maxHp}</div>
                    <div style={styles.statLabel}>HP</div>
                </div>
                <div style={styles.statBox}>
                    <div style={styles.statValue}>{enemy.shift}</div>
                    <div style={styles.statLabel}>SHIFT</div>
                </div>
            </div>

            {/* Maneuvers */}
            <div style={styles.maneuvers}>
                {enemy.maneuvers.map((m, i) => {
                    const status = getManeuverStatus(m);
                    return (
                        <div
                            key={i}
                            style={{
                                ...styles.maneuverRow,
                                ...(status === 'exact' ? styles.maneuverExact : {}),
                                ...(status === 'reachable' ? styles.maneuverReachable : {}),
                                cursor: status !== 'none' ? 'pointer' : 'default'
                            }}
                            onClick={() => status !== 'none' && onManeuverClick?.(m, i)}
                        >
                            <div style={styles.diceContainer}>
                                <DiceTriangle value={m.dice[0]} isPrimary={true} />
                                <DiceTriangle value={m.dice[1]} isPrimary={false} />
                            </div>
                            <div style={styles.maneuverInfo}>
                                <span style={styles.maneuverName}>{m.name}</span>
                                <span style={styles.maneuverDamage}>{m.damage}</span>
                                {m.effect && <span style={styles.maneuverEffect}>{m.effect}</span>}
                            </div>
                        </div>
                    );
                })}

                {/* Interrupts - right under maneuvers */}
                {enemy.interrupts && enemy.interrupts.length > 0 && enemy.interrupts.map((intr, i) => {
                    const parsed = parseInterruptTrigger(intr.trigger);
                    return (
                        <div key={`int - ${i} `} style={{
                            ...styles.interruptRow,
                            ...(isInterruptActive(intr) ? styles.interruptActive : {})
                        }}>
                            <div style={styles.diceContainer}>
                                {parsed && <InterruptTriangle value={parsed.value} isPrimary={parsed.isPrimary} />}
                            </div>
                            <div style={styles.interruptInfo}>
                                <span style={styles.interruptName}>Interrupt</span>
                                <span style={styles.interruptEffect}>{intr.effect}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Mishap/Prime */}
            <div style={styles.specialSection}>
                <div style={styles.mishap} title={enemy.mishap}>💀 Mishap</div>
                <div style={styles.prime} title={enemy.prime}>👑 Prime</div>
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
        justifyContent: 'space-around',
        padding: '3px',
        backgroundColor: '#252020',
        borderTop: '1px solid #533'
    },
    mishap: {
        color: '#a66',
        fontSize: '9px',
        cursor: 'help'
    },
    prime: {
        color: '#da6',
        fontSize: '9px',
        cursor: 'help'
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
    }
};

export default EnemyCard;
