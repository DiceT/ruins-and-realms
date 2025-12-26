import React, { useRef } from 'react'
import { useAppActions, useAppStore } from '@/stores/useAppStore'
import mainMenuBackground from '@/assets/images/backgrounds/main-menu-background.png'
import logoLarge from '@/assets/images/backgrounds/logo-large.png'
import buttonMissions from '@/assets/images/ui/button-missions.png'
import buttonProgression from '@/assets/images/ui/button-progression.png'
import buttonCollection from '@/assets/images/ui/button-collection.png'
import hexSettings from '@/assets/images/ui/hex-button-settings.png'
import hexStats from '@/assets/images/ui/hex-button-statistics.png'
import hexLore from '@/assets/images/ui/hex-button-lore.png'
import hexCredits from '@/assets/images/ui/hex-button-credits.png'
import hexExit from '@/assets/images/ui/hex-button-exit.png'
import iconDiscord from '@/assets/images/ui/icon-discord.png'
import iconContact from '@/assets/images/ui/icon-contact-us.png'
import iconWebsite from '@/assets/images/ui/icon-website.png'
import artNewAdventure from '@/assets/images/ui/art-default-new-adventure.png'
import glassNewAdventure from '@/assets/images/ui/glass-new-adventure.png'

// Menu button configuration
const menuButtons = [
  { id: 'missions', src: buttonMissions, alt: 'Missions' },
  { id: 'progression', src: buttonProgression, alt: 'Progression' },
  { id: 'collection', src: buttonCollection, alt: 'Collection' }
]

// Hex button configuration
const hexButtonsTopRow = [
  { id: 'settings', src: hexSettings, alt: 'Settings' },
  { id: 'stats', src: hexStats, alt: 'Statistics' }
]
const hexButtonsBottomRow = [
  { id: 'lore', src: hexLore, alt: 'Lore' },
  { id: 'credits', src: hexCredits, alt: 'Credits' },
  { id: 'exit', src: hexExit, alt: 'Exit' }
]

// Social icons configuration
const socialIcons = [
  { id: 'discord', src: iconDiscord, alt: 'Discord', offsetY: -5 },
  { id: 'contact', src: iconContact, alt: 'Contact Us', offsetY: 0 },
  { id: 'website', src: iconWebsite, alt: 'Website', offsetY: 0 }
]

interface ImageButtonProps {
  src: string
  alt: string
  onClick?: () => void
  style?: React.CSSProperties
}

const ImageButton = ({ src, alt, onClick, style }: ImageButtonProps): React.ReactElement => {
  return (
    <button
      onClick={onClick}
      style={{
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, filter 0.15s ease',
        padding: 0,
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
        e.currentTarget.style.filter = 'brightness(1.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.filter = 'brightness(1)'
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block'
        }}
      />
    </button>
  )
}

// Social icons row - overlay effect with ember hover
const SocialIconsRow = (): React.ReactElement => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end', // Align bottoms for consistent baseline
        gap: '1.5rem',
        marginTop: 'auto',
        marginBottom: '70px'
      }}
    >
      {socialIcons.map((icon) => (
        <button
          key={icon.id}
          onClick={() => console.log(`${icon.alt} clicked`)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 0.15s ease, opacity 0.15s ease, filter 0.15s ease',
            opacity: 0.75,
            mixBlendMode: 'hard-light'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.opacity = '1'
            // Burning ember color - warm orange/red tint
            e.currentTarget.style.filter = 'sepia(1) hue-rotate(-10deg) saturate(5) brightness(1.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.opacity = '0.5'
            e.currentTarget.style.filter = 'none'
          }}
        >
          <img
            src={icon.src}
            alt={icon.alt}
            style={{
              height: '50px',
              width: 'auto',
              display: 'block',
              marginTop: `${icon.offsetY}px`
            }}
          />
        </button>
      ))}
    </div>
  )
}

import { SettingsModal } from './SettingsModal'
import { PixiAdventureCard } from './PixiAdventureCard'

// ... (existing imports)

