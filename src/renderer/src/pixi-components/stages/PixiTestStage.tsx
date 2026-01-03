/**
 * PixiTestStage
 * 
 * Simple test component to verify @pixi/react is working correctly.
 * Renders a colored rectangle with some text.
 * 
 * DELETE THIS FILE after verification is complete.
 */

import { useCallback } from 'react'

export function PixiTestStage() {
    // Draw callback for the graphics element
    const drawRect = useCallback((g: any) => {
        g.clear()
        // Purple rectangle
        g.rect(50, 50, 200, 150)
        g.fill({ color: 0x7c3aed })
        // Gold border
        g.rect(50, 50, 200, 150)
        g.stroke({ color: 0xfbbf24, width: 3 })
    }, [])

    const drawCircle = useCallback((g: any) => {
        g.clear()
        // Glowing orb effect
        g.circle(400, 125, 50)
        g.fill({ color: 0x22d3ee, alpha: 0.8 })
        g.circle(400, 125, 60)
        g.stroke({ color: 0x22d3ee, width: 2, alpha: 0.4 })
    }, [])

    return (
        <pixiContainer>
            {/* Background rectangle */}
            <pixiGraphics draw={drawRect} />

            {/* Floating orb */}
            <pixiGraphics draw={drawCircle} />

            {/* Title text */}
            <pixiText
                text="@pixi/react is working! 🎉"
                x={50}
                y={220}
                style={{
                    fontFamily: 'Arial',
                    fontSize: 24,
                    fill: 0xffffff,
                    dropShadow: {
                        color: 0x000000,
                        blur: 4,
                        distance: 2
                    }
                }}
            />

            {/* Status text */}
            <pixiText
                text="This test stage can be deleted after verification."
                x={50}
                y={260}
                style={{
                    fontFamily: 'Arial',
                    fontSize: 14,
                    fill: 0x888888
                }}
            />
        </pixiContainer>
    )
}
