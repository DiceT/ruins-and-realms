/**
 * DungeonAssembler
 * 
 * Orchestrates the dungeon generation pipeline:
 * 1. Calculate heat map (HeatMapCalculator)
 * 2. Generate corridors (CorridorPathfinder)
 * 3. Decorate with doors/stairs (DungeonDecorator)
 * 4. Prune dead ends (SpinePruner)
 * 
 * Takes incomplete DungeonData (rooms + spine) and returns
 * complete DungeonData (rooms + corridors + objects + pruned spine).
 */

import { DungeonData, SeedGrowthState, SeedGrowthSettings, SpineSeedState, SpineSeedSettings, Room } from '../types'
import { HeatMapCalculator } from '../processors/HeatMapCalculator'
import { CorridorPathfinder } from '../processors/CorridorPathfinder'
import { DungeonDecorator } from '../processors/DungeonDecorator'
import { SpinePruner } from '../processors/SpinePruner'
import { SpineSeedClassifierFixed } from '../classifiers/SpineSeedClassifier'
import { SeededRNG } from '../../../utils/SeededRNG'
import { TrellisManager } from '../TrellisManager'
import { TrellisContext } from '../trellises/ITrellis'

export class DungeonAssembler {

  /**
   * Assemble a Spine-based dungeon.
   * This is the main entry point for spine mode generation.
   * 
   * Accepts raw SpineSeedState and handles classification internally.
   * Returns fully processed DungeonData ready for rendering.
   */
  public static assembleSpine(state: SpineSeedState, settings: SpineSeedSettings): DungeonData {
    // --- STEP 1: CLASSIFY (prune seeds + map to rooms) ---
    const classifier = new SpineSeedClassifierFixed()
    const data = classifier.classify(state, settings)
    
    const rooms = data.rooms
    
    // The spineTiles array only contains CENTER path tiles.
    const spineTiles: any[] = data.spine || []
    
    // 0. Calculate Scores (Required for generator)
    const heatScores = HeatMapCalculator.calculate(rooms, spineTiles)

    // --- TRELLIS PHASE: corridorAssembly ---
    const context: TrellisContext = { 
      rng: new SeededRNG(settings.seed),
      heatMap: heatScores,
      rooms: rooms
    }
    TrellisManager.getInstance().processPhaseForRooms('corridorAssembly', context, rooms)
    
    // --- SPINE PRUNING ---
    // Determine active range of the spine
    let minActiveIndex = 0
    let maxActiveIndex = spineTiles.length - 1
    
    if (spineTiles.length > 0) {
      // Skip early pruning - final cleanup pass after tributaries handles dead-ends
      // Just determine if stairs should be at spine start (affects south trimming)
      const spineWidth = data.spineWidth || 1
      const rng = new SeededRNG(settings.seed)
      let stairsOnSpine = false
      if (spineWidth >= 3) {
        if (Math.floor(rng.next() * 100) < 50) stairsOnSpine = true
      }
      
      // Use full spine range - final cleanup will trim dead ends
      minActiveIndex = 0
      maxActiveIndex = spineTiles.length - 1
    }
    
    // Ensure valid range
    if (minActiveIndex > maxActiveIndex) {
      minActiveIndex = 0
      maxActiveIndex = spineTiles.length - 1
    }
    
    const activeSpineTiles = spineTiles.slice(minActiveIndex, maxActiveIndex + 1)
    
    // 1. Build Blocked Set (Room Floors)
    const blockedSet = new Set<string>()
    for (const room of rooms) {
      for (const tile of room.tiles) {
        blockedSet.add(`${tile.x},${tile.y}`)
      }
    }
    
    const spineWidth = data.spineWidth || 1
    let targetSet = new Set<string>()
    let renderedSpinePath: { x: number; y: number }[] = []

    if (spineWidth > 1) {
      // --- MODE A: SPINE CORRIDOR (Width 3, 5, 7) ---
      const effectiveWidth = Math.max(1, spineWidth - 2)
      const radius = Math.floor((effectiveWidth - 1) / 2)
      
      const fullSpineSet = new Set<string>()
      const fullSpineTiles: { x: number, y: number, dir: string }[] = []
      
      for (const t of activeSpineTiles) {
        const key = `${t.x},${t.y}`
        if (!fullSpineSet.has(key)) {
          fullSpineSet.add(key)
          fullSpineTiles.push({ x: t.x, y: t.y, dir: t.direction || 'north' })
        }
        if (radius > 0) {
          const dir = t.direction || 'north'
          const perps = dir === 'north' || dir === 'south' 
            ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] 
            : [{ x: 0, y: 1 }, { x: 0, y: -1 }]
          for (let i = 1; i <= radius; i++) {
            for (const p of perps) {
              const px = t.x + p.x * i
              const py = t.y + p.y * i
              const pkey = `${px},${py}`
              if (!fullSpineSet.has(pkey)) {
                fullSpineSet.add(pkey)
                fullSpineTiles.push({ x: px, y: py, dir })
              }
            }
          }
        }
      }

      renderedSpinePath = fullSpineTiles.map(t => ({ x: t.x, y: t.y }))
      for (const t of renderedSpinePath) targetSet.add(`${t.x},${t.y}`)

    } else {
      // --- MODE B: WIDTH 1 - NO SPINE CORRIDOR ---
      // When spine width is 1, the spine is just a pathfinding guide.
      // renderedSpinePath stays empty (no spine floor tiles drawn).
      // But we still need to set a targetSet for tributary generation.
      if (rooms.length > 0) {
        const seedRoom = rooms.reduce((prev, curr) => (prev.id.localeCompare(curr.id) < 0 ? prev : curr))
        for (const tile of seedRoom.tiles) {
          targetSet.add(`${tile.x},${tile.y}`)
        }
      }
    }

