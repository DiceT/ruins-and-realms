
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
    'Dungeon': {
        name: 'Dungeon',
        // thumbnail: 'assets/themes/dungeon.png',
        background: '#DDDDDD',
        floor: { color: '#cccccc' },
        shadow: { color: '#999999', x: 12, y: 9 },
        walls: { color: '#000000', width: 4, roughness: 1 },
        grid: { color: '#666666', width: 1, roughness: 0 }
    },
    'Old School': {
        name: 'Old School',
        // thumbnail: 'assets/themes/old_school.png',
        background: '#5693ba',
        floor: { color: '#FFFFFF' },
        walls: { color: '#5693ba', width: 5, roughness: 0 },
        grid: { color: '#88aadd', width: 1, roughness: 0 }
    },
    'Rough Cavern': {
        name: 'Rough Cavern',
        // thumbnail: 'assets/themes/rough_cavern.png',
        background: '#DDDDDD',
        floor: { color: '#cccccc' },
        shadow: { color: '#999999', x: 12, y: 9 },
        walls: { color: '#000000', width: 4, roughness: 3 },
        grid: { color: '#666666', width: 1, roughness: 0 },
        upperShading: {
            active: true,
            size: 35,
            fill: '#494949',
            stroke: { color: '#373737', width: 1 }
        },
        lowerShading: {
            active: true,
            size: 70,
            fill: '#828282',
            stroke: { color: '#999999', width: 1 }
        }
    },
    'None': {
        name: 'None',
        background: '#000000',
        floor: { color: '#FFFFFF' },
        walls: { color: '#333333', width: 1, roughness: 0 },
        grid: { color: '#CCCCCC', width: 1, roughness: 0 }
    }
};
