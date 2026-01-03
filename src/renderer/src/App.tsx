import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MainMenu } from '@/components/MainMenu'
import { AppLayout } from '@/components/AppLayout'
import { GameWindow } from '@/components/GameWindow'
import { DebugToolbar } from '@/components/DebugToolbar'
import { PixiTestPage } from '@/pixi-components/PixiTestPage'
import { DungeonTestPage } from '@/pixi-components/DungeonTestPage'

function App() {
  const gamePhase = useAppStore((state) => state.gamePhase)
  const showMap = useAppStore((state) => state.showMap)
  const { setGamePhase } = useAppActions()

  // Render based on game phase
  if (gamePhase === 'loading') {
    return <LoadingScreen />
  }

  if (gamePhase === 'menu') {
    return <MainMenu />
  }

  // Developer test pages
  if (gamePhase === 'pixi-test') {
    return <PixiTestPage />
  }

  if (gamePhase === 'dungeon-test') {
    return <DungeonTestPage />
  }

  // Adventure phase - show the game window
  return (
    <AppLayout>
      <GameWindow onBack={() => setGamePhase('menu')} />
      {showMap && <DebugToolbar />}
    </AppLayout>
  )
}

export default App
