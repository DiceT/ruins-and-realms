import React from 'react';
import { useRealmStore } from '../stores/useRealmStore';
import { getWellnessStatus, FoodStatus } from '../types/realmTypes';
import { DELVE_COOLDOWN_TURNS } from '../config/actions';
import woodLeatherBg from '../../../assets/images/backgrounds/wood-leather.png';

export type MapLayerToggle = 'TAGS' | 'BUILDINGS' | 'HOMES' | 'DOMAINS' | 'PLOT_LABELS';

interface RealmTopBarProps {
    activeToggles: MapLayerToggle[];
    onToggleLayer: (layer: MapLayerToggle) => void;
    onExitOverworld?: () => void;
}

const LAYER_OPTIONS: { id: MapLayerToggle; label: string; icon: string }[] = [
    { id: 'TAGS', label: 'Tags', icon: '🏷️' },
    { id: 'BUILDINGS', label: 'Buildings', icon: '🏗️' },
    { id: 'HOMES', label: 'Homes', icon: '🏠' },
    { id: 'DOMAINS', label: 'Domains', icon: '⚔️' },
    { id: 'PLOT_LABELS', label: 'Labels', icon: '📍' },
];

export const RealmTopBar: React.FC<RealmTopBarProps> = ({
    activeToggles,
    onToggleLayer,
    onExitOverworld
}) => {
    const state = useRealmStore();

    // Calculate month/week
    const currentMonth = Math.ceil(state.date.turn / DELVE_COOLDOWN_TURNS);
    const currentWeek = ((state.date.turn - 1) % DELVE_COOLDOWN_TURNS) + 1;

    const wellnessStatus = getWellnessStatus(state.wellness);

    return (
        <div style={styles.container}>
            {/* Exit Button */}
            {onExitOverworld && (
                <button onClick={onExitOverworld} style={styles.exitButton} title="Return to Adventure">
                    ← Exit
                </button>
            )}

            {/* Stats Section */}
            <div style={styles.statsSection}>
                <StatItem icon="💰" label="Rings" value={state.rings} />
                <StatItem icon="👥" label="Pop" value={state.population.total} />
                <StatItem
                    icon="❤️"
                    label="Wellness"
                    value={`${state.wellness} (${wellnessStatus})`}
                    color={state.wellness >= 0 ? '#8f8' : '#f88'}
                />
                <StatItem
                    icon="🌾"
                    label="Food"
                    value={state.foodStatus}
                    color={state.foodStatus === FoodStatus.STARVATION ? '#f44' :
                        state.foodStatus === FoodStatus.SURPLUS ? '#8f8' : '#fff'}
                />
                <StatItem
                    icon="📅"
                    label=""
                    value={`Month ${currentMonth}, Week ${currentWeek}`}
                />
            </div>

            {/* Divider */}
            <div style={styles.divider} />

            {/* Map Layer Toggles */}
            <div style={styles.togglesSection}>
                {LAYER_OPTIONS.map(layer => (
                    <button
                        key={layer.id}
                        onClick={() => onToggleLayer(layer.id)}
                        style={{
                            ...styles.toggleButton,
                            ...(activeToggles.includes(layer.id) ? styles.toggleActive : {})
                        }}
                        title={layer.label}
                    >
                        {layer.icon}
                    </button>
                ))}
            </div>

            {/* Action Points */}
            <div style={styles.apSection}>
                <span style={styles.apLabel}>AP</span>
                <span style={styles.apValue}>{state.actionPoints.current}/{state.actionPoints.max}</span>
            </div>
        </div>
    );
};

// Simple stat display component
const StatItem: React.FC<{ icon: string; label: string; value: string | number; color?: string }> = ({
    icon, label, value, color = '#fff'
}) => (
    <div style={styles.statItem}>
        <span style={styles.statIcon}>{icon}</span>
        {label && <span style={styles.statLabel}>{label}:</span>}
        <span style={{ ...styles.statValue, color }}>{value}</span>
    </div>
);

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        backgroundColor: 'transparent',
        height: '48px',
        fontFamily: 'sans-serif',
        fontSize: '13px',
        position: 'relative',
        zIndex: 20
    },
    exitButton: {
        padding: '6px 12px',
        backgroundColor: '#4a2a2a',
        border: '1px solid #8a4a4a',
        borderRadius: '4px',
        color: '#daa',
        cursor: 'pointer',
        fontSize: '12px'
    },
    statsSection: {
        display: 'flex',
        gap: '20px',
        flex: 1
    },
    statItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    statIcon: {
        fontSize: '16px'
    },
    statLabel: {
        color: '#888',
        fontSize: '12px'
    },
    statValue: {
        color: '#fff',
        fontWeight: 'bold'
    },
    divider: {
        width: '1px',
        height: '24px',
        backgroundColor: '#444'
    },
    togglesSection: {
        display: 'flex',
        gap: '4px'
    },
    toggleButton: {
        width: '32px',
        height: '32px',
        backgroundColor: 'transparent',
        border: '1px solid #444',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s'
    },
    toggleActive: {
        backgroundColor: '#2a4a2a',
        borderColor: '#4a8a4a'
    },
    apSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        backgroundColor: '#2a2a4a',
        borderRadius: '4px',
        border: '1px solid #4a4a8a'
    },
    apLabel: {
        color: '#aaf',
        fontSize: '11px',
        fontWeight: 'bold'
    },
    apValue: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: '14px'
    }
};

export default RealmTopBar;
