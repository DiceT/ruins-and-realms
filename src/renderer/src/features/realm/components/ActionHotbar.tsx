import React, { useState } from 'react';
import { useRealmStore } from '../stores/useRealmStore';
import { RealmActionType } from '../config/actions';
import woodLeatherBg from '../../../assets/images/backgrounds/wood-leather.png';

interface ActionConfig {
    type: RealmActionType;
    icon: string;
    label: string;
    apCost: number;
    description: string;
}

const ACTIONS: ActionConfig[] = [
    { type: RealmActionType.BUILD, icon: '🏗️', label: 'Build', apCost: 1, description: 'Construct a new building on a hex' },
    { type: RealmActionType.REPAIR, icon: '🔧', label: 'Repair', apCost: 1, description: 'Repair a damaged building (+1 HP)' },
    { type: RealmActionType.EXPLORE, icon: '🧭', label: 'Explore', apCost: 1, description: 'Send an expedition to discover new lands' },
    { type: RealmActionType.DELVE, icon: '🗡️', label: 'Delve', apCost: -1, description: 'Enter a Domain dungeon (uses all AP)' },
    { type: RealmActionType.REST, icon: '💤', label: 'Rest', apCost: 1, description: 'Rest to recover Wellness (+1)' },
    { type: RealmActionType.CLAIM, icon: '🚩', label: 'Claim', apCost: 1, description: 'Claim an unclaimed hex' },
    { type: RealmActionType.TRADE, icon: '🤝', label: 'Trade', apCost: 1, description: 'Trade with visiting merchants' },
    { type: RealmActionType.FESTIVAL, icon: '🎉', label: 'Festival', apCost: 2, description: 'Hold a festival for morale' },
];

interface ActionHotbarProps {
    onActionSelect?: (action: RealmActionType) => void;
    onEndTurn?: () => void;
}

export const ActionHotbar: React.FC<ActionHotbarProps> = ({ onActionSelect, onEndTurn }) => {
    const state = useRealmStore();
    const [hoveredAction, setHoveredAction] = useState<RealmActionType | null>(null);

    const canAffordAction = (action: ActionConfig): boolean => {
        if (action.apCost === -1) return state.actionPoints.current >= 1; // DELVE uses all
        return state.actionPoints.current >= action.apCost;
    };

    return (
        <div style={styles.container}>
            {/* Action Buttons */}
            <div style={styles.actionsSection}>
                {ACTIONS.map(action => {
                    const canAfford = canAffordAction(action);
                    const isHovered = hoveredAction === action.type;

                    return (
                        <button
                            key={action.type}
                            onClick={() => onActionSelect?.(action.type)}
                            onMouseEnter={() => setHoveredAction(action.type)}
                            onMouseLeave={() => setHoveredAction(null)}
                            disabled={!canAfford}
                            style={{
                                ...styles.actionButton,
                                ...(canAfford ? {} : styles.actionDisabled),
                                ...(isHovered && canAfford ? styles.actionHovered : {})
                            }}
                            title={action.description}
                        >
                            <span style={styles.actionIcon}>{action.icon}</span>
                            <span style={styles.actionLabel}>{action.label}</span>
                            <span style={styles.apCost}>
                                {action.apCost === -1 ? 'ALL' : action.apCost} AP
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tooltip */}
            {hoveredAction && (
                <div style={styles.tooltip}>
                    {ACTIONS.find(a => a.type === hoveredAction)?.description}
                </div>
            )}

            {/* End Turn Button */}
            <button
                onClick={onEndTurn}
                style={styles.endTurnButton}
            >
                ⏭️ End Turn
            </button>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 16px',
        backgroundColor: 'transparent',
        height: '64px',
        position: 'relative',
        zIndex: 20
    },
    actionsSection: {
        display: 'flex',
        gap: '6px',
        flex: 1
    },
    actionButton: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 12px',
        backgroundColor: '#2a2a4a',
        border: '2px solid #4a4a6a',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        minWidth: '70px'
    },
    actionDisabled: {
        opacity: 0.4,
        cursor: 'not-allowed',
        borderColor: '#333'
    },
    actionHovered: {
        backgroundColor: '#3a3a6a',
        borderColor: '#e0c080',
        transform: 'translateY(-2px)'
    },
    actionIcon: {
        fontSize: '20px'
    },
    actionLabel: {
        fontSize: '10px',
        color: '#ccc',
        marginTop: '2px'
    },
    apCost: {
        fontSize: '9px',
        color: '#888',
        marginTop: '2px'
    },
    tooltip: {
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        maxWidth: '300px',
        textAlign: 'center',
        zIndex: 100
    },
    endTurnButton: {
        padding: '12px 24px',
        backgroundColor: '#4a6a2a',
        border: '2px solid #6a9a4a',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s'
    }
};

export default ActionHotbar;
