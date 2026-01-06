import React from 'react';

// Phase wheel assets
import phaseRing from '../../../assets/images/ui/phase-wheel/phase-ring.png';
import phase01 from '../../../assets/images/ui/phase-wheel/phase-01.png';
import phase02 from '../../../assets/images/ui/phase-wheel/phase-02.png';
import phase03 from '../../../assets/images/ui/phase-wheel/phase-03.png';
import phase04 from '../../../assets/images/ui/phase-wheel/phase-04.png';
import phase05 from '../../../assets/images/ui/phase-wheel/phase-05.png';

import { PhaseWheelControl } from './PhaseWheelControl';

/**
 * Debug overlay to assemble the phase wheel correctly
 * Displays ring + glyphs centered on screen
 */
export const PhaseWheelDebug: React.FC = () => {
    // Single scale for EVERYTHING
    const SCALE = 0.375;

    // Common glyph style - positioned at top, anchored to ring center
    const glyphStyle = (rotationDeg: number): React.CSSProperties => ({
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: `translateX(-50%) rotate(${rotationDeg}deg)`,
        transformOrigin: 'center center',  // Same as ring center
    });

    return (
        <div style={styles.overlay}>
            {/* Assembly container */}
            <div style={styles.assemblyContainer}>
                {/* NEW: Isolated Control */}
                <PhaseWheelControl rotation={0} scale={SCALE} />

                {/* OLD: Ring wrapper - scaled, at 0° rotation */}
                {/* <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) scale(${SCALE})`,
                    }}
                >
                    <img src={phaseRing} alt="Ring" />

                    <div style={{ position: 'absolute', inset: 0, transform: 'rotate(0deg)' }}>
                        <img src={phase01} alt="Glyph 01" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, transform: 'rotate(-72deg)' }}>
                        <img src={phase02} alt="Glyph 02" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, transform: 'rotate(-144deg)' }}>
                        <img src={phase03} alt="Glyph 03" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, transform: 'rotate(-216deg)' }}>
                        <img src={phase04} alt="Glyph 04" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, transform: 'rotate(-288deg)' }}>
                        <img src={phase05} alt="Glyph 05" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }} />
                    </div>
                </div> */}
            </div>

            <div style={styles.controls}>
                <p style={{ margin: 0 }}>Scale: {SCALE} | All 5 glyphs at 72° intervals</p>
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
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
    },
    assemblyContainer: {
        position: 'relative',
        width: 600,
        height: 600
    },
    controls: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        color: '#fff',
        textAlign: 'center',
        fontSize: 14
    }
};

export default PhaseWheelDebug;
