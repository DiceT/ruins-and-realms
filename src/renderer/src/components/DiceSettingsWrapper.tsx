import { useState, useEffect } from 'react'
import { SettingsModal } from '../integrations/anvil-dice-app'
import { TEXTURELIST } from '../integrations/anvil-dice-app'
import { diceEngine } from '../integrations/anvil-dice-app/engine/DiceEngine'

interface DiceSettingsWrapperProps {
    isOpen: boolean
    onClose: () => void
}

/**
 * Wrapper component that manages all the state needed by SettingsModal
 * and connects it to the dice engine.
 */
export function DiceSettingsWrapper({ isOpen, onClose }: DiceSettingsWrapperProps): React.ReactElement {
    // Bounds state
    const [boundsWidth, setBoundsWidth] = useState(44)
    const [boundsDepth, setBoundsDepth] = useState(28)
    const [isAutoFit, setIsAutoFit] = useState(true)

    // Update bounds when auto-fit changes or on mount
    useEffect(() => {
        if (isAutoFit) {
            const core = diceEngine.getEngineCore()
            if (core) {
                const { width, depth } = core.fitBoundsToScreen()
                setBoundsWidth(Math.round(width))
                setBoundsDepth(Math.round(depth))
            }
        }
    }, [isAutoFit, isOpen])

    const handleUpdateBounds = (): void => {
        const core = diceEngine.getEngineCore()
        if (core) {
            core.updateBounds(boundsWidth, boundsDepth)
        }
    }

    return (
        <SettingsModal
            isOpen={isOpen}
            onClose={onClose}
            textures={Object.keys(TEXTURELIST)}
            boundsWidth={boundsWidth}
            setBoundsWidth={setBoundsWidth}
            boundsDepth={boundsDepth}
            setBoundsDepth={setBoundsDepth}
            isAutoFit={isAutoFit}
            setIsAutoFit={setIsAutoFit}
            onUpdateBounds={handleUpdateBounds}
        />
    )
}
