import React, { useRef, useEffect, useCallback } from 'react'
import { useAppActions } from '@/stores/useAppStore'
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
import stoneDialogTexture from '@/assets/images/ui/nine-slices/stone-02.png'
import imFellFont from '@/assets/fonts/IMFellEnglishSC-Regular.ttf'
import {
  Application,
  Sprite,
  Container,
  Assets,
  RenderTexture,
  Graphics,
  Text,
  TextStyle,
  NineSliceSprite
} from 'pixi.js'
import { DivideBlendFilter } from '../engine/filters/DivideBlendFilter'

// Dynamically import all images from folders using Vite's import.meta.glob
const adventureCardModules = import.meta.glob('@/assets/images/ui/adventure-cards/*.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>
const crackedGlassModules = import.meta.glob('@/assets/images/ui/cracked-glass/*.png', {
  eager: true,
  import: 'default'
}) as Record<string, string>

// Extract the URLs from the modules
const adventureCards = Object.values(adventureCardModules)
const crackedGlasses = Object.values(crackedGlassModules)

console.log(
  '[MainMenu] Loaded',
  adventureCards.length,
  'adventure cards and',
  crackedGlasses.length,
  'cracked glass textures'
)

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

// Hex button grid component
const HexButtonGrid = (): React.ReactElement => {
  const hexSize = '30%'

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
        />
      </div>
    </div>
  )
}

// Layout constants
const CARDS_PER_ROW = 4
const ROWS = 2
const GAP = 20
const PADDING = 20