    // 3. Generate Tributary Corridors (connecting rooms)
    const pathfinder = new CorridorPathfinder(settings.seed)
    const tributaryTiles = pathfinder.generateSpineCorridors(
      data.gridWidth, 
      data.gridHeight, 
      rooms, 
      activeSpineTiles, 
      heatScores,
      targetSet,
      blockedSet
    )

    // 4. Combine initial corridors (unpruned)
    // For width 1: renderedSpinePath is empty, only tributaries are used
    // For width > 1: both spine corridor and tributaries are included
    let corridorTiles = [...renderedSpinePath, ...tributaryTiles]
    
    // Update data.spine to be the PHYSICAL spine corridor (for Analysis)
    ;(data as any).spine = renderedSpinePath
    
    // --- DECORATION PHASE ---
    if (!data.corridors) (data as any).corridors = []
    ;(data as any).corridors = [{
      id: 'generated_render_corridors',
      tiles: corridorTiles.map(t => ({ x: t.x, y: t.y }))
    }]

    const decorator = new DungeonDecorator(settings.seed)
    // Clear objects to prevent duplication on re-renders (since data is mutable state)
    if (data.objects) data.objects.length = 0
    decorator.decorate(data)

    // --- UNIFIED PRUNING PHASE ---
    // Delegated to SpinePruner
    const consolidatedCorridors = SpinePruner.prune(data, tributaryTiles, spineTiles)
    
    // Update corridors with pruned version
    data.corridors = [{
      id: 'generated_render_corridors',
      tiles: consolidatedCorridors.map(t => ({ x: t.x, y: t.y }))
    }]

    return data
  }

  /**
   * Assemble an Organic-mode dungeon.
   * Uses simpler MST-based corridor generation.
   */
  public static assembleOrganic(data: SeedGrowthState, settings: SeedGrowthSettings): SeedGrowthState {
    const rooms = (data as any).rooms || []
    
    const pathfinder = new CorridorPathfinder(settings.seed)
    const corridorTiles = pathfinder.generate(data, rooms)
    
    // Set tributaryTiles for organic mode too so cleanup works
    const tributaryTiles = corridorTiles 
    
    // --- DECORATION PHASE ---
    if (!data.corridors) (data as any).corridors = []
    ;(data as any).corridors = [{
      id: 'generated_render_corridors',
      tiles: corridorTiles.map(t => ({ x: t.x, y: t.y }))
    }]

    const decorator = new DungeonDecorator(settings.seed)
    if (data.objects) data.objects.length = 0
    decorator.decorate(data as any)

    // --- UNIFIED PRUNING PHASE ---
    const spineTiles: any[] = [] // No spine in organic mode
    const consolidatedCorridors = SpinePruner.prune(data as any, tributaryTiles, spineTiles)
    
    // Update corridors with pruned version
    ;(data as any).corridors = [{
      id: 'generated_render_corridors',
      tiles: consolidatedCorridors.map(t => ({ x: t.x, y: t.y }))
    }]

    return data
  }
}
