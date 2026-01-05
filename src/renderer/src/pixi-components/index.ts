/**
 * Pixi Components - Barrel Export
 * 
 * Central export point for all @pixi/react components and hooks.
 */

// Application wrapper
export { PixiApplication, extend } from './PixiApplication'

// Stages
export { PixiTestStage } from './stages/PixiTestStage'
export { DungeonStage } from './stages/DungeonStage'
export type { DungeonStageProps } from './stages/DungeonStage'

// Views
export { DungeonView } from './views/DungeonView'
export type { DungeonViewProps } from './views/DungeonView'

// Test Pages
export { DungeonTestPage } from './DungeonTestPage'

// Hooks - Layer bridges
export { 
  useFloorLayer,
  useWallLayer,
  useGridLayer,
  useLabelLayer,
  useBackgroundLayer,
  useVisibilityLayer,
  useSpineDebugLayer,
  usePanZoom
} from './hooks'
