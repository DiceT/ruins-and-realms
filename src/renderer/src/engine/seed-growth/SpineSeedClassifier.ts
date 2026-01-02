import {
  SpineSeedState,
  SpineSeedSettings,
  DungeonData,
  Room,
  RoomSeed
} from './types'

/**
 * SpineSeedClassifier
 * 
 * Responsible for transforming the internal SpineSeedState (which contains room seeds and raw grids)
 * into a clean, unified DungeonData object. This includes filtering/pruning invalid geometry.
 */
export class SpineSeedClassifier {
  
  /**
   * Classify SpineSeedState into DungeonData
   */
  public classify(state: SpineSeedState, settings: SpineSeedSettings): DungeonData {
    const rawSeeds = state.roomSeeds || []
    
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
    // Current Rule: Rooms must be at least 2x2 to be considered a physical "room"
    // Seeds that stayed 1xN or 1x1 are usually "dead" due to immediate collisions
    return seeds.filter(seed => seed.currentBounds.w > 1 && seed.currentBounds.h > 1)
  }

  /**
   * Transform a RoomSeed into a rendering-compatible Room object
   */
  private mapSeedToRoom(seed: RoomSeed): Room {
    return {
      id: seed.id,
      regionId: 0, // Spine-seed doesn't use region IDs for final classification yet
      tiles: [...seed.tiles],
      bounds: { ...seed.currentBounds },
      area: seed.tiles.length,
      centroid: {
        x: seed.currentBounds.x + Math.floor(seed.currentBounds.w / 2),
        y: seed.currentBounds.y + Math.floor(seed.currentBounds.h / 2)
      },
      type: seed.configSource?.type // Carry over room type if available
    }
  }
}
