import {
  SpineSeedState,
  SpineSeedSettings,
  DungeonData,
  Room,
  RoomSeed
} from '../types'

/**
 * SpineSeedClassifier
 * 
 * Responsible for transforming the internal SpineSeedState (which contains room seeds and raw grids)
 * into a clean, unified DungeonData object. This includes filtering/pruning invalid geometry.
 */
export class SpineSeedClassifierFixed {
  
  /**
   * Classify SpineSeedState into DungeonData
   */
  public classify(state: SpineSeedState, settings: SpineSeedSettings): DungeonData {
    const rawSeeds = state.roomSeeds || []
    console.warn(`[SpineSeedClassifier] Classifying ${rawSeeds.length} seeds. First 5 IDs:`, rawSeeds.slice(0, 5).map(s => s.id).join(', '))
    
    // 1. Prune rooms (e.g. 1x1 or 1xN seeds that failed to grow)
    const prunedRooms = this.pruneRooms(rawSeeds)
    
    // 2. Map RoomSeed to Room interface
    const rooms = prunedRooms.map(seed => this.mapSeedToRoom(seed))
    
    return {
      gridWidth: settings.gridWidth,
      gridHeight: settings.gridHeight,
      rooms,
      spine: state.spineTiles,
      spineWidth: settings.spine.spineWidth,
      seed: settings.seed,
      objects: [...(state.objects || [])]
    }
  }

  /**
   * Prune rooms that are too small or invalid
   */
  private pruneRooms(seeds: RoomSeed[]): RoomSeed[] {
    return seeds.filter(seed => {
      // Check immunity: Content flag OR Trellis Tag
      // Robust check for #tinytitan in trellis array
      const hasTag = seed.trellis?.some(t => t.includes('tinytitan'))
      const isImmune = !!seed.content?.immuneToPruning || hasTag
      const isBigEnough = seed.currentBounds.w > 1 && seed.currentBounds.h > 1
      
      if (seed.id.includes('spawn') || hasTag) {
          console.warn(`[SpineSeedClassifierFixed] Checking ${seed.id}: Immune=${isImmune} (Tag=${hasTag}), Size=${seed.currentBounds.w}x${seed.currentBounds.h}, Keep=${isImmune || isBigEnough}`)
      }

      if (isImmune) return true
      return isBigEnough
    })
  }

  /**
   * Transform a RoomSeed into a rendering-compatible Room object
   */
  private mapSeedToRoom(seed: RoomSeed): Room {
    return {
      id: seed.id,
      regionId: seed.birthOrder + 1, // Use valid region ID (1-based)
      tiles: [...seed.tiles],
      bounds: { ...seed.currentBounds },
      area: seed.tiles.length,
      centroid: {
        x: seed.currentBounds.x + Math.floor(seed.currentBounds.w / 2),
        y: seed.currentBounds.y + Math.floor(seed.currentBounds.h / 2)
      },
      type: seed.configSource?.type, // Carry over room type if available
      trellis: seed.trellis
    }
  }
}