// Hex button grid component
const HexButtonGrid = (): React.ReactElement => {
  const hexSize = '30%'
  const { openModal } = useAppActions()

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '0' // Bottom padding
      }}
    >
      {/* Top row: 2 buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4%',
          width: '100%'
        }}
      >
        <ImageButton
          src={hexButtonsTopRow[0].src}
          alt={hexButtonsTopRow[0].alt}
          style={{ width: hexSize, marginLeft: '32px' }}
          onClick={() => openModal('settings')}
        />
        <ImageButton
          src={hexButtonsTopRow[1].src}
          alt={hexButtonsTopRow[1].alt}
          style={{ width: hexSize, marginRight: '37px' }}
        />
      </div>

      {/* Bottom row: 3 buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4%',
          width: '100%',
          marginTop: '-20px'
        }}
      >
        <ImageButton
          src={hexButtonsBottomRow[0].src}
          alt={hexButtonsBottomRow[0].alt}
          style={{ width: hexSize }}
        />
        <ImageButton
          src={hexButtonsBottomRow[1].src}
          alt={hexButtonsBottomRow[1].alt}
          style={{ width: hexSize }}
        />
        <ImageButton
          src={hexButtonsBottomRow[2].src}
          alt={hexButtonsBottomRow[2].alt}
          style={{ width: hexSize }}
          onClick={() => window.close()}
        />
      </div>
    </div>
  )
}

// ... (Layout constants)
import { AssetLoader } from '../engine/assets/AssetLoader'

// ... (existing helper components)

export const MainMenu = (): React.ReactElement => {
  const { setGamePhase, closeModal, setShowMap } = useAppActions()
  const activeModal = useAppStore((state) => state.activeModal)

  const cardsContainerRef = useRef<HTMLDivElement>(null)

  // State for card configurations
  // Initialize with null or empty to defer random selection to client-side effect
  // This avoids hydration mismatches and keeps render pure
  const [cardConfigs, setCardConfigs] = React.useState<Array<{ artSrc: string; glassSrc: string; isFirst: boolean }>>([])

  React.useEffect(() => {
    const allArt = AssetLoader.getAdventureCards()
    const allGlass = AssetLoader.getCrackedGlasses()

    // Helper to get random item
    const getRandom = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

    // We need 6 cards total
    const configs = Array.from({ length: 6 }).map((_, i) => {
      const isFirst = i === 0

      // First card is ALWAYS the special new adventure art
      // Used with its specific glass overlay
      if (isFirst) {
        return {
          artSrc: artNewAdventure,
          glassSrc: glassNewAdventure,
          isFirst: true
        }
      }

      // Others are random
      return {
        artSrc: getRandom(allArt),
        glassSrc: getRandom(allGlass),
        isFirst: false
      }
    })

    setCardConfigs(configs)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        backgroundImage: `url(${mainMenuBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 100
      }}
    >
      {/* Left side - Adventure Cards (78%) */}
      <div
        ref={cardsContainerRef}
        style={{
          width: '78%',
          height: '100%',
          position: 'relative',
          paddingLeft: '40px',
          paddingTop: '40px',
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'center',
          gap: '20px',
          justifyContent: 'center' // Centering the grid
        }}
      >
        {cardConfigs.map((config, i) => (
          <PixiAdventureCard
            key={i}
            size={300}
            artSrc={config.artSrc}
            glassSrc={config.glassSrc}
            onClick={() => {
              console.log('Card clicked:', i, config.isFirst ? '(New Adventure)' : '(Generic)')
              setShowMap(false)
              setGamePhase('adventure')
            }}
          />
        ))}

      </div>

      {/* Right side - Menu Buttons (22%) */}
      <div
        style={{
          width: '22%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: '1rem',
          padding: '2rem'
        }}
      >
        <img
          src={logoLarge}
          alt="Ruins & Realms"
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            marginBottom: '1rem'
          }}
        />
        {menuButtons.map((button) => (
          <ImageButton
            key={button.id}
            src={button.src}
            alt={button.alt}
            style={{ width: '100%' }}
          />
        ))}

        {/* Social icons row */}
        <SocialIconsRow />

        {/* Hex button grid at bottom */}
        <HexButtonGrid />
      </div>

      {/* Modals */}
      {activeModal === 'settings' && <SettingsModal onClose={closeModal} />}
    </div>
  )
}
