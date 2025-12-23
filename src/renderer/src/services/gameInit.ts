import { useAppStore } from '@/stores/useAppStore'

/**
 * Initialize game systems and transition to menu.
 * Called once when the app starts.
 */
export async function initializeGame(): Promise<void> {
  const { setGamePhase, setInitialized } = useAppStore.getState().actions

  // Simulate loading time (in real app, this would load assets, fonts, etc.)
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // TODO: Load fonts
  // TODO: Preload critical assets
  // TODO: Initialize audio system
  // TODO: Load user settings

  // Mark as initialized and transition to menu
  setInitialized()
  setGamePhase('menu')
}
