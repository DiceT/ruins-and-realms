import React from 'react';
import { Maneuver, DiceRoll, PlayerArmor } from '../types';
import { useSettings } from '../../../integrations/anvil-dice-app';

interface PlayerCardProps {
    name: string;
    hp: number;
    maxHp: number;
    maxShift: number;
    maneuvers: Maneuver[];
    armor?: PlayerArmor[];
    currentRoll?: DiceRoll | null;
    enemyRoll?: DiceRoll | null;  // For armor activation
    onManeuverClick?: (maneuver: Maneuver) => void;
}

// Dice triangle component with settings colors
const DiceTriangle: React.FC<{ value: number; isPrimary: boolean }> = ({ value, isPrimary }) => {
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

// Armor triangle - uses ENEMY dice colors since armor triggers off enemy dice
const ArmorTriangle: React.FC<{ value: number; isPrimary: boolean }> = ({ value, isPrimary }) => {
    // Enemy colors: dark crimson for primary, burnt orange for secondary
    const color = isPrimary ? '#8b2323' : '#cc5500';

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
                color: '#fff'
            }}>{value}</span>
        </div>
    );
};

// Empty armor triangle for dynamic shield - just outline, no number
const EmptyArmorTriangle: React.FC = () => {
    return (
        <div style={{
            width: 0,
            height: 0,
            borderLeft: '12px solid transparent',
            borderRight: '12px solid transparent',
            borderBottom: '20px solid #8b2323',
            position: 'relative',
            display: 'inline-block',
            marginRight: '3px',
            opacity: 0.6
        }}>
            <span style={{
                position: 'absolute',
                top: '5px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#fff'
            }}>?</span>
        </div>
    );
};

