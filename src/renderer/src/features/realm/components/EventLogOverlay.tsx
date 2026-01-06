import React from 'react';

export interface EventLogEntry {
    id: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
    turn: number;
    timestamp: number;
}

interface EventLogOverlayProps {
    entries: EventLogEntry[];
    maxEntries?: number;
}

export const EventLogOverlay: React.FC<EventLogOverlayProps> = ({
    entries,
    maxEntries = 10
}) => {
    const visibleEntries = entries.slice(-maxEntries);

    return (
        <div style={styles.container}>
            {visibleEntries.map((entry, index) => (
                <div
                    key={entry.id}
                    style={{
                        ...styles.entry,
                        ...getTypeStyle(entry.type),
                        opacity: 0.5 + (index / maxEntries) * 0.5 // Fade older entries
                    }}
                >
                    <span style={styles.turnBadge}>T{entry.turn}</span>
                    <span style={styles.message}>{entry.message}</span>
                </div>
            ))}
        </div>
    );
};

const getTypeStyle = (type: EventLogEntry['type']): React.CSSProperties => {
    switch (type) {
        case 'SUCCESS':
            return { borderLeftColor: '#4a8a4a' };
        case 'WARNING':
            return { borderLeftColor: '#8a8a4a' };
        case 'DANGER':
            return { borderLeftColor: '#8a4a4a' };
        default:
            return { borderLeftColor: '#4a4a8a' };
    }
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'absolute',
        top: '80px', // Below top bar + toast space
        left: '16px',
        width: '320px',
        maxHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        pointerEvents: 'none',
        zIndex: 100
    },
    entry: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        backgroundColor: 'rgba(20, 20, 40, 0.8)',
        borderLeft: '3px solid #4a4a8a',
        borderRadius: '0 4px 4px 0',
        fontSize: '12px',
        color: '#ccc'
    },
    turnBadge: {
        padding: '2px 6px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '3px',
        fontSize: '10px',
        color: '#888'
    },
    message: {
        flex: 1
    }
};

export default EventLogOverlay;
