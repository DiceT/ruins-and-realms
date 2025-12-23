import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MainMenu } from '@/components/MainMenu'
import { AppLayout } from '@/components/AppLayout'
import { GameWindow } from '@/components/GameWindow'
import { DebugToolbar } from '@/components/DebugToolbar'

function App() {
  const gamePhase = useAppStore((state) => state.gamePhase)
  const { setGamePhase } = useAppActions()

  // Render based on game phase
  if (gamePhase === 'loading') {
    return <LoadingScreen />
  }

  if (gamePhase === 'menu') {
    return <MainMenu />
  }

  // Adventure phase - show the game window
  return (
    <AppLayout>
      <GameWindow onBack={() => setGamePhase('menu')} />
      <DebugToolbar />
    </AppLayout>
  )
}

export default App
