import React, { useMemo } from 'react';
import { PhaseWheelControl } from './PhaseWheelControl';
import { TurnPhase } from '../types/turnTypes';

// Map phases to wheel rotation (to bring that phase to top)
const PHASE_ROTATION: Record<TurnPhase, number> = {
    DAWN: 0,
    MORNING: 72,
    MIDDAY: 144,
    DUSK: 216,
    NIGHT: 288
};

const PHASE_LABELS: Record<TurnPhase, string> = {
    DAWN: 'Dawn',
    MORNING: 'Morning',
    MIDDAY: 'Midday',
    DUSK: 'Dusk',
    NIGHT: 'Night'
};

interface PhaseWheelProps {
    currentPhase: TurnPhase;
    scale?: number;
}

export const PhaseWheel: React.FC<PhaseWheelProps> = ({
    currentPhase,
    scale = 0.333
}) => {
    // Viewport dimensions (fixed size to match desired UI footprint)
    const VIEWPORT_SCALE = 0.5;
    const ASSET_NATURAL_SIZE = 400; // Original asset size
    const viewportWidth = ASSET_NATURAL_SIZE * VIEWPORT_SCALE * 1.2;   // ~240px
    const viewportHeight = ASSET_NATURAL_SIZE * VIEWPORT_SCALE * 0.6;  // ~120px

    // State for continuous animation
    const [animatedRotation, setAnimatedRotation] = React.useState(0);

    // Animation loop: 6 degrees per second (360 degrees per minute)
    React.useEffect(() => {
        let animationFrameId: number;
        let lastTimestamp: number;

        const animate = (timestamp: number) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            const deltaTime = timestamp - lastTimestamp;

            // Limit delta to prevent huge jumps if tab is inactive
            if (deltaTime > 100) {
                lastTimestamp = timestamp;
                animationFrameId = requestAnimationFrame(animate);
                return;
            }

            // 6 degrees per second = 0.006 deg/ms
            const speed = 0.006;
            const deltaRotation = speed * deltaTime;

            setAnimatedRotation(prev => (prev + deltaRotation) % 360);

            lastTimestamp = timestamp;
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // Helper: Map rotation angle to Phase Label
    // Corrected Mapping for Clockwise Time Flow:
    // 0=Dawn, 72=Morning, 144=Midday, 216=Dusk, 288=Night
    const getPhaseLabel = (rot: number) => {
        // Normalize to 0-360 positive
        const r = (rot % 360 + 360) % 360;

        // Define centers (36deg window either side)
        if (r >= 324 || r < 36) return 'DAWN';
        if (r >= 36 && r < 108) return 'MORNING'; // 72 target
        if (r >= 108 && r < 180) return 'MIDDAY'; // 144 target
        if (r >= 180 && r < 252) return 'DUSK';   // 216 target
        if (r >= 252 && r < 324) return 'NIGHT';  // 288 target
        return '...';
    };

    return (
        <div style={styles.container}>
            {/* Viewport - clips the wheel to show only top arc */}
            <div style={{ ...styles.viewport, width: viewportWidth, height: viewportHeight }}>
                {/* Sky backdrop - Rotating Conic Gradient */}
                <div style={{
                    position: 'absolute',
                    top: viewportHeight + 80, // Pivot Point
                    left: '50%',
                    width: 600,
                    height: 600,
                    transform: `translate(-50%, -50%) rotate(${animatedRotation}deg)`,
                    zIndex: 0,
                    background: `conic-gradient(
                        from 0deg,
                        #2d2040 0deg,    /* Dawn */
                        #0a0a12 72deg,   /* Night */
                        #4a2828 144deg,  /* Dusk */
                        #c9a227 216deg,  /* Midday */
                        #8b5a30 288deg,  /* Morning */
                        #2d2040 360deg   /* Dawn Loop */
                    )`
                }} />

                {/* THE CONTROL: Isolated PhaseWheelControl */}
                {/* Positioned at viewport bottom, centered. */}
                {/* The control itself handles rotation and scale internally. */}
                <div style={{
                    position: 'absolute',
                    top: viewportHeight + 80,
                    left: '50%'
                }}>
                    <PhaseWheelControl
                        rotation={animatedRotation}
                        scale={scale}
                    />
                </div>
            </div>

            {/* Phase label / windowsill */}
            <div style={{ ...styles.phaseLabel, width: viewportWidth }}>
                {getPhaseLabel(animatedRotation)}
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px'
    },
    viewport: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px 12px 0 0',
        border: '2px solid #3a3a5a',
        borderBottom: 'none'
    },
    phaseLabel: {
        padding: '6px 0',
        textAlign: 'center',
        color: '#e0c080',
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '2px',
        background: 'rgba(26, 26, 46, 0.85)',
        border: '2px solid #3a3a5a',
        borderTop: '1px solid #4a4a6a',
        borderRadius: '0 0 8px 8px'
    }
};

export default PhaseWheel;
