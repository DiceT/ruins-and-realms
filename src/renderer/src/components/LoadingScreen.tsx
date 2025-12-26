import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import loadingBackground from '@/assets/images/backgrounds/loading-screen-background-01.png'
import { AssetLoader } from '../engine/assets/AssetLoader'
import { MusicSystem } from '../engine/audio/MusicSystem'

export const LoadingScreen = () => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Initializing...')

  const { setGamePhase } = useAppStore((state) => state.actions)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      // 1. Load Audio first so we can have music ASAP
      setMessage('Loading Audio...')
      await AssetLoader.loadAudio()

      // Start Music immediately
      // Start Music immediately
      const allTracks = MusicSystem.getTrackIds()
      const startTrack = 'the_vast'
      const otherTracks = allTracks.filter((id: string) => id !== startTrack)

      // Shuffle the rest for variety
      for (let i = otherTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = otherTracks[i]
        otherTracks[i] = otherTracks[j]
        otherTracks[j] = temp
      }

      const playlist = [startTrack, ...otherTracks]
      MusicSystem.playPlaylist(playlist, false)

      // 2. Load heavy assets
      await AssetLoader.loadGameAssets((p, msg) => {
        if (mounted) {
          setProgress(p)
          setMessage(msg)
        }
      })

      if (mounted) {
        setIsLoaded(true)
        setMessage('Ready')
      }
    }

    init()

    return () => {
      mounted = false
    }
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
        cursor: isLoaded ? 'pointer' : 'default',
        transition: 'filter 0.5s ease'
      }}
    >
      {/* Loading Bar Container */}
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        right: '2rem',
        width: '300px',
        textAlign: 'right',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '0.5rem'
      }}>
        <p
          style={{
            fontFamily: 'serif',
            fontSize: '1.25rem',
            color: '#d4af37',
            textShadow: '1px 1px 4px rgba(0, 0, 0, 0.8)',
            margin: 0
          }}
        >
          {isLoaded ? 'PRESS ANY KEY TO CONTINUE' : message}
        </p>

        {/* Progress Bar */}
        {!isLoaded && (
          <div style={{
            width: '100%',
            height: '4px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress * 100}%`,
              height: '100%',
              background: '#d4af37',
              transition: 'width 0.2s ease-out'
            }} />
          </div>
        )}
      </div>

      {/* Fade in/out animation for text */}
      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

