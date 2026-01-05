
export interface LayerStyle {
    color: string; // Hex string e.g '0xffffff' or '#ffffff'
    width?: number;
    roughness: number; // 0, 1, 2, 3
}

export interface ShadingStyle {
    active: boolean;
    size: number;
    fill: string; // Color of the texture cells
    stroke: { color: string, width: number }; // Color/width of the border
    useHatching?: boolean; // If true, fill with hatch pattern instead of solid
    useSquareGrid?: boolean; // If true, use square cells instead of hex cells
    lineCount?: number; // Number of lines per cell when useHatching is true
    hatchWidth?: number; // Width of hatch lines (default 1)
    showBorders?: boolean; // Debug: show cell borders
    showHatching?: boolean; // Debug: show hatch lines (default true)
}

export interface HatchingStyle {
    active: boolean;
    variant: 'random' | 'square';
    size: number; // Cell size in pixels
    stroke: { color: string, width: number };
    // Square-only options
    lineCount?: number; // Number of parallel lines per cell
    cellPadding?: number; // Inset from cell edges
}

export interface RoomLayerConfig {
    background: string;
    floor: { color: string };
    shadow?: { color: string, x: number, y: number };
    hatching?: HatchingStyle;
    upperShading?: ShadingStyle; // The "Inner" band (Closer to wall)
    lowerShading?: ShadingStyle; // The "Outer" band (Further from wall)
    walls: LayerStyle;
    grid: LayerStyle;
}

export interface Theme extends RoomLayerConfig {
    name: string;
    thumbnail?: string; // URL/Path to image
}

export const THEMES: Record<string, Theme> = {
    // ==========================================================================
    // DEFAULT / DEV
    // ==========================================================================
    'None': {
        name: 'None',
        background: '#1a1a1a',
        floor: { color: '#FFFFFF' },
        walls: { color: '#333333', width: 2, roughness: 0 },
        grid: { color: '#CCCCCC', width: 1, roughness: 0 }
    },

    // ==========================================================================
    // THE 8 DOMAINS
    // ==========================================================================

    // DUNGEON (Prison) - Classic stone dungeon, cold and oppressive
    'Dungeon': {
        name: 'Dungeon',
        background: '#1a1f2e',
        floor: { color: '#4a4a5a' },
        shadow: { color: '#252530', x: 10, y: 8 },
        walls: { color: '#0a0a12', width: 5, roughness: 1 },
        grid: { color: '#3a3a4a', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 30,
            fill: '#2a2a35',
            stroke: { color: '#1a1a25', width: 1 }
        }
    },

    // CASTLE - Cold stone, heraldic, formal
    'Castle': {
        name: 'Castle',
        background: '#2a2a30',
        floor: { color: '#8a8a95' },
        shadow: { color: '#404048', x: 12, y: 9 },
        walls: { color: '#1a1a1f', width: 6, roughness: 0 },
        grid: { color: '#6a6a75', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 40,
            fill: '#5a5a65',
            stroke: { color: '#4a4a55', width: 1 }
        }
    },

    // TEMPLE - Warm sandstone, sacred, gold accents
    'Temple': {
        name: 'Temple',
        background: '#2a2015',
        floor: { color: '#c9b896' },
        shadow: { color: '#8a7a5a', x: 10, y: 8 },
        walls: { color: '#3a2a15', width: 5, roughness: 0 },
        grid: { color: '#a99876', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 35,
            fill: '#9a8a6a',
            stroke: { color: '#7a6a4a', width: 1 }
        }
    },

    // CAVERN - Dark rock, bioluminescent hints
    'Cavern': {
        name: 'Cavern',
        background: '#0a0f15',
        floor: { color: '#3a3a45' },
        shadow: { color: '#151520', x: 8, y: 6 },
        walls: { color: '#050508', width: 4, roughness: 3 },
        grid: { color: '#2a2a35', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 35,
            fill: '#1a1a25',
            stroke: { color: '#0a0a15', width: 1 }
        },
        lowerShading: {
            active: true,
            size: 60,
            fill: '#252530',
            stroke: { color: '#353545', width: 1 }
        }
    },

    // CATACOMBS - Bone white, aged gray, crypts
    'Catacombs': {
        name: 'Catacombs',
        background: '#1a1815',
        floor: { color: '#9a9590' },
        shadow: { color: '#4a4540', x: 10, y: 8 },
        walls: { color: '#2a2520', width: 5, roughness: 1 },
        grid: { color: '#7a7570', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 30,
            fill: '#5a5550',
            stroke: { color: '#3a3530', width: 1 }
        }
    },

    // LAIR - Organic, warm reds/browns, predator den
    'Lair': {
        name: 'Lair',
        background: '#1a0f0a',
        floor: { color: '#5a4035' },
        shadow: { color: '#2a1a15', x: 8, y: 6 },
        walls: { color: '#0f0805', width: 4, roughness: 2 },
        grid: { color: '#4a3025', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 40,
            fill: '#3a2520',
            stroke: { color: '#2a1510', width: 1 }
        }
    },

    // MINE - Earth tones, ore veins, rough-hewn
    'Mine': {
        name: 'Mine',
        background: '#151210',
        floor: { color: '#5a5040' },
        shadow: { color: '#2a2520', x: 8, y: 6 },
        walls: { color: '#0a0805', width: 4, roughness: 2 },
        grid: { color: '#4a4030', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 35,
            fill: '#3a3025',
            stroke: { color: '#252015', width: 1 }
        },
        lowerShading: {
            active: true,
            size: 55,
            fill: '#454035',
            stroke: { color: '#555045', width: 1 }
        }
    },

    // RUINS - Weathered, overgrown grays, ancient
    'Ruins': {
        name: 'Ruins',
        background: '#151815',
        floor: { color: '#6a7065' },
        shadow: { color: '#3a403a', x: 10, y: 8 },
        walls: { color: '#1a1f1a', width: 4, roughness: 2 },
        grid: { color: '#5a605a', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 35,
            fill: '#3a403a',
            stroke: { color: '#2a302a', width: 1 }
        }
    },

    // ==========================================================================
    // LEGACY THEMES (for backwards compatibility)
    // ==========================================================================
    'Old School': {
        name: 'Old School',
        background: '#5693ba',
        floor: { color: '#FFFFFF' },
        walls: { color: '#5693ba', width: 5, roughness: 0 },
        grid: { color: '#88aadd', width: 1, roughness: 0 }
    }
};

