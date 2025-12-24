import React, { useEffect } from 'react';
import { useSettings } from '../store/SettingsContext';
import { diceEngine } from '../engine/DiceEngine';

/**
 * Syncs React settings state to the dice engine.
 * Uses the diceEngine singleton directly.
 */
export const SettingsSync: React.FC = () => {
    const { settings } = useSettings();

    useEffect(() => {
        const engine = diceEngine.getEngineCore();
        if (engine) {
            engine.updateSettings(settings);
        }
    }, [settings]);

    return null;
};
