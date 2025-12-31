import { DungeonData, GridCoord, DungeonObject } from '../types'
import { SeededRNG } from '../../utils/SeededRNG'

/**
 * Result of the furthest room analysis
 */
export interface FurthestRoomResult {
    roomId: string
    rank: number      // 0 = Furthest
    cost: number      // Total path cost
    isTarget: boolean // Is one of the top X furthest
}

export interface DungeonAnalysisResult {
    furthest: FurthestRoomResult[]
    roomCosts: Map<string, number> // roomId -> specific entry cost (or centroid cost?)
    fullCostMap: Map<string, number> // tileKey -> cost
    walkableTiles: Set<string>
    roomTraversals: Map<string, number> // roomId -> number of rooms traversed to reach
    doorTraversals: Map<string, number> // roomId -> number of obstacle doors crossed
}

export class DungeonAnalysis {

    public static analyze(data: DungeonData): DungeonAnalysisResult {
        // ... (Logic from findFurthestRooms, adapted to return all data)
        const rooms = data.rooms
        const tileOwner = new Map<string, string>() 
        const walkable = new Set<string>()

        // 1. Build Walkmap
        // Add Rooms (Cost 1 + Entry Penalty 5)
        for (const r of rooms) {
            for (const t of r.tiles) {
                const key = `${t.x},${t.y}`
                tileOwner.set(key, r.id)
                walkable.add(key)
            }
        }
        if (data.corridors) {
            for (const c of data.corridors) {
                for (const t of c.tiles) {
                    const key = `${t.x},${t.y}`
                    if (!tileOwner.has(key)) tileOwner.set(key, 'corridor')
                    walkable.add(key)
                }
            }
        }
        // Add Spine Corridor tiles (physical walkable floor)
        if (data.spine) {
            for (const s of data.spine) {
                const key = `${s.x},${s.y}`
                if (!tileOwner.has(key)) tileOwner.set(key, 'corridor')
                walkable.add(key)
            }
        }

        // 2. Find Start
        let startPos: GridCoord | null = null
        if (data.objects) {
            const stairs = data.objects.find(o => o.type === 'stairs_up' || o.type === 'stairs')
            if (stairs) startPos = { x: stairs.x, y: stairs.y }
        }
        if (!startPos && rooms.length > 0) startPos = rooms[0].centroid
        
        const dist = new Map<string, number>()
        if (!startPos) {
            return { furthest: [], roomCosts: new Map(), fullCostMap: dist, walkableTiles: walkable }
        }

        // Build door cost lookup
        // Locked/Portcullis/Barred = +10, Secret = +20
        const doorCosts = new Map<string, number>()
        if (data.objects) {
            for (const obj of data.objects) {
                if (obj.type.startsWith('door')) {
                    const key = `${obj.x},${obj.y}`
                    if (obj.type === 'door-secret') {
                        doorCosts.set(key, 20)
                    } else if (obj.type === 'door-locked' || obj.type === 'door-portcullis' || obj.type === 'door-barred') {
                        doorCosts.set(key, 10)
                    }
                    // Standard doors and archways cost 0 extra
                }
            }
        }

        // 3. Dijkstra with room/door tracking
        const queue: { x: number, y: number, c: number, rooms: number, doors: number }[] = []
        const startKey = `${startPos.x},${startPos.y}`
        dist.set(startKey, 0)
        const tileRoomCount = new Map<string, number>() // Track rooms traversed to reach each tile
        const tileDoorCount = new Map<string, number>() // Track obstacle doors crossed to reach each tile
        tileRoomCount.set(startKey, 0)
        tileDoorCount.set(startKey, 0)
        queue.push({ x: startPos.x, y: startPos.y, c: 0, rooms: 0, doors: 0 })
        const visited = new Set<string>()

        while (queue.length > 0) {
            queue.sort((a, b) => a.c - b.c)
            const current = queue.shift()!
            const key = `${current.x},${current.y}`
            
            if (visited.has(key)) continue
            visited.add(key)
            
            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ]
            
            const currentOwner = tileOwner.get(key)
            
            for (const n of neighbors) {
                const nKey = `${n.x},${n.y}`
                if (!walkable.has(nKey)) continue
                if (visited.has(nKey)) continue
                
                let moveCost = 1
                const nextOwner = tileOwner.get(nKey)
                let roomsInc = 0
                let doorsInc = 0
                
                if (nextOwner !== 'corridor' && nextOwner !== currentOwner) {
                    moveCost += 5
                    roomsInc = 1 // Entering a new room
                }
                
                // Add door cost if present (and track obstacle doors)
                const doorCost = doorCosts.get(nKey) || 0
                moveCost += doorCost
                if (doorCost > 0) doorsInc = 1
                
                const newDist = current.c + moveCost
                if (newDist < (dist.get(nKey) ?? Infinity)) {
                    dist.set(nKey, newDist)
                    const newRooms = current.rooms + roomsInc
                    const newDoors = current.doors + doorsInc
                    tileRoomCount.set(nKey, newRooms)
                    tileDoorCount.set(nKey, newDoors)
                    queue.push({ x: n.x, y: n.y, c: newDist, rooms: newRooms, doors: newDoors })
                }
            }
        }

