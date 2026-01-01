
import { ManualSeedConfig, RangeOrNumber } from './SeedDefinitions'
import { SpineSeedSettings, createDefaultSpineSeedSettings } from './types'

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_SEED_CONFIG: ManualSeedConfig = {
    schemaVersion: 1,
    shape: 'rectangle',
    width: { min: 4, max: 8 },
    height: { min: 4, max: 8 },
    distance: { min: 3, max: 6 },
    side: 'any',
    mandatory: true,
    allowMirror: true
}

// =============================================================================
// Validation & Ingestion
// =============================================================================

export function validateSeedBatch(json: any): { valid: ManualSeedConfig[], errors: string[] } {
    const errors: string[] = []
    const valid: ManualSeedConfig[] = []

    if (!Array.isArray(json)) {
        // Handle single object
        if (typeof json === 'object' && json !== null) {
            json = [json]
        } else {
            return { valid: [], errors: ['Input must be an array or object'] }
        }
    }

    const batch = json as any[]

    batch.forEach((item, index) => {
        const context = `Item ${index + 1}`
        
        // 1. Check Schema Version
        if (item.schemaVersion !== 1) {
            errors.push(`${context}: Missing or invalid schemaVersion (must be 1)`)
            return
        }

        // 2. Normalize Ranges (Basic type check)
        // In v1 we trust the structure mostly, but ensure 'width'/'height' exist or are optional?
        // Spec says they are optional, but if present must be RangeOrNumber.
        
        // 3. Construct Clean Object (Whitelisting fields to avoid garbage)
        const config: ManualSeedConfig = {
            schemaVersion: 1,
            id: item.id,
            type: item.type,
            tags: Array.isArray(item.tags) ? item.tags : [],
            shape: item.shape || 'rectangle',
            width: item.width,
            height: item.height,
            distance: item.distance,
            side: item.side,
            doorType: item.doorType,
            isExit: !!item.isExit,
            exitType: item.exitType,
            mandatory: item.mandatory,
            allowMirror: item.allowMirror,
            repeat: typeof item.repeat === 'number' && item.repeat > 0 ? item.repeat : 1,
            metadata: item.metadata ? { ...item.metadata } : undefined
        }

        valid.push(config)
    })

    return { valid, errors }
}

// =============================================================================
// Logic: Repeat Expansion
// =============================================================================

export function expandRepeats(seeds: ManualSeedConfig[]): ManualSeedConfig[] {
    const expanded: ManualSeedConfig[] = []

    for (const seed of seeds) {
        const count = seed.repeat || 1
        // Create N copies
        for (let i = 0; i < count; i++) {
            // Clone to prevent reference sharing issues, though config is mostly immutable data
            const clone = { ...seed }
            // Remove 'repeat' from the expanded version to avoid confusion? 
            // Or keep it as '1'? Let's set it to 1 or undefined.
            delete clone.repeat 
            
            // Unique ID generation if repeated? 
            // Spec doesn't require unique IDs, but duplicate IDs might confuse debugging.
            // Let's append index if count > 1
            if (count > 1 && clone.id) {
                clone.id = `${clone.id}_${i+1}`
            }

            expanded.push(clone)
        }
    }

    return expanded
}

// =============================================================================
// Logic: Fallback Generation
// =============================================================================

// Helper for RNG since we don't want to import the whole RNG class if we can avoid it, 
// but we need it for virtual config. Passing a simple interface or the RNG instance.
interface SimpleRNG {
    next(): number
    nextInt(min: number, max: number): number
}

export function createVirtualConfig(settings: SpineSeedSettings, rng: SimpleRNG): ManualSeedConfig {
    const { roomGrowth, ejection } = settings
    
    // Convert old settings to new ManualSeedConfig format
    return {
        schemaVersion: 1,
        type: rng.next() < ejection.wallSeedChance ? 'wall' : 'room',
        shape: 'rectangle', // Random could also use circle if we added that to global settings
        
        width: { min: roomGrowth.minWidth, max: roomGrowth.maxWidth },
        height: { min: roomGrowth.minHeight, max: roomGrowth.maxHeight },
        
        distance: { min: ejection.minDistance, max: ejection.maxDistance },
        side: ejection.ejectionSide === 'random' ? 'any' : ejection.ejectionSide as any,
        
        // Random mirroring is handled by the generator checking global settings if allowMirror is true
        allowMirror: true, 
        mandatory: false, // Random seeds are never mandatory (they can be duds)
        
        metadata: {
            // Can add default scoring here
            roomScore: 1
        }
    }
}

export function settingsToSeedConfig(settings: SpineSeedSettings): ManualSeedConfig {
    const { roomGrowth, ejection } = settings
    return {
        schemaVersion: 1,
        type: 'room', 
        id: 'copied_seed',
        shape: 'rectangle', 
        width: { min: roomGrowth.minWidth, max: roomGrowth.maxWidth },
        height: { min: roomGrowth.minHeight, max: roomGrowth.maxHeight },
        distance: { min: ejection.minDistance, max: ejection.maxDistance },
        side: ejection.ejectionSide === 'random' ? 'any' : ejection.ejectionSide as any,
        allowMirror: true, 
        mandatory: true,
        metadata: {
            roomScore: 1
        }
    }
}

// =============================================================================
// Logic: Label Resolution
// =============================================================================

import { RoomSeed } from './types'

export function getSeedLabel(seed: RoomSeed): string {
    if (seed.isWallSeed) return 'Wall'
    
    // Check Manual Config Source
    if (seed.configSource) {
        // Prefer Type (e.g. "Boss Room")
        if (seed.configSource.type) {
            // Capitalize
            const type = seed.configSource.type
            return type.charAt(0).toUpperCase() + type.slice(1)
        }
        // Fallback to ID
        if (seed.configSource.id) {
            return seed.configSource.id
        }
    }

    // Default
    return 'Room'
}
