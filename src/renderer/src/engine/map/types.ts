export type TileType = 'dead' | 'live' | 'active' | 'wall' | 'door'

// Room classification - calculated at placement time for encounters
export type RoomClassification =
  | 'entrance' // The dungeon entrance tile
  | 'starter' // The initial room
  | 'corridor' // Width=1 OR Height=1
  | 'small' // Not corridor, area ≤ 6
  | 'medium' // Not corridor, area 7-31
  | 'large' // Area ≥ 32
  | 'exit' // Exit tile

export interface Tile {
  x: number
  y: number
  type: TileType
  roomId?: string // ID of the room this tile belongs to
  corridorId?: string // ID of the corridor this tile belongs to
  isEntrance?: boolean // True if this is the dungeon entrance tile
  isExit?: boolean // True if this is an exit tile
  debugColor?: number // Visual aid
}

export interface Exit {
  id: string
  x: number // Grid X
  y: number // Grid Y
  direction: 'top' | 'bottom' | 'left' | 'right'
  parentRoomId: string
  connectedRoomId?: string // If null, it's an open exit
}

export interface Room {
  id: string
  x: number // Left-most X
  y: number // Top-most Y
  width: number
  height: number
  exits: Exit[]
  type: 'start' | 'normal'
  classification: RoomClassification // Calculated at placement time
}

export interface DungeonState {
  width: number // Playable width + padding
  height: number // Playable height + padding
  tiles: Tile[][] // [y][x] access
  rooms: Room[]
  entrance: { x: number; y: number }
}
