import React from 'react';
import RealmManagementScreen from '../../../../../components/realm/RealmManagementScreen';

interface RealmManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const RealmManagementModal: React.FC<RealmManagementModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <RealmManagementScreen onClose={onClose} />
            </div>
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
        backgroundColor: '#0f172a', // slate-900 to match new UI
        borderRadius: '12px',
        border: '2px solid #334155', // slate-700
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
    }
};

export default RealmManagementModal;