export const MainMenu = (): React.ReactElement => {
  const { setGamePhase } = useAppActions()
  const cardsContainerRef = useRef<HTMLDivElement>(null)
  const pixiContainerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

  // Calculate optimal card size based on container dimensions
  const calculateLayout = useCallback(() => {
    if (!cardsContainerRef.current) return null

    const containerWidth = cardsContainerRef.current.clientWidth
    const containerHeight = cardsContainerRef.current.clientHeight

    const widthForCards = containerWidth - 2 * PADDING - (CARDS_PER_ROW - 1) * GAP
    const maxWidthBasedSize = Math.floor(widthForCards / CARDS_PER_ROW)

    const heightForCards = containerHeight - 2 * PADDING - (ROWS - 1) * GAP
    const maxHeightBasedSize = Math.floor(heightForCards / ROWS)

    const cardSize = Math.floor(Math.min(maxWidthBasedSize, maxHeightBasedSize) * 0.9)

    const gridWidth = CARDS_PER_ROW * cardSize + (CARDS_PER_ROW - 1) * GAP
    const gridHeight = ROWS * cardSize + (ROWS - 1) * GAP

    const startX = Math.floor((containerWidth - gridWidth) / 2)
    const startY = Math.floor((containerHeight - gridHeight) / 2)

    return { cardSize, startX, startY, containerWidth, containerHeight }
  }, [])

  // Initialize PixiJS application and handle resizing
  useEffect(() => {
    if (!pixiContainerRef.current || !cardsContainerRef.current) return

    let resizeObserver: ResizeObserver | null = null
    let resizeTimeout: NodeJS.Timeout
    // eslint-disable-next-line prefer-const
    let pollingInterval: NodeJS.Timeout | undefined
    let initialized = false

    const initPixi = async (): Promise<void> => {
      // Prevent multiple initializations or initializing if already exists (unless we want to re-init)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }

      const layout = calculateLayout()
      if (!layout || layout.containerWidth === 0 || layout.containerHeight === 0) {
        console.warn('[MainMenu] Container has 0 dimensions, waiting for resize...')
        return
      }

      const { cardSize, startX, startY, containerWidth, containerHeight } = layout
      console.log('[MainMenu] Initializing with dimensions:', containerWidth, containerHeight)

      // Stop polling once we have valid dimensions
      if (pollingInterval) clearInterval(pollingInterval)
      initialized = true

      const app = new Application()
      await app.init({
        width: containerWidth,
        height: containerHeight,
        backgroundAlpha: 0,
        preference: 'webgl',
        resolution: 1
      })

      if (pixiContainerRef.current) {
        // Clear previous canvas if any
        while (pixiContainerRef.current.firstChild) {
          pixiContainerRef.current.removeChild(pixiContainerRef.current.firstChild)
        }
        pixiContainerRef.current.appendChild(app.canvas)
        appRef.current = app

        try {
          // Load the first card assets separately
          const firstCardArt = await Assets.load(artNewAdventure)
          const firstCardGlass = await Assets.load(glassNewAdventure)
          const artTextures = await Promise.all(adventureCards.map((src) => Assets.load(src)))
          const glassTextures = await Promise.all(crackedGlasses.map((src) => Assets.load(src)))

          // Check if app was destroyed (e.g. component unmounted) during asset loading
          if (!app.renderer) return

          // Load the custom font
          const fontFace = new FontFace('IMFellEnglishSC', `url(${imFellFont})`)
          await fontFace.load()
          if (document.fonts) {
            document.fonts.add(fontFace)
          }

          const numCards = Math.min(6, adventureCards.length + 1) // +1 for the first card

          for (let i = 0; i < numCards; i++) {
            const row = Math.floor(i / CARDS_PER_ROW)
            const col = i % CARDS_PER_ROW
            const x = startX + col * (cardSize + GAP)
            const y = startY + row * (cardSize + GAP)

            const cardContainer = new Container()
            cardContainer.x = x
            cardContainer.y = y
            cardContainer.eventMode = 'static'
            cardContainer.cursor = 'pointer'

            // Pivot for scaling effect
            cardContainer.pivot.set(cardSize / 2, cardSize / 2)
            cardContainer.x = x + cardSize / 2
            cardContainer.y = y + cardSize / 2

            let targetScale = 1.0
            let currentScale = 1.0

            cardContainer.on('pointerover', () => {
              targetScale = 1.05
            })
            cardContainer.on('pointerout', () => {
              targetScale = 1.0
            })

            if (app.ticker) {
              app.ticker.add(() => {
                if (Math.abs(currentScale - targetScale) > 0.001) {
                  currentScale += (targetScale - currentScale) * 0.15
                  cardContainer.scale.set(currentScale)
                }
              })
            }

            app.stage.addChild(cardContainer)

            // First card uses the new adventure art, others use random
            const artTexture =
              i === 0 ? firstCardArt : artTextures[Math.floor(Math.random() * artTextures.length)]
            const artSprite = new Sprite(artTexture)
            artSprite.width = cardSize
            artSprite.height = cardSize
            cardContainer.addChild(artSprite)

            // First card uses specific glass, others use random
            const glassTexture =
              i === 0
                ? firstCardGlass
                : glassTextures[Math.floor(Math.random() * glassTextures.length)]
            const glassSprite = new Sprite(glassTexture)
            glassSprite.width = cardSize
            glassSprite.height = cardSize

            const scaledGlassTexture = RenderTexture.create({
              width: cardSize,
              height: cardSize,
              resolution: 1
            })
            app.renderer.render({ container: glassSprite, target: scaledGlassTexture, clear: true })

            const divideFilter = new DivideBlendFilter(scaledGlassTexture)
            artSprite.filters = [divideFilter]

            // Add text to first card only
            if (i === 0) {
              const textStyle = new TextStyle({
                fontFamily: 'IMFellEnglishSC',
                fontSize: Math.floor(cardSize * 0.08),
                fill: '#d4af37', // Gold color
                align: 'center',
                dropShadow: {
                  color: '#000000',
                  blur: 4,
                  angle: Math.PI / 4,
                  distance: 2
                },
                wordWrap: true,
                wordWrapWidth: cardSize * 0.9
              })
              const cardText = new Text({ text: 'A New\nAdventure\nAwaits...', style: textStyle })
              cardText.anchor.set(0.5, 0.5) // Center both horizontally and vertically
              cardText.x = cardSize / 2
              cardText.y = cardSize / 2 // Center of card
              cardContainer.addChild(cardText)
            }

            // Second card - test text with left alignment
            if (i === 1) {
              const textStyle = new TextStyle({
                fontFamily: 'IMFellEnglishSC',
                fontSize: Math.floor(cardSize * 0.08),
                fill: '#d4af37', // Gold color
                align: 'left',
                dropShadow: {
                  color: '#000000',
                  blur: 4,
                  angle: Math.PI / 4,
                  distance: 2
                },
                wordWrap: true,
                wordWrapWidth: cardSize * 0.9
              })
              const cardText = new Text({
                text: 'The story of...\nImmozen Vast\nApprentice\nGovernor',
                style: textStyle
              })
              cardText.anchor.set(0, 0.5) // Left aligned, vertically centered
              cardText.x = cardSize * 0.1 // 10% margin from left
              cardText.y = cardSize / 2 // Center of card vertically
              cardText.alpha = 0.75 // 75% opacity
              cardContainer.addChild(cardText)
            }

            const border = new Graphics()
            border.rect(0, 0, cardSize, cardSize)
            border.stroke({ width: 4, color: 0x000000 })
            cardContainer.addChild(border)

            // Click handler - first card shows modal, others navigate to game
            if (i === 0) {
              cardContainer.on('pointertap', () => {
                showModal(app, containerWidth, containerHeight)
              })
            } else {
              cardContainer.on('pointertap', () => {
                setGamePhase('adventure')
              })
            }
          }

          console.log('[MainMenu] Rendered', numCards, 'cards')

          // Modal helper function
          function showModal(app: Application, width: number, height: number): void {
            // Create overlay container
            const modalOverlay = new Container()
            modalOverlay.eventMode = 'static'
            app.stage.addChild(modalOverlay)

            // Semi-transparent background
            const dimmer = new Graphics()
            dimmer.rect(0, 0, width, height)
            dimmer.fill({ color: 0x000000, alpha: 0.6 })
            dimmer.eventMode = 'static'
            dimmer.cursor = 'pointer'
            modalOverlay.addChild(dimmer)

            // Close on background click
            dimmer.on('pointertap', () => {
              app.stage.removeChild(modalOverlay)
              modalOverlay.destroy({ children: true })
            })

            // Load and create 9-slice dialog
            Assets.load(stoneDialogTexture).then((dialogTexture) => {
              const dialog = new NineSliceSprite({
                texture: dialogTexture,
                leftWidth: 72,
                topHeight: 180,
                rightWidth: 72,
                bottomHeight: 142
              })

              // Size and center the modal
              dialog.width = Math.min(800, width * 0.7)
              dialog.height = Math.min(600, height * 0.7)
              dialog.x = (width - dialog.width) / 2
              dialog.y = (height - dialog.height) / 2
              dialog.eventMode = 'static' // Prevent click-through to dimmer
              modalOverlay.addChild(dialog)

              // Add title text
              const titleStyle = new TextStyle({
                fontFamily: 'IMFellEnglishSC',
                fontSize: 32,
                fill: '#d4af37',
                align: 'center',
                dropShadow: {
                  color: '#000000',
                  blur: 4,
                  angle: Math.PI / 4,
                  distance: 2
                }
              })
              const title = new Text({ text: 'Start a New Adventure', style: titleStyle })
              title.anchor.set(0.5, 0.5)
              title.x = dialog.width / 2
              title.y = 180 / 2 // Centered in header (topHeight: 180)
              dialog.addChild(title)

              // Add sample body text
              const bodyStyle = new TextStyle({
                fontFamily: 'IMFellEnglishSC',
                fontSize: 20,
                fill: '#cccccc',
                align: 'center',
                wordWrap: true,
                wordWrapWidth: dialog.width - 400
              })
              const body = new Text({
                text: 'Begin your journey into the unknown.\nCreate a new hero and forge your destiny.',
                style: bodyStyle
              })
              body.anchor.set(0.5, 0)
              body.x = dialog.width / 2
              body.y = 300
              dialog.addChild(body)
            })
          }
        } catch (err) {
          console.error('[MainMenu] Error:', err)
        }
      }
    }

    // Set up ResizeObserver for responsive updates
    resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            initPixi()
          }
        }
      }, 200)
    })

    resizeObserver.observe(cardsContainerRef.current)

    // INITIALIZATION STRATEGY:
    // 1. Try immediate init
    initPixi()

    // 2. Poll for dimensions (Fallback for Electron)
    // Check every 100ms for 3 seconds to ensure we catch the window when it becomes visible/sized
    const pollStartTime = Date.now()
    pollingInterval = setInterval(() => {
      if (initialized) {
        clearInterval(pollingInterval)
        return
      }
      if (Date.now() - pollStartTime > 3000) {
        clearInterval(pollingInterval)
        return
      }
      // Retry init
      initPixi()
    }, 100)

    return () => {
      if (resizeObserver) resizeObserver.disconnect()
      clearTimeout(resizeTimeout)
      clearInterval(pollingInterval)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
  }, [calculateLayout, setGamePhase]) // Re-run when layout changes

  // Show game window if game started
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
          paddingLeft: '10px'
        }}
      >
        <div
          ref={pixiContainerRef}
          style={{
            position: 'absolute',
            inset: 0
          }}
        />
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
    </div>
  )
}
