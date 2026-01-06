import React from 'react';
import { PhaseWheel } from './PhaseWheel';
import { useRealmStore } from '../stores/useRealmStore';
import woodLeatherBg from '../../../assets/images/backgrounds/wood-leather.png';

interface RealmRightPanelProps {
    children?: React.ReactNode;
}

export const RealmRightPanel: React.FC<RealmRightPanelProps> = ({ children }) => {
    const { phase } = useRealmStore();

    return (
        <div style={styles.container}>
            {/* Phase Wheel Section */}
            <div style={styles.phaseWheelSection}>
                <PhaseWheel currentPhase={phase} />
            </div>

            {/* Selection Panel */}
            <div style={styles.selectionSection}>
                <h4 style={styles.sectionTitle}>Selected</h4>
                <div style={styles.selectionPlaceholder}>
                    Click a hex or building to view details
                </div>
            </div>

            {/* Dice Tray Section */}
            <div style={styles.diceTraySection}>
                <h4 style={styles.sectionTitle}>Dice Tray</h4>
                <div style={styles.dicePlaceholder}>
                    🎲 Dice will appear here
                </div>
            </div>

            {children}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        width: '280px',
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 20
    },
    phaseWheelSection: {
        padding: '12px',
        borderBottom: '1px solid #3a3a5a',
        background: 'transparent'
    },
    skyBackdrop: {
        background: 'linear-gradient(to bottom, #1a3a6a, #4a6090)',
        borderRadius: '8px',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '120px'
    },
    wheelPlaceholder: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        border: '3px solid #e0c080',
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 0 20px rgba(224, 192, 128, 0.3)'
    },
    wheelIcon: {
        fontSize: '32px'
    },
    phaseLabel: {
        color: '#e0c080',
        fontSize: '10px',
        fontWeight: 'bold',
        marginTop: '4px'
    },
    selectionSection: {
        flex: 1,
        padding: '12px',
        borderBottom: '1px solid #3a3a5a',
        overflowY: 'auto'
    },
    sectionTitle: {
        margin: '0 0 8px 0',
        color: '#aaa',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '1px'
    },
    selectionPlaceholder: {
        color: '#666',
        fontSize: '12px',
        fontStyle: 'italic',
        textAlign: 'center',
        padding: '20px'
    },
    diceTraySection: {
        padding: '12px',
        minHeight: '100px'
    },
    dicePlaceholder: {
        color: '#888',
        fontSize: '14px',
        textAlign: 'center',
        padding: '20px',
        border: '2px dashed #444',
        borderRadius: '8px'
    }
};

export default RealmRightPanel;
