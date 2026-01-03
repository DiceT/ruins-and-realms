import { useEffect, useState, useRef } from 'react'

interface DebugToolbarProps {
  tileSize?: number  // Tile size for grid coordinate conversion
}

interface DebugStats {
  app?: any
  camera?: {
    scale: number
    container: {
      x: number
      y: number
      scale: { x: number }
    }
  }
  toWorld?: (x: number, y: number) => { x: number; y: number }
}

export const DebugToolbar = ({ tileSize = 50 }: DebugToolbarProps) => {
  const [stats, setStats] = useState({
    fps: 0,
    zoom: 1,
    centerX: 0,
    centerY: 0,
    tileX: 0,
    tileY: 0
  })
  const requestRef = useRef<number>(0)

  useEffect(() => {
    const update = () => {
      // Try MapEngine first (overworld mode)
      const mapEngine = (window as any).__MAP_ENGINE__
      // Try DungeonViewRenderer (dungeon mode)
      const dungeonDebug = (window as any).__DUNGEON_DEBUG__ as DebugStats | undefined

      if (mapEngine?.camera?.app) {
        // MapEngine mode
        const center = mapEngine.camera.center
        const mousePos = mapEngine.app.renderer.events.pointer.global
        const mouse = mapEngine.camera.toWorld(mousePos.x, mousePos.y)

        setStats({
          fps: Math.round(mapEngine.app.ticker.FPS),
          zoom: mapEngine.camera.scale,
          centerX: Math.round(center.x / tileSize),
          centerY: Math.round(center.y / tileSize),
          tileX: Math.floor(mouse.x / tileSize),
          tileY: Math.floor(mouse.y / tileSize)
        })
      } else if (dungeonDebug?.app) {
        // DungeonViewRenderer mode
        const app = dungeonDebug.app
        const camera = dungeonDebug.camera
        const toWorld = dungeonDebug.toWorld

        if (camera && toWorld) {
          const zoom = camera.scale

          // Get mouse position
          const mousePos = app.renderer?.events?.pointer?.global || { x: 0, y: 0 }
          const mouse = toWorld(mousePos.x, mousePos.y)

          // Calculate center from container position
          const screenCenterX = (app.screen?.width || 800) / 2
          const screenCenterY = (app.screen?.height || 600) / 2
          const center = toWorld(screenCenterX, screenCenterY)

          setStats({
            fps: Math.round(app.ticker?.FPS || 0),
            zoom,
            centerX: Math.round(center.x / tileSize),
            centerY: Math.round(center.y / tileSize),
            tileX: Math.floor(mouse.x / tileSize),
            tileY: Math.floor(mouse.y / tileSize)
          })
        }
      }

      requestRef.current = requestAnimationFrame(update)
    }

    requestRef.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(requestRef.current)
  }, [tileSize])

  // Format zoom like Plough: "0.40x"
  const zoomStr = stats.zoom.toFixed(2) + 'x'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        right: 320,  // Mirror Light & Fog panel position
        background: 'rgba(0,0,0,0.85)',
        color: 'white',
        fontFamily: 'monospace',
        padding: '12px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 2000,
        lineHeight: '1.5',
        borderRadius: '8px',
        border: '1px solid #444',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        minWidth: '140px'
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '14px',
          borderBottom: '1px solid #666',
          paddingBottom: '6px',
          marginBottom: '8px',
          fontWeight: 'bold'
        }}
      >
        Debug Info
      </h3>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#aaa' }}>FPS:</span>
        <span>{stats.fps}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#aaa' }}>ZOOM:</span>
        <span>{zoomStr}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#aaa' }}>CENTER:</span>
        <span>{stats.centerX}, {stats.centerY}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#aaa' }}>TILE:</span>
        <span>{stats.tileX}, {stats.tileY}</span>
      </div>
    </div>
  )
}
