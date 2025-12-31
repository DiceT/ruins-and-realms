import { SeededRNG } from '../../utils/SeededRNG'
import { 
    SpineSeedState, 
    SeedGrowthState, 
    DungeonObject, 
    GridCoord,
    SpineTile,
    DungeonData,
    Room
} from './types'

export class DungeonDecorator {
    private rng: SeededRNG

    constructor(seed: string | number) {
        this.rng = new SeededRNG(seed)
    }

    /**
     * Master decoration function. 
     * Runs after corridor generation to place objects.
     */
    public decorate(data: SeedGrowthState | DungeonData): void {
        // Ensure objects array exists
        // Note: DungeonData interface needs to support objects (we added it to types)
        if (!(data as any).objects) (data as any).objects = []

        this.placeEntrywayStairs(data)
        this.placeDoors(data)
    }

    // =========================================================================
    // Individual Decorators
    // =========================================================================

    private placeDoors(data: SeedGrowthState | DungeonData): void {
        const gridWidth = (data as any).gridWidth || 64
        const gridHeight = (data as any).gridHeight || 64
        
        // 1. Identify all Corridor Tiles
        const corridorSet = new Set<string>()

        if ('corridors' in data && (data as any).corridors) {
             for (const c of (data as any).corridors) {
                 for (const t of c.tiles) corridorSet.add(`${t.x},${t.y}`)
             }
        }

        // 2. Identify Existing Objects
        const existingObjects = new Set<string>()
        if (data.objects) {
            for (const o of data.objects) existingObjects.add(`${o.x},${o.y}`)
        }

        const placedDoors: DungeonObject[] = []

        // 3. Helper to place a door at a specific tile
        const tryPlaceDoor = (x: number, y: number, rotation: number) => {
            const key = `${x},${y}`
            // Must be a corridor
            if (!corridorSet.has(key)) return
            // Must be empty
            if (existingObjects.has(key)) return

            // Roll Type
            const roll = Math.floor(this.rng.next() * 100) + 1 
            let type = 'door'
            if (roll <= 5) type = 'door-secret'
            else if (roll <= 15) type = 'door-archway'
            else if (roll <= 45) type = 'door'
            else if (roll <= 80) type = 'door-locked'
            else if (roll <= 90) type = 'door-portcullis'
            else type = 'door-barred'

            const doorObj: DungeonObject = {
                id: `door_${x}_${y}`,
                type,
                x,
                y,
                rotation,
                scale: 1
            }
            
            this.placeObject(data, doorObj)
            placedDoors.push(doorObj)
            existingObjects.add(key)
        }

        // 4. Iterate Rooms
        if (data.rooms) {
            for (const r of data.rooms) {
                const { x, y, w, h } = r.bounds
                
                // Scan 4 sides
                
                // Top Edge (y-1) -> adjacent to North Wall -> Vertical Connection?
                // Wait. Top Wall is Horizontal. Corridor is Above. Connection is Vertical.
                // Door sits on horizontal wall. Rotation 0.
                for (let dx = 0; dx < w; dx++) tryPlaceDoor(x + dx, y - 1, 0)

                // Bottom Edge (y+h) -> Rotation 0
                for (let dx = 0; dx < w; dx++) tryPlaceDoor(x + dx, y + h, 0)

                // Left Edge (x-1) -> adjacent to West Wall -> Horizontal Connection?
                // West Wall is Vertical. Corridor is to Left. Connection is Horizontal.
                // Door sits on vertical wall. Rotation 90.
                for (let dy = 0; dy < h; dy++) tryPlaceDoor(x - 1, y + dy, 90)

                // Right Edge (x+w) -> Rotation 90
                for (let dy = 0; dy < h; dy++) tryPlaceDoor(x + w, y + dy, 90)
            }
        }
        
        // 5. Post-Processing: Adjacency Check (Archways)
        const doorPosMap = new Map<string, DungeonObject>()
        for (const d of placedDoors) doorPosMap.set(`${d.x},${d.y}`, d)
            
        for (const d of placedDoors) {
             const neighbors = [
                {x: d.x+1, y: d.y}, {x: d.x-1, y: d.y},
                {x: d.x, y: d.y+1}, {x: d.x, y: d.y-1}
             ]
             let hasDoorNeighbor = false
             for (const n of neighbors) {
                 if (doorPosMap.has(`${n.x},${n.y}`)) { hasDoorNeighbor = true; break; }
             }
             
             if (hasDoorNeighbor) {
                 d.type = 'door-archway'
                 // Ensure adjacent archways align?
                 // They should keep their rotation based on the wall they are on.
             }
        }
    }

