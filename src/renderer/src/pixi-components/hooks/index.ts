/**
 * Layer Hooks
 * 
 * React hooks that bridge existing layer classes with @pixi/react.
 * Each hook manages the lifecycle of a layer class instance and provides
 * its container for integration into the React component tree.
 * 
 * Design Philosophy:
 * -----------------
 * These hooks don't recreate rendering logic. They wrap existing layer classes,
 * allowing us to reuse all drawing code while gaining React's declarative lifecycle.
 * 
 * Usage Pattern:
 * -------------
 * const { container, layer } = useFloorLayer(floorData, config)
 * // container can be added to parent via extend() or returned as element
 * // layer provides direct access if needed (e.g., for layer.clear())
 */

export { useFloorLayer } from './useFloorLayer'
export { useWallLayer } from './useWallLayer'
export { useGridLayer } from './useGridLayer'
export { useLabelLayer } from './useLabelLayer'
export { useBackgroundLayer } from './useBackgroundLayer'
export { useVisibilityLayer } from './useVisibilityLayer'
export { useSpineDebugLayer } from './useSpineDebugLayer'
export { useWalkmapLayer } from './useWalkmapLayer'
export { useHeatmapLayer } from './useHeatmapLayer'
export { useObjectLayer } from './useObjectLayer'
export { usePanZoom } from './usePanZoom'


