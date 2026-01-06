import React, { useState } from 'react';

type RealmTab =
    | 'CHARACTER'
    | 'NOTABLE_PEOPLE'
    | 'REALM_LEDGER'
    | 'BUILDINGS'
    | 'HOUSES_MANORS'
    | 'UNCLAIMED_LAND'
    | 'LAND_LOG'
    | 'ALMANAC';

interface RealmManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TABS: { id: RealmTab; label: string }[] = [
    { id: 'CHARACTER', label: 'Character' },
    { id: 'NOTABLE_PEOPLE', label: 'Notable People' },
    { id: 'REALM_LEDGER', label: 'Realm Ledger' },
    { id: 'BUILDINGS', label: 'Buildings' },
    { id: 'HOUSES_MANORS', label: 'Houses & Manors' },
    { id: 'UNCLAIMED_LAND', label: 'Unclaimed Land Log' },
    { id: 'LAND_LOG', label: 'Land Log' },
    { id: 'ALMANAC', label: 'Almanac' },
];

export const RealmManagementModal: React.FC<RealmManagementModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<RealmTab>('CHARACTER');

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.title}>Realm Management</h2>
                    <button onClick={onClose} style={styles.closeButton}>✕</button>
                </div>

                {/* Tab Bar */}
                <div style={styles.tabBar}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                ...styles.tab,
                                ...(activeTab === tab.id ? styles.activeTab : {})
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div style={styles.content}>
                    <TabContent tab={activeTab} />
                </div>
            </div>
        </div>
    );
};

// Placeholder content for each tab
const TabContent: React.FC<{ tab: RealmTab }> = ({ tab }) => {
    const placeholders: Record<RealmTab, { title: string; description: string }> = {
        CHARACTER: {
            title: '🧙 Character',
            description: 'View your character stats, titles, and progression.'
        },
        NOTABLE_PEOPLE: {
            title: '👥 Notable People',
            description: 'NPCs, companions, and important figures in your realm.'
        },
        REALM_LEDGER: {
            title: '📊 Realm Ledger',
            description: 'Economy overview: Rings, income, expenses, taxes.'
        },
        BUILDINGS: {
            title: '🏗️ Buildings',
            description: 'All constructed and in-progress buildings.'
        },
        HOUSES_MANORS: {
            title: '🏰 Houses & Manors',
            description: 'Noble houses, manors, and their occupants.'
        },
        UNCLAIMED_LAND: {
            title: '🗺️ Unclaimed Land Log',
            description: 'Discovered but unclaimed hexes available for expansion.'
        },
        LAND_LOG: {
            title: '📜 Land Log',
            description: 'History of land claims, disputes, and territory changes.'
        },
        ALMANAC: {
            title: '📖 Almanac',
            description: 'Lore, discoveries, and collected knowledge.'
        }
    };

    const { title, description } = placeholders[tab];

    return (
        <div style={styles.placeholder}>
            <h3 style={styles.placeholderTitle}>{title}</h3>
            <p style={styles.placeholderText}>{description}</p>
            <div style={styles.comingSoon}>Content Coming Soon</div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000
    },
    modal: {
        width: '95vw',
        height: '90vh',
        backgroundColor: '#1a1a2e',
        borderRadius: '12px',
        border: '2px solid #3a3a5a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid #3a3a5a',
        backgroundColor: '#16162a'
    },
    title: {
        margin: 0,
        color: '#e0c080',
        fontFamily: 'serif',
        fontSize: '24px'
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: '#888',
        fontSize: '24px',
        cursor: 'pointer',
        padding: '4px 8px'
    },
    tabBar: {
        display: 'flex',
        gap: '4px',
        padding: '12px 16px',
        backgroundColor: '#12122a',
        borderBottom: '1px solid #3a3a5a',
        overflowX: 'auto'
    },
    tab: {
        padding: '10px 20px',
        backgroundColor: 'transparent',
        border: '1px solid #3a3a5a',
        borderRadius: '6px',
        color: '#aaa',
        cursor: 'pointer',
        fontSize: '14px',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s'
    },
    activeTab: {
        backgroundColor: '#2a2a4a',
        borderColor: '#e0c080',
        color: '#e0c080'
    },
    content: {
        flex: 1,
        padding: '24px',
        overflowY: 'auto'
    },
    placeholder: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#888'
    },
    placeholderTitle: {
        fontSize: '32px',
        color: '#ccc',
        marginBottom: '16px'
    },
    placeholderText: {
        fontSize: '16px',
        color: '#888',
        marginBottom: '32px'
    },
    comingSoon: {
        padding: '12px 24px',
        border: '2px dashed #444',
        borderRadius: '8px',
        color: '#666',
        fontSize: '14px'
    }
};

export default RealmManagementModal;
