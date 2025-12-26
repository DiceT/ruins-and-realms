import { useEffect, useRef } from 'react'
import { Application, Sprite, Container, Assets, RenderTexture } from 'pixi.js'
import { DivideBlendFilter } from '../engine/filters/DivideBlendFilter'

interface PixiAdventureCardProps {
  size: number
  artSrc: string
  glassSrc: string
  onClick?: () => void
}

export const PixiAdventureCard = ({
  size,
  artSrc,
  glassSrc,
  onClick
}: PixiAdventureCardProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

  useEffect(() => {
    if (!containerRef.current || appRef.current) return

    const initPixi = async () => {
      const app = new Application()

      await app.init({
        width: size,
        height: size,
        backgroundAlpha: 0,
        preference: 'webgl'
      })

      if (containerRef.current && !appRef.current) {
        containerRef.current.appendChild(app.canvas)
        appRef.current = app

        try {
          // Load textures
          const artTexture = await Assets.load(artSrc)
          const glassTexture = await Assets.load(glassSrc)

          // Create a RenderTexture at the card size for the glass
          // This ensures the glass texture matches the card dimensions
          const scaledGlassTexture = RenderTexture.create({
            width: size,
            height: size,
            resolution: 1
          })

          // Render glass sprite at card size into the RenderTexture
          const glassSprite = new Sprite(glassTexture)
          glassSprite.width = size
          glassSprite.height = size

          app.renderer.render({
            container: glassSprite,
            target: scaledGlassTexture,
            clear: true
          })

          // Create container for the card
          const cardContainer = new Container()
          app.stage.addChild(cardContainer)

          // Base art sprite
          const artSprite = new Sprite(artTexture)
          artSprite.width = size
          artSprite.height = size
          cardContainer.addChild(artSprite)

          // Apply divide blend filter using the SCALED glass texture
          const divideFilter = new DivideBlendFilter(scaledGlassTexture)
          artSprite.filters = [divideFilter]

        } catch (err) {
          console.error('[PixiAdventureCard] Error loading textures:', err)
        }
      }
    }

    initPixi()

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
      }
    }
  }, [artSrc, glassSrc, size])

  return (
    <div
      ref={containerRef}
      role="button"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        cursor: 'pointer',
        transition: 'transform 0.2s ease',
        border: '4px solid black',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    />
  )
}