        // 4. Room Costs and Furthest Calculation
        const roomDistances: { id: string, cost: number }[] = []
        const roomCosts = new Map<string, number>()
        
        for (const room of rooms) {
            const ck = `${room.centroid.x},${room.centroid.y}`
            let cost = dist.get(ck)
            if (cost === undefined) {
                 let minC = Infinity
                 for (const t of room.tiles) {
                     const tc = dist.get(`${t.x},${t.y}`)
                     if (tc !== undefined && tc < minC) minC = tc
                 }
                 if (minC !== Infinity) cost = minC
            }
            if (cost !== undefined) {
                roomDistances.push({ id: room.id, cost })
                roomCosts.set(room.id, cost)
            }
        }
        
        // Build room traversal and door traversal maps per room
        const roomTraversals = new Map<string, number>()
        const doorTraversals = new Map<string, number>()
        for (const room of rooms) {
            const ck = `${room.centroid.x},${room.centroid.y}`
            let roomCount = tileRoomCount.get(ck)
            let doorCount = tileDoorCount.get(ck)
            // Fallback to any tile if centroid not available
            if (roomCount === undefined || doorCount === undefined) {
                for (const t of room.tiles) {
                    const tk = `${t.x},${t.y}`
                    if (tileRoomCount.has(tk)) {
                        roomCount = tileRoomCount.get(tk)
                        doorCount = tileDoorCount.get(tk)
                        break
                    }
                }
            }
            roomTraversals.set(room.id, roomCount ?? 0)
            doorTraversals.set(room.id, doorCount ?? 0)
        }
        
        roomDistances.sort((a, b) => b.cost - a.cost)
        const targetCount = Math.max(1, Math.floor(rooms.length / 5))
        
        // Build room adjacency graph with door tracking
        // Each edge stores: { hasDoor: boolean }
        const roomAdjacency = new Map<string, Map<string, boolean>>() // roomId -> { neighborId -> hasDoor }
        for (const room of rooms) {
            roomAdjacency.set(room.id, new Map())
        }
        
        // Build obstacle door lookup
        const obstacleDoorTiles = new Set<string>()
        if (data.objects) {
            for (const obj of data.objects) {
                if (obj.type === 'door-secret' || obj.type === 'door-locked' || 
                    obj.type === 'door-portcullis' || obj.type === 'door-barred') {
                    obstacleDoorTiles.add(`${obj.x},${obj.y}`)
                }
            }
        }
        
