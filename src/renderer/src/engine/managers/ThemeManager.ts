import { Theme, THEMES, RoomLayerConfig } from '../themes/ThemeTypes'

export class ThemeManager {
    public activeThemeName: string = 'None'
    public config: RoomLayerConfig
    private listeners: ((themeName: string, config: RoomLayerConfig) => void)[] = []

    constructor(initialTheme: string = 'None') {
        this.activeThemeName = initialTheme
        this.config = this.getThemeConfig(initialTheme)
    }

    public setTheme(themeName: string) {
        if (!THEMES[themeName]) {
            console.warn(`Theme '${themeName}' not found. Falling back to 'Dungeon'.`)
            themeName = 'Dungeon'
        }

        this.activeThemeName = themeName
        this.config = this.getThemeConfig(themeName)
        this.notifyListeners()
    }

    public getThemeConfig(themeName: string): RoomLayerConfig {
        const theme = THEMES[themeName] || THEMES['Dungeon']
        // Return a deep copy to prevent mutation of the original theme definition
        return JSON.parse(JSON.stringify(theme))
    }

    public onThemeChange(callback: (themeName: string, config: RoomLayerConfig) => void) {
        this.listeners.push(callback)
    }

    public offThemeChange(callback: (themeName: string, config: RoomLayerConfig) => void) {
        this.listeners = this.listeners.filter(cb => cb !== callback)
    }

    private notifyListeners() {
        this.listeners.forEach(cb => cb(this.activeThemeName, this.config))
    }
}
