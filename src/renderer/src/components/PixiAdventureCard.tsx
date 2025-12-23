import { useEffect, useRef, useMemo } from 'react'
import { Application, Sprite, Container, Assets, RenderTexture } from 'pixi.js'
import { DivideBlendFilter } from '../engine/filters/DivideBlendFilter'

// Import art defaults
import artDefault01 from '@/assets/images/ui/art-default-01.png'
import artDefault02 from '@/assets/images/ui/art-default-02.png'
import artDefault03 from '@/assets/images/ui/art-default-03.png'
import artDefault04 from '@/assets/images/ui/art-default-04.png'
import artDefault05 from '@/assets/images/ui/art-default-05.png'
import artDefault06 from '@/assets/images/ui/art-default-06.png'

// Import cracked glass overlays
import crackedGlass01 from '@/assets/images/ui/cracked-glass-overlay-01.png'
import crackedGlass02 from '@/assets/images/ui/cracked-glass-overlay-02.png'
import crackedGlass03 from '@/assets/images/ui/cracked-glass-overlay-03.png'
import crackedGlass04 from '@/assets/images/ui/cracked-glass-overlay-04.png'

const artDefaults = [
  artDefault01,
  artDefault02,
  artDefault03,
  artDefault04,
  artDefault05,
  artDefault06
]
const crackedGlasses = [crackedGlass01, crackedGlass02, crackedGlass03, crackedGlass04]

const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

interface PixiAdventureCardProps {
  index: number
  size: number
}

export const PixiAdventureCard = ({ index, size }: PixiAdventureCardProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

  // Select images once based on index
  const artImage = useMemo(() => artDefaults[index % artDefaults.length], [index])
  const glassImage = useMemo(() => pickRandom(crackedGlasses), [])

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
          const artTexture = await Assets.load(artImage)
          const glassTexture = await Assets.load(glassImage)

          console.log('[PixiAdventureCard] Card size:', size)
          console.log(
            '[PixiAdventureCard] Glass texture size:',
            glassTexture.width,
            'x',
            glassTexture.height
          )
          console.log(
            '[PixiAdventureCard] Art texture size:',
            artTexture.width,
            'x',
            artTexture.height
          )

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

          console.log(
            '[PixiAdventureCard] Scaled glass texture size:',
            scaledGlassTexture.width,
            'x',
            scaledGlassTexture.height
          )

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

          console.log('[PixiAdventureCard] Rendered card', index, 'with divide filter')
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
  }, [artImage, glassImage, size, index])

  return (
    <div
      ref={containerRef}
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