        // Check all room pairs for adjacency via corridors/spine
        for (const roomA of rooms) {
            for (const roomB of rooms) {
                if (roomA.id === roomB.id) continue
                if (roomAdjacency.get(roomA.id)?.has(roomB.id)) continue
                
                const roomATiles = new Set(roomA.tiles.map(t => `${t.x},${t.y}`))
                const roomBTiles = new Set(roomB.tiles.map(t => `${t.x},${t.y}`))
                
                let foundConnection = false
                let hasObstacleDoor = false
                
                for (const tileKey of walkable) {
                    const [x, y] = tileKey.split(',').map(Number)
                    const owner = tileOwner.get(tileKey)
                    
                    if (owner === 'corridor') {
                        const neighbors = [
                            `${x+1},${y}`, `${x-1},${y}`, `${x},${y+1}`, `${x},${y-1}`
                        ]
                        let touchesA = false, touchesB = false
                        for (const n of neighbors) {
                            if (roomATiles.has(n)) touchesA = true
                            if (roomBTiles.has(n)) touchesB = true
                        }
                        if (touchesA && touchesB) {
                            foundConnection = true
                            if (obstacleDoorTiles.has(tileKey)) hasObstacleDoor = true
                            for (const n of neighbors) {
                                if (obstacleDoorTiles.has(n)) hasObstacleDoor = true
                            }
                            break
                        }
                    }
                }
                
                if (!foundConnection) {
                    for (const tileA of roomA.tiles) {
                        const neighbors = [
                            `${tileA.x+1},${tileA.y}`, `${tileA.x-1},${tileA.y}`,
                            `${tileA.x},${tileA.y+1}`, `${tileA.x},${tileA.y-1}`
                        ]
                        for (const n of neighbors) {
                            if (roomBTiles.has(n)) {
                                foundConnection = true
                                if (obstacleDoorTiles.has(n) || obstacleDoorTiles.has(`${tileA.x},${tileA.y}`)) {
                                    hasObstacleDoor = true
                                }
                                break
                            }
                        }
                        if (foundConnection) break
                    }
                }
                
                if (foundConnection) {
                    roomAdjacency.get(roomA.id)?.set(roomB.id, hasObstacleDoor)
                    roomAdjacency.get(roomB.id)?.set(roomA.id, hasObstacleDoor)
                }
            }
        }
        
        // BFS helper that returns { distance, doorCount }
        const getRoomPathInfo = (fromId: string, toId: string): { dist: number, doors: number } => {
            if (fromId === toId) return { dist: 0, doors: 0 }
            const visited = new Set<string>()
            const queue: { id: string, dist: number, doors: number }[] = [{ id: fromId, dist: 0, doors: 0 }]
            
            while (queue.length > 0) {
                queue.sort((a, b) => a.dist - b.dist)
                const { id, dist, doors } = queue.shift()!
                if (visited.has(id)) continue
                visited.add(id)
                
                const neighbors = roomAdjacency.get(id) || new Map()
                for (const [neighbor, hasDoor] of neighbors) {
                    const newDoors = doors + (hasDoor ? 1 : 0)
                    if (neighbor === toId) {
                        return { dist: dist + 1, doors: newDoors }
                    }
                    if (!visited.has(neighbor)) {
                        queue.push({ id: neighbor, dist: dist + 1, doors: newDoors })
                    }
                }
            }
            return { dist: Infinity, doors: 0 }
        }
        
        // Anti-clustering with tiered probability + door bonus
        // Base: 1 room = 10%, 2 rooms = 25%, 3 rooms = 50%, 4+ = 100%
        // Bonus: +5% per obstacle door traversed
        const specialRoomIds = new Set<string>()
        const furthest: FurthestRoomResult[] = []
        
        const rng = new SeededRNG(data.seed || 0)
        
        for (const candidate of roomDistances) {
            if (furthest.length >= targetCount) break
            
            // Find closest special room path info
            let minDistance = Infinity
            let doorsOnPath = 0
            for (const specialId of specialRoomIds) {
                const pathInfo = getRoomPathInfo(candidate.id, specialId)
                if (pathInfo.dist < minDistance) {
                    minDistance = pathInfo.dist
                    doorsOnPath = pathInfo.doors
                }
            }
            
            // Tiered base probability
            let chance = 1.0
            if (minDistance <= 1) {
                chance = 0.10
            } else if (minDistance <= 2) {
                chance = 0.25
            } else if (minDistance <= 3) {
                chance = 0.50
            }
            
            // Add 5% per obstacle door
            chance += doorsOnPath * 0.05
            chance = Math.min(1.0, chance) // Cap at 100%
            
            const isSpecial = rng.next() < chance
            
            if (isSpecial) {
                specialRoomIds.add(candidate.id)
                furthest.push({
                    roomId: candidate.id,
                    rank: furthest.length,
                    cost: candidate.cost,
                    isTarget: true
                })
            }
        }

        return {
            furthest,
            roomCosts,
            fullCostMap: dist,
            walkableTiles: walkable,
            roomTraversals,
            doorTraversals
        }
    }

    /**
     * Legacy wrapper if needed, or replace usage.
     * We will update usage to use analyze().
     */
    public static findFurthestRooms(data: DungeonData): FurthestRoomResult[] {
        return this.analyze(data).furthest
    }
}
