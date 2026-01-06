import React from 'react';

// Phase wheel assets
import phaseRing from '../../../assets/images/ui/phase-wheel/phase-ring.png';
import phase01 from '../../../assets/images/ui/phase-wheel/phase-01.png';
import phase02 from '../../../assets/images/ui/phase-wheel/phase-02.png';
import phase03 from '../../../assets/images/ui/phase-wheel/phase-03.png';
import phase04 from '../../../assets/images/ui/phase-wheel/phase-04.png';
import phase05 from '../../../assets/images/ui/phase-wheel/phase-05.png';

interface PhaseWheelControlProps {
    rotation: number;
    scale?: number;
}

/**
 * The core Phase Wheel assembly.
 * This component's layout is IMMUTABLE and IMMUNE to outside disruption.
 * It strictly maintains the relative positioning of the ring and its glyphs.
 */
export const PhaseWheelControl: React.FC<PhaseWheelControlProps> = ({
    rotation,
    scale = 0.375
}) => {
    return (
        // The "Control" wrapper - scaled and rotated as one unit
        <div
            style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
                // Strict sizing to ensure coordinate system integrity
                // width: 0, 
                // height: 0,
                // Center alignment
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            {/* Ring - base layer */}
            <img src={phaseRing} alt="Ring" />

            {/* Each glyph wrapped in full-size div that rotates from center */}
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
        </div>
    );
};
