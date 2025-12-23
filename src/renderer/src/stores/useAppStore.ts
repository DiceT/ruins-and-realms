import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type GamePhase = 'loading' | 'menu' | 'adventure'

interface AppState {
  gamePhase: GamePhase
  isInitialized: boolean
  currentView: 'map' | 'campaign' | 'settings'
  activeModal: string | null
  showMap: boolean
  actions: {
    setGamePhase: (phase: GamePhase) => void
    setInitialized: () => void
    setView: (view: 'map' | 'campaign' | 'settings') => void
    openModal: (modalId: string) => void
    closeModal: () => void
    toggleMap: () => void
  }
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    gamePhase: 'loading',
    isInitialized: false,
    currentView: 'map',
    activeModal: null,
    showMap: false,
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
      toggleMap: () =>
        set((state) => {
          state.showMap = !state.showMap
        })
    }
  }))
)

export const useAppActions = () => useAppStore((state) => state.actions)
