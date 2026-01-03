/**
 * Layer Data Adapters
 * 
 * Transform functions to convert game data types to pure layer render data.
 * This maintains isolation between the layer system and game logic.
 */

import { Room, DungeonObject } from '../../seed-growth/types'
import { 
  RoomRenderData, 
  TilePosition, 
  ThemeColors 
} from './ILayer'
import { FloorRenderData } from './FloorLayer'
import { WallRenderData } from './WallLayer'
import { GridRenderData } from './GridLayer'
import { LabelRenderData, FurthestRoomInfo } from './LabelLayer'
import { ObjectRenderData, ObjectLayerData } from './ObjectLayer'
import { DebugRenderData } from './DebugLayer'
import { SpineDebugRenderData, SpineSeedData } from './SpineDebugLayer'
import { RoomLayerConfig } from '../../themes/ThemeTypes'

/**
 * Convert Room to RoomRenderData
 */
export function roomToRenderData(room: Room): RoomRenderData {
  return {
    id: room.id,
    bounds: { ...room.bounds },
    tiles: room.tiles.map(t => ({ x: t.x, y: t.y })),
    isCircular: room.isCircular,
    area: room.area
  }
}

/**
 * Convert array of Rooms to FloorRenderData
 */
export function toFloorRenderData(
  rooms: Room[], 
  corridorTiles: TilePosition[]
): FloorRenderData {
  return {
    rooms: rooms.map(roomToRenderData),
    corridorTiles
  }
}

/**
 * Convert to WallRenderData
 */
export function toWallRenderData(
  rooms: Room[],
  corridorTiles: TilePosition[],
  gridWidth: number,
  gridHeight: number
): WallRenderData {
  return {
    rooms: rooms.map(roomToRenderData),
    corridorTiles,
    gridWidth,
    gridHeight
  }
}

/**
 * Convert to GridRenderData
 */
export function toGridRenderData(
  rooms: Room[],
  corridorTiles: TilePosition[]
): GridRenderData {
  return {
    rooms: rooms.map(roomToRenderData),
    corridorTiles
  }
}

/**
 * Convert to LabelRenderData
 */
export function toLabelRenderData(
  rooms: Room[],
  furthestMap?: Map<string, { roomId: string; distance: number; rank: number }>,
  totalFurthest?: number
): LabelRenderData {
  const renderMap = furthestMap ? new Map<string, FurthestRoomInfo>() : undefined
  if (furthestMap && renderMap) {
    for (const [key, value] of furthestMap) {
      renderMap.set(key, value)
    }
  }
  
  return {
    rooms: rooms.map(roomToRenderData),
    furthestMap: renderMap,
    totalFurthest
  }
}

/**
 * Convert DungeonObjects to ObjectLayerData
 */
export function toObjectLayerData(objects: DungeonObject[]): ObjectLayerData {
  return {
    objects: objects.map(obj => ({
      type: obj.type,
      position: { x: obj.x, y: obj.y },
      properties: obj.properties
    }))
  }
}

/**
 * Convert to DebugRenderData
 */
export function toDebugRenderData(
  rooms: Room[],
  spineTiles: TilePosition[],
  walkableTiles?: Set<string>,
  roomCosts?: Map<string, number>,
  roomTraversals?: Map<string, number>,
  doorTraversals?: Map<string, number>
): DebugRenderData {
  return {
    rooms: rooms.map(roomToRenderData),
    spineTiles,
    walkableTiles,
    roomCosts,
    roomTraversals,
    doorTraversals
  }
}

/**
 * Convert spine state to SpineDebugRenderData
 */
export function toSpineDebugRenderData(
  spinePath: TilePosition[],
  ejectedSeeds: Array<{ position: TilePosition; id: string; bounds?: { x: number; y: number; w: number; h: number } }>
): SpineDebugRenderData {
  return {
    spinePath,
    ejectedSeeds: ejectedSeeds.map(s => ({
      position: s.position,
      id: s.id,
      bounds: s.bounds
    }))
  }
}

/**
 * Convert RoomLayerConfig to ThemeColors
 */
export function toThemeColors(config: RoomLayerConfig): ThemeColors {
  return {
    background: config.background,
    floor: { color: config.floor.color },
    walls: { 
      color: config.walls.color,
      width: config.walls.width,
      roughness: config.walls.roughness
    },
    shadow: config.shadow ? {
      color: config.shadow.color,
      x: config.shadow.x,
      y: config.shadow.y
    } : undefined
  }
}
