import React, { useEffect, useRef } from 'react'
import { diceEngine } from '../integrations/anvil-dice-app/engine/DiceEngine'
import type { RollResult } from '../integrations/anvil-dice-app/engine/types'

export function DiceOverlay(): React.ReactElement {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!containerRef.current) return

        // Initialize once
        diceEngine.initialize(containerRef.current)
        diceEngine.resize()

        // Handle resize
        const handleResize = (): void => {
            diceEngine.resize()
        }
        window.addEventListener('resize', handleResize)

        const onRollStart = (): void => {
            if (containerRef.current) {
                diceEngine.resize()
            }
        }

        const onRollComplete = (results: RollResult): void => {
            console.log('DiceOverlay: Roll Complete', results)
        }

        diceEngine.on('rollStart', onRollStart)
        diceEngine.on('rollComplete', onRollComplete)

        return () => {
            window.removeEventListener('resize', handleResize)
            diceEngine.off('rollStart', onRollStart)
            diceEngine.off('rollComplete', onRollComplete)
        }
    }, [])


    return (
        <div
            id="dice-overlay"
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '300px',
                height: '100%',
                zIndex: 9999,
                pointerEvents: 'none' // Allow clicks to pass through
            }}
        >
        </div>
    )
}
