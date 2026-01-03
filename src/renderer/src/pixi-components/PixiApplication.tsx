/**
 * PixiApplication
 * 
 * Base Application wrapper for @pixi/react.
 * Centralizes PixiJS component registration via extend() and provides
 * a reusable Application shell with sensible defaults.
 * 
 * Usage:
 *   <PixiApplication resizeTo={parentRef}>
 *     <DungeonStage dungeonData={...} />
 *   </PixiApplication>
 */

import { Application, extend } from '@pixi/react'
import {
    Container,
    Graphics,
    Sprite,
    Text,
    TilingSprite,
    NineSliceSprite
} from 'pixi.js'
import { ReactNode, RefObject } from 'react'

// Register all PixiJS components we'll use
// This must be called before any @pixi/react components render
extend({
    Container,
    Graphics,
    Sprite,
    Text,
    TilingSprite,
    NineSliceSprite
})

export interface PixiApplicationProps {
    /** React ref to the parent element for resize handling */
    resizeTo?: RefObject<HTMLElement | null>
    /** Fixed width (use if not using resizeTo) */
    width?: number
    /** Fixed height (use if not using resizeTo) */
    height?: number
    /** Background color */
    backgroundColor?: number
    /** Child components (stages) */
    children: ReactNode
}

/**
 * Reusable PixiJS Application wrapper.
 * Handles canvas creation and component registration.
 */
export function PixiApplication({
    resizeTo,
    width = 800,
    height = 600,
    backgroundColor = 0x1a1a2e,
    children
}: PixiApplicationProps) {
    return (
        <Application
            resizeTo={resizeTo?.current ?? undefined}
            width={resizeTo ? undefined : width}
            height={resizeTo ? undefined : height}
            background={backgroundColor}
            antialias={true}
            resolution={window.devicePixelRatio || 1}
            autoDensity={true}
        >
            {children}
        </Application>
    )
}

// Also export extend for cases where consumers need to register additional components
export { extend }
