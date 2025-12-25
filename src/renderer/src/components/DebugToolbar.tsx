import { useEffect, useState, useRef } from 'react'

export const DebugToolbar = () => {
  const [stats, setStats] = useState({
    fps: 0,
    zoom: 1,
    centerX: 0,
    centerY: 0,
    mouseX: 0,
    mouseY: 0
  })
  const requestRef = useRef<number>(0)

  useEffect(() => {
    const update = () => {
      const engine = (window as any).__MAP_ENGINE__

      if (engine && engine.camera) {
        const center = engine.camera.center
        const mousePos = engine.app.renderer.events.pointer.global
        const mouse = engine.camera.toWorld(mousePos.x, mousePos.y)

        setStats({
          fps: Math.round(engine.app.ticker.FPS),
          zoom: engine.camera.scale,
          centerX: Math.round(center.x),
          centerY: Math.round(center.y),
          mouseX: Math.round(mouse.x),
          mouseY: Math.round(mouse.y)
        })
      }
      requestRef.current = requestAnimationFrame(update)
    }

    requestRef.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(requestRef.current)
  }, [])

  // Format zoom like Plough: "0.40x"
  const zoomStr = stats.zoom.toFixed(2) + 'x'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1rem',
        left: '1rem',
        right: 'auto',
        backgroundColor: 'rgba(0, 40, 60, 0.9)',
        color: '#0ff',
        fontFamily: 'monospace',
        padding: '8px 12px',
        fontSize: '12px',
        pointerEvents: 'none',
        zIndex: 100,
        lineHeight: '1.5'
      }}
    >
      <div>
        FPS: <span style={{ float: 'right', marginLeft: '2rem' }}>{stats.fps}</span>
      </div>
      <div>
        ZOOM: <span style={{ float: 'right', marginLeft: '2rem' }}>{zoomStr}</span>
      </div>
      <div>
        CENTER:{' '}
        <span style={{ float: 'right', marginLeft: '2rem' }}>
          {stats.centerX}, {stats.centerY}
        </span>
      </div>
      <div>
        MOUSE:{' '}
        <span style={{ float: 'right', marginLeft: '2rem' }}>
          {stats.mouseX}, {stats.mouseY}
        </span>
      </div>
    </div>
  )
}
