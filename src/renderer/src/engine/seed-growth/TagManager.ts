import { RoomSeed, SpineSeedState, Corridor } from './types'

/**
 * Interface for Dungeon Tags.
 * Tags can be attached to seeds and hook into various parts of the generation process.
 */
export interface ITag {
  /** Unique identifier for the tag */
  id: string
  
  /** 
   * Hook called when a seed is ejected from the spine.
   * Can be used to modify seed dimensions, metadata, or other tags.
   */
  onSeedEjected?(seed: RoomSeed, state: SpineSeedState): void
  
  /**
   * Hook called before a room starts growing.
   */
  onBeforeRoomGrowth?(seed: RoomSeed, state: SpineSeedState): void

  /**
   * Hook called after a room has finished growing.
   */
  onRoomComplete?(seed: RoomSeed, state: SpineSeedState): void

  /**
   * Hook called when a corridor is identified or created.
   */
  onCorridorCreated?(corridor: Corridor, state: SpineSeedState): void

  /**
   * Hook called when the entire dungeon generation is complete.
   */
  onDungeonComplete?(state: SpineSeedState): void
}

/**
 * Manages registration and execution of tags in the Seed Growth system.
 */
export class TagManager {
  private static instance: TagManager
  private tags: Map<string, ITag> = new Map()

  private constructor() {}

  public static getInstance(): TagManager {
    if (!TagManager.instance) {
      TagManager.instance = new TagManager()
    }
    return TagManager.instance
  }

  /** Register a new tag handler */
  public registerTag(tag: ITag): void {
    this.tags.set(tag.id, tag)
  }

  /** Apply all tags associated with a seed during ejection */
  public applyOnSeedEjected(seed: RoomSeed, state: SpineSeedState): void {
    if (!seed.tags) return
    for (const tagId of seed.tags) {
      const tag = this.tags.get(tagId)
      if (tag?.onSeedEjected) {
        tag.onSeedEjected(seed, state)
      }
    }
  }

  /** Apply all tags associated with a seed before room growth */
  public applyOnBeforeRoomGrowth(seed: RoomSeed, state: SpineSeedState): void {
    if (!seed.tags) return
    for (const tagId of seed.tags) {
      const tag = this.tags.get(tagId)
      if (tag?.onBeforeRoomGrowth) {
        tag.onBeforeRoomGrowth(seed, state)
      }
    }
  }

  /** Apply all tags associated with a seed after room growth is complete */
  public applyOnRoomComplete(seed: RoomSeed, state: SpineSeedState): void {
    if (!seed.tags) return
    for (const tagId of seed.tags) {
      const tag = this.tags.get(tagId)
      if (tag?.onRoomComplete) {
        tag.onRoomComplete(seed, state)
      }
    }
  }

  /** Apply all dungeon-wide tags or corridor-specific tags */
  public applyOnCorridorCreated(corridor: Corridor, state: SpineSeedState): void {
    // Corridors might not have tags directly in the same way seeds do yet, 
    // but we can apply global tags or look for regional tags.
    for (const tag of this.tags.values()) {
        if (tag.onCorridorCreated) {
            tag.onCorridorCreated(corridor, state)
        }
    }
  }

  /** Apply hooks when dungeon is fully complete */
  public applyOnDungeonComplete(state: SpineSeedState): void {
    for (const tag of this.tags.values()) {
      if (tag.onDungeonComplete) {
        tag.onDungeonComplete(state)
      }
    }
  }
}
