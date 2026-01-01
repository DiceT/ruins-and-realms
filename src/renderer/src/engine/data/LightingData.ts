export type LightSourceType = 'torch' | 'hooded' | 'bullseye'

export interface LightProfile {
  type: LightSourceType
  brightRadius: number // in tiles
  dimRadius: number    // in tiles
  coneAngle?: number   // in degrees (for bullseye)
  coneWidth?: number   // in degrees (for bullseye)
}

export type VisionGrid = Uint8Array // 0=unexplored, 1=explored(dim), 2=visible(bright)

export const VISION_STATE = {
  UNEXPLORED: 0,
  EXPLORED: 1,
  VISIBLE: 2
} as const

// Default Profiles (1 tile = 10ft approx for game feel, or 5ft? User said 1 tile = 10ft)
// Torch: Bright 20ft (2 tiles), Dim 40ft (4 tiles)
export const LIGHT_PROFILES: Record<LightSourceType, LightProfile> = {
  torch: {
    type: 'torch',
    brightRadius: 3, // slightly bumped for visibility
    dimRadius: 6
  },
  hooded: {
    type: 'hooded',
    brightRadius: 4,
    dimRadius: 8
  },
  bullseye: {
    type: 'bullseye',
    brightRadius: 8,
    dimRadius: 15,
    coneAngle: 0, // dynamic
    coneWidth: 60 // degrees
  }
}
