import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type GamePhase = 'loading' | 'menu' | 'adventure'

interface AppState {
  gamePhase: GamePhase
  isInitialized: boolean
  currentView: 'map' | 'campaign' | 'settings'
  activeModal: string | null
  showMap: boolean
  settings: {
    masterVolume: number
    musicVolume: number
    sfxVolume: number
    fullscreen: boolean
  }
  actions: {
    setGamePhase: (phase: GamePhase) => void
    setInitialized: () => void
    setView: (view: 'map' | 'campaign' | 'settings') => void
    openModal: (modalId: string) => void
    closeModal: () => void
    setShowMap: (show: boolean) => void
    toggleMap: () => void
    updateSettings: (settings: Partial<AppState['settings']>) => void
  }
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    gamePhase: 'loading',
    isInitialized: false,
    currentView: 'map',
    activeModal: null,
    showMap: false,
    settings: {
      masterVolume: 1.0,
      musicVolume: 0.5,
      sfxVolume: 1.0,
      fullscreen: false
    },
    actions: {
      setGamePhase: (phase) =>
        set((state) => {
          state.gamePhase = phase
        }),
      setInitialized: () =>
        set((state) => {
          state.isInitialized = true
        }),
      setView: (view) =>
        set((state) => {
          state.currentView = view
        }),
      openModal: (modalId) =>
        set((state) => {
          state.activeModal = modalId
        }),
      closeModal: () =>
        set((state) => {
          state.activeModal = null
        }),
      setShowMap: (show: boolean) =>
        set((state) => {
          state.showMap = show
        }),
      toggleMap: () =>
        set((state) => {
          state.showMap = !state.showMap
        }),
      updateSettings: (newSettings: Partial<AppState['settings']>) =>
        set((state) => {
          state.settings = { ...state.settings, ...newSettings }
        })
    }
  }))
)

export const useAppActions = (): AppState['actions'] => useAppStore((state) => state.actions)
