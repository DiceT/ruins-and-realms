import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import loadingBackground from '@/assets/images/backgrounds/loading-screen-background-01.png'

export const LoadingScreen = () => {
  const [isLoaded, setIsLoaded] = useState(false)
  const { setGamePhase } = useAppStore((state) => state.actions)

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  // Listen for any key press after loading
  useEffect(() => {
    if (!isLoaded) return

    const handleKeyPress = () => {
      setGamePhase('menu')
    }

    const handleClick = () => {
      setGamePhase('menu')
    }

    window.addEventListener('keydown', handleKeyPress)
    window.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('keydown', handleKeyPress)
      window.removeEventListener('click', handleClick)
    }
  }, [isLoaded, setGamePhase])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `url(${loadingBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 1000,
        cursor: isLoaded ? 'pointer' : 'default'
      }}
    >
      {/* Loading text in lower right */}
      <p
        style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          fontFamily: 'serif',
          fontSize: '1.5rem',
          color: '#d4af37',
          textShadow: '1px 1px 4px rgba(0, 0, 0, 0.8)',
          animation: 'fadeInOut 2s ease-in-out infinite'
        }}
      >
        {isLoaded ? 'PRESS ANY KEY TO CONTINUE' : 'Loading...'}
      </p>

      {/* Fade in/out animation */}
      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
