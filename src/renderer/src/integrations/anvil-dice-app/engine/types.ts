export type MaterialType =
  | 'plastic'
  | 'metal'
  | 'wood'
  | 'glass'
  | 'stone_master'
  | 'metal_master'
  | 'arcane_master'
  | 'liquid_core'
export type SurfaceMaterial = 'felt' | 'wood' | 'rubber' | 'glass'

export interface DiceTheme {
  diceColor: string // Hex body color
  labelColor: string // Hex number color
  outlineColor: string // Hex outline color
  diceColorSecondary?: string // Hex body color for helper/ones dice
  labelColorSecondary?: string // Hex number color for helper/ones dice
  outlineColorSecondary?: string // Hex outline color for helper/ones dice
  texture: string // Texture key name (e.g. 'ledgerandink')
  material: MaterialType // Physics/Visual material type
  font: string // Font family (e.g. 'Arial')
  scale: number // 0.6 to 1.5
  textureContrast: number // 0.5 to 2.0
}

export interface PhysicsSettings {
  throwForce: number // 30 - 60
  gravity: number // ~9.8
  surface: SurfaceMaterial // Presets for friction/restitution
  soundVolume: number // 0 - 1
  spinForce: number // 0 - 20
  wallRestitution: number // 0 - 1
  groundFriction: number // 0 - 1
}

export interface AppSettings {
  theme: DiceTheme
  physics: PhysicsSettings
  soundVolume: number // 0.0 - 1.0
}

export const DEFAULT_THEME: DiceTheme = {
  diceColor: '#dddddd',
  labelColor: '#000000',
  outlineColor: '#000000',
  diceColorSecondary: '#dddddd',
  labelColorSecondary: '#000000',
  outlineColorSecondary: '#000000',
  texture: 'ledgerandink',
  material: 'plastic',
  font: 'Arial',
  scale: 1.0,
  textureContrast: 1.0
}

export const DEFAULT_PHYSICS: PhysicsSettings = {
  throwForce: 60,
  gravity: 9.81,
  surface: 'felt',
  soundVolume: 0.5,
  spinForce: 15,
  wallRestitution: 0.5,
  groundFriction: 0.5
}

export interface RollResult {
  total: number
  notation: string
  breakdown: {
    type: string
    value: number
    dropped?: boolean
  }[]
  modifier: number
  // Optional: Return list of dice for ID tracking in future steps
  dice?: { id: number; groupId: number; value: number; type: string }[]
}

export interface DiceRollRequest {
  notation: string
  theme?: Partial<DiceTheme>
}

export interface DiePositionRequest {
  id: number
  position: { x: number; y: number; z: number }
  rotation?: { x: number; y: number; z: number; w: number }
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_THEME,
  physics: DEFAULT_PHYSICS,
  soundVolume: 0.5
}
