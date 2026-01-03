/**
 * @pixi/react TypeScript Declarations
 * 
 * Extends @pixi/react's type catalogue with custom components and unprefixed elements.
 * See: https://github.com/pixijs/pixi-react#for-typescript-users
 */

import { PixiReactElementProps, UnprefixedPixiElements } from '@pixi/react'
import type { Viewport } from 'pixi-viewport'

declare module '@pixi/react' {
  interface PixiElements extends UnprefixedPixiElements {
    // Custom component declarations go here
    // Example: viewport: PixiReactElementProps<typeof Viewport>
  }
}

// Re-export common types used throughout the pixi-components
export type { PixiReactElementProps }