    /**
     * Places the entry stairs (start point) of the dungeon.
     */
    private placeEntrywayStairs(data: SeedGrowthState | DungeonData): void {
        // Determine Mode and Width
        let spineWidth = 0
        let isSpineMode = false

        if ('spine' in data) {
            isSpineMode = true
            spineWidth = (data as DungeonData).spineWidth || 1
        }

        const gridWidth = (data as any).gridWidth || 64 
        let targetPos: GridCoord | null = null

        // Determine Placement Method
        // Default to Room 1 (Organic / Narrow Spine)
        type Method = 'spine' | 'room1'
        let method: Method = 'room1'

        if (isSpineMode && spineWidth >= 3) {
            // 50% chance to use Spine method
            // 50% chance to use Room 1 method
            if (this.rng.next() < 0.5) {
                method = 'spine'
            } else {
                method = 'room1'
            }
        }

        if (method === 'spine') {
             // --- WIDE SPINE MODE (Attach to Spine Edge) ---
            const spine = (data as DungeonData).spine
            if (spine && spine.length > 0) {
                // Find max Y
                let maxY = -1
                for (const t of spine) {
                    if (t.y > maxY) maxY = t.y
                }
                const candidates = spine.filter(t => t.y === maxY)
                
                // Sort by distance to center
                const centerX = gridWidth / 2
                candidates.sort((a, b) => Math.abs(a.x - centerX) - Math.abs(b.x - centerX))
                
                const best = candidates[0]
                targetPos = { x: best.x, y: best.y + 1 }
            }
        } else {
            // --- ROOM 1 MODE (Attach to Room 1 South Wall) ---
            let rooms: Room[] = []
            if ('rooms' in data) {
                rooms = data.rooms
            }
            
            if (rooms.length > 0) {
                const room = this.findRoomOne(rooms)
                
                if (room) {
                    const { x, y, w, h } = room.bounds
                    const southY = y + h // 1 step below room

                    // Strict Center placement
                    const centerX = Math.floor(x + w / 2)
                    targetPos = { x: centerX, y: southY }
                }
            }
        }

        if (targetPos) {
            // 1. Place 1x1 Corridor Tile
            // We need to add this to the corridors list so it renders as floor/corridor
            // data.corridors might be an array of Corridor objects
            // Or in DungeonViewRenderer we used 'corridorTiles' which was a computed list.
            // WE CANNOT easily modify the 'corridorTiles' local variable in renderer from here.
            // BUT we can modify `data.corridors` if it exists.
            // OR we can make `DungeonViewRenderer` looking for a specific "forceCorridor" property?
            
            // Actually, `DungeonData` doesn't have a simple tile list.
            // `SeedGrowthState` has `grid`. We SHOULD update the grid if it's state.
            // `DungeonData` is a read-only-ish view struct.
            
            // However, the USER REQUEST says: "place a new 1x1 corridor on the corridor layer".
            // If I push to `data.corridors`, the renderer needs to read it.
            // Currently `DungeonViewRenderer` generates corridors on the fly.
            
            // Hack: We can add a "dummy" room or corridor object.
            // Or better: `DungeonViewRenderer.ts` lines 361 `corridorTiles = [...]`
            // It uses `corridorTiles` to draw.
            // The decorator runs AFTER corridor generation.
            // If I want the Renderer to draw this new tile, the Renderer needs to encompass it.
            // But I'm inside `decorate(data)`. I return void.
            
            // Solution: Add a new property `extraCorridorTiles` to `data` or `objects`?
            // OR: Since `states` usually have `grid`, I can update the grid?
            // `DungeonData` does NOT have `grid`.
            
            // I will interpret "place a new 1x1 corridor" as "create a visual corridor tile".
            // Since I cannot change the geometry easily for the renderer (it's already calculated),
            // I will rely on the `DungeonObject` to render the floor?
            // "scaled to fit the entirety of that square" -> implies the STAIRS cover it.
            // If the stairs have a background, great. 
            // If they need a floor under them, I might need to explicitly draw it.
            
            // Let's ADD a specialized object that tells the renderer "Draw Floor Here".
            // OR simply add the floor drawing to the object rendering?
            // The user said "place a new 1x1 corridor on the corridor layer".
            
            // I will modify `DungeonDecorator` to allow returning "extraTiles" or modifying a shared list?
            // No, simplest: `data` is passed by reference.
            // I'll check if `data` has `corridors` array that is compliant.
            // In `DungeonViewRenderer`, `corridorTiles` is a local var.
            
            // CRITICAL: `DungeonViewRenderer.render` re-generates corridors.
            // It does NOT read `data.corridors`.
            // So modifying `data` won't help unless I modify `DungeonViewRenderer` to respect `data.extraTiles`.
            
            // I will implement `placeEntrywayStairs` to add the object. 
            // For the "Corridor Layer" requirement, I will add a special Property to the object `hasFloor: true`, 
            // and update `DungeonViewRenderer` to draw a floor tile under objects with this flag.
            
            this.placeObject(data, {
                id: `stairs_up_${targetPos.x}_${targetPos.y}`,
                type: 'stairs_up',
                x: targetPos.x,
                y: targetPos.y,
                scale: 1,
                rotation: 0,
                properties: { hasFloor: true }
            })
        }
    }

    private findRoomOne(rooms: Room[]): Room | undefined {
        // Try regionId 1
        let r = rooms.find(rm => rm.regionId === 1)
        if (r) return r
        // Fallback: sort by regionId
        const sorted = [...rooms].sort((a,b) => a.regionId - b.regionId)
        return sorted[0]
    }

    private isOccupied(data: SeedGrowthState | DungeonData, x: number, y: number): boolean {
        // Check rooms
        if (data.rooms) {
            for (const r of data.rooms) {
                if (x >= r.bounds.x && x < r.bounds.x + r.bounds.w &&
                    y >= r.bounds.y && y < r.bounds.y + r.bounds.h) return true
            }
        }
        // Check spine (if exists)
        if ('spine' in data && (data as DungeonData).spine) {
            for (const s of (data as DungeonData).spine) {
                if (s.x === x && s.y === y) return true
            }
        }
        return false
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private placeObject(data: SeedGrowthState | DungeonData, obj: DungeonObject): void {
        if (!(data as any).objects) (data as any).objects = []
        ;(data as any).objects.push(obj)
    }
}
