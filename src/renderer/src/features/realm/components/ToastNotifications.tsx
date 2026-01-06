import React, { useEffect, useState } from 'react';

export interface Toast {
    id: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    duration?: number; // ms, default 3000
}

interface ToastNotificationsProps {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

export const ToastNotifications: React.FC<ToastNotificationsProps> = ({
    toasts,
    onDismiss
}) => {
    return (
        <div style={styles.container}>
            {toasts.map(toast => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onDismiss={() => onDismiss(toast.id)}
                />
            ))}
        </div>
    );
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({
    toast,
    onDismiss
}) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const duration = toast.duration ?? 3000;
        const exitTimer = setTimeout(() => setIsExiting(true), duration - 300);
        const dismissTimer = setTimeout(onDismiss, duration);

        return () => {
            clearTimeout(exitTimer);
            clearTimeout(dismissTimer);
        };
    }, [toast.duration, onDismiss]);

    return (
        <div
            style={{
                ...styles.toast,
                ...getTypeStyle(toast.type),
                ...(isExiting ? styles.toastExiting : {})
            }}
            onClick={onDismiss}
        >
            <span style={styles.icon}>{getIcon(toast.type)}</span>
            <span style={styles.message}>{toast.message}</span>
        </div>
    );
};

const getIcon = (type: Toast['type']): string => {
    switch (type) {
        case 'SUCCESS': return '✓';
        case 'WARNING': return '⚠';
        case 'ERROR': return '✕';
        default: return 'ℹ';
    }
};

const getTypeStyle = (type: Toast['type']): React.CSSProperties => {
    switch (type) {
        case 'SUCCESS':
            return {
                backgroundColor: 'rgba(40, 80, 40, 0.95)',
                borderColor: '#4a8a4a'
            };
        case 'WARNING':
            return {
                backgroundColor: 'rgba(80, 80, 40, 0.95)',
                borderColor: '#8a8a4a'
            };
        case 'ERROR':
            return {
                backgroundColor: 'rgba(80, 40, 40, 0.95)',
                borderColor: '#8a4a4a'
            };
        default:
            return {
                backgroundColor: 'rgba(40, 40, 80, 0.95)',
                borderColor: '#4a4a8a'
            };
    }
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'absolute',
        top: '60px', // Just below top bar
        left: '16px',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 200
    },
    toast: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        backgroundColor: 'rgba(40, 40, 80, 0.95)',
        border: '1px solid #4a4a8a',
        borderRadius: '6px',
        cursor: 'pointer',
        animation: 'slideIn 0.3s ease-out',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    },
    toastExiting: {
        opacity: 0,
        transform: 'translateX(-20px)',
        transition: 'all 0.3s ease-in'
    },
    icon: {
        fontSize: '18px',
        fontWeight: 'bold'
    },
    message: {
        flex: 1,
        fontSize: '13px',
        color: '#fff'
    }
};

export default ToastNotifications;