const ManeuverRow: React.FC<{ maneuver: Maneuver }> = ({ maneuver }) => (
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

export const PlayerCard: React.FC<PlayerCardProps> = ({
    name,
    hp,
    maxHp,
    maxShift,
    maneuvers,
    armor = [],
    currentRoll,
    enemyRoll,
    onManeuverClick
}) => {
    // Calculate if maneuver is reachable
    const getManeuverStatus = (m: Maneuver): 'exact' | 'reachable' | 'none' => {
        if (!currentRoll) return 'none';
        const [p, s] = currentRoll;
        const [tp, ts] = m.dice;

        // Exact match
        if (p === tp && s === ts) return 'exact';

        // Reachable within maxShift
        const distance = Math.abs(p - tp) + Math.abs(s - ts);
        if (distance <= maxShift) return 'reachable';

        return 'none';
    };

    // Parse armor trigger like "Primary 4" or "Secondary 2" or "P5" or "S2"
    const parseArmorTrigger = (trigger: string): { isPrimary: boolean; value: number } | null => {
        const match = trigger.match(/(Primary|Secondary|P|S)\s*(\d+)/i);
        if (!match) return null;
        const [, die, value] = match;
        const isPrimary = die.toLowerCase().startsWith('p');
        return { isPrimary, value: parseInt(value) };
    };

    // Check if any trigger in the array is active based on enemy roll
    const isAnyTriggerActive = (triggers: string[]): boolean => {
        if (!enemyRoll) return false;
        return triggers.some(trigger => {
            const parsed = parseArmorTrigger(trigger);
            if (!parsed) return false;
            if (parsed.isPrimary && enemyRoll[0] === parsed.value) return true;
            if (!parsed.isPrimary && enemyRoll[1] === parsed.value) return true;
            return false;
        });
    };

    // Check if dynamic shield is active (uses player's secondary as trigger value)
    const isShieldActive = (): boolean => {
        if (!enemyRoll || !currentRoll) return false;
        // Shield blocks when enemy Primary matches player's Secondary
        return enemyRoll[0] === currentRoll[1];
    };

    return (
        <div style={styles.card}>
            {/* Header */}
            <div style={styles.header}>
                <span style={styles.name}>{name}</span>
            </div>

            {/* Portrait - with border */}
            <div style={styles.portrait}>
                <span style={{ color: '#555', fontSize: '12px' }}>Portrait</span>
            </div>

            {/* Stats Row: HP left, Shift right */}
            <div style={styles.statsRow}>
                <div style={styles.statBox}>
                    <div style={styles.statValue}>{hp}<span style={styles.statDivider}>/</span>{maxHp}</div>
                    <div style={styles.statLabel}>HP</div>
                </div>
                <div style={styles.statBox}>
                    <div style={styles.statValue}>{maxShift}</div>
                    <div style={styles.statLabel}>SHIFT</div>
                </div>
            </div>

            {/* Maneuvers */}
            <div style={styles.maneuvers}>
                {maneuvers.map((m) => {
                    const status = getManeuverStatus(m);
                    return (
                        <div
                            key={m.id}
                            style={{
                                ...styles.maneuverRow,
                                ...(status === 'exact' ? styles.maneuverExact : {}),
                                ...(status === 'reachable' ? styles.maneuverReachable : {}),
                                cursor: status !== 'none' ? 'pointer' : 'default'
                            }}
                            onClick={() => status !== 'none' && onManeuverClick?.(m)}
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

                {/* Armor Section */}
                {armor.length > 0 && armor.map((a) => {
                    // For dynamic shield, use player's secondary roll as the trigger value
                    const effectiveTriggers = a.isDynamic && currentRoll
                        ? [`P${currentRoll[1]}`]
                        : a.triggers;
                    const isActive = a.isDynamic
                        ? isShieldActive()
                        : isAnyTriggerActive(a.triggers);

                    return (
                        <div
                            key={a.id}
                            style={{
                                ...styles.armorRow,
                                ...(isActive ? styles.armorActive : {})
                            }}
                        >
                            <div style={styles.diceContainer}>
                                {a.isDynamic ? (
                                    currentRoll ? (
                                        <ArmorTriangle value={currentRoll[1]} isPrimary={true} />
                                    ) : (
                                        <EmptyArmorTriangle />
                                    )
                                ) : (
                                    effectiveTriggers.map((trigger, i) => {
                                        const parsed = parseArmorTrigger(trigger);
                                        return parsed && (
                                            <ArmorTriangle key={i} value={parsed.value} isPrimary={parsed.isPrimary} />
                                        );
                                    })
                                )}
                            </div>
                            <div style={styles.maneuverInfo}>
                                <span style={styles.armorName}>{a.name}</span>
                                <span style={styles.armorEffect}>{a.effect}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    card: {
        width: '280px',
        height: '750px',
        backgroundColor: '#2a2a3a',
        border: '2px solid #555',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        fontSize: '10px',
    },
    header: {
        backgroundColor: '#3a3a5a',
        padding: '6px',
        textAlign: 'center',
        borderBottom: '1px solid #555'
    },
    name: {
        fontWeight: 'bold',
        color: '#e0c080',
        fontSize: '14px',
        textTransform: 'uppercase'
    },
    portrait: {
        margin: '8px',
        flex: 1,
        minHeight: 0,
        maxHeight: '220px',
        backgroundColor: '#1a1a2a',
        border: '2px solid #444',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    statsRow: {
        display: 'flex',
        backgroundColor: '#252535',
        borderTop: '1px solid #444'
    },
    statBox: {
        flex: 1,
        textAlign: 'center',
        padding: '6px',
        borderRight: '1px solid #444'
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
        backgroundColor: '#333345',
        borderRadius: '4px'
    },
    diceContainer: {
        display: 'flex',
        marginRight: '6px'
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
        color: '#8f8',
        fontSize: '9px',
        fontStyle: 'italic'
    },
    maneuverExact: {
        backgroundColor: '#4a6a4a',
        border: '2px solid #8f8',
        boxShadow: '0 0 8px #4f4'
    },
    maneuverReachable: {
        backgroundColor: '#4a4a5a',
        border: '1px solid #88f'
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
        backgroundColor: '#1a1a2a',
        borderTop: '2px solid #444'
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
    armorRow: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '4px',
        padding: '6px',
        backgroundColor: '#3a3525',
        borderRadius: '4px',
        borderLeft: '3px solid #886'
    },
    armorActive: {
        backgroundColor: '#4a4530',
        border: '2px solid #aa8',
        boxShadow: '0 0 6px #aa8'
    },
    armorName: {
        color: '#dda',
        fontWeight: 'bold',
        fontSize: '12px'
    },
    armorEffect: {
        color: '#aa8',
        fontSize: '9px',
        fontStyle: 'italic'
    },
    missButton: {
        padding: '6px 16px',
        backgroundColor: '#622',
        border: '1px solid #944',
        borderRadius: '4px',
        color: '#faa',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '11px'
    }
};

export default PlayerCard;
