/**
 * PixiTestPage
 * 
 * Standalone test page for verifying @pixi/react integration.
 * Add this to App.tsx routes temporarily for testing.
 * 
 * Usage in App.tsx:
 *   import { PixiTestPage } from './pixi-components/PixiTestPage'
 *   // In your router/conditional rendering:
 *   <PixiTestPage />
 * 
 * DELETE THIS FILE after verification is complete.
 */

import { useRef, useState } from 'react'
import { PixiApplication } from './PixiApplication'
import { PixiTestStage } from './stages/PixiTestStage'

export function PixiTestPage() {
    const containerRef = useRef<HTMLDivElement>(null)
    const [showTest, setShowTest] = useState(true)

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                backgroundColor: '#0f0f1a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Arial, sans-serif'
            }}
        >
            {/* Header */}
            <div style={{
                color: '#fff',
                marginBottom: '20px',
                textAlign: 'center'
            }}>
                <h1 style={{
                    margin: 0,
                    fontSize: '28px',
                    background: 'linear-gradient(135deg, #7c3aed, #22d3ee)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    @pixi/react Integration Test
                </h1>
                <p style={{ color: '#666', marginTop: '8px' }}>
                    If you see purple rectangle, cyan orb, and text below — it's working!
                </p>
            </div>

            {/* Canvas container */}
            <div
                ref={containerRef}
                style={{
                    width: '600px',
                    height: '400px',
                    border: '2px solid #333',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}
            >
                {showTest && (
                    <PixiApplication
                        width={600}
                        height={400}
                        backgroundColor={0x1a1a2e}
                    >
                        <PixiTestStage />
                    </PixiApplication>
                )}
            </div>

            {/* Controls */}
            <div style={{ marginTop: '20px' }}>
                <button
                    onClick={() => setShowTest(!showTest)}
                    style={{
                        padding: '10px 24px',
                        fontSize: '14px',
                        backgroundColor: showTest ? '#dc2626' : '#16a34a',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    {showTest ? 'Unmount Application' : 'Mount Application'}
                </button>
            </div>

            {/* Instructions */}
            <div style={{
                marginTop: '40px',
                color: '#555',
                fontSize: '12px',
                textAlign: 'center'
            }}>
                <p>✓ Test mount/unmount to verify cleanup works correctly</p>
                <p>✓ Check browser console for any errors</p>
                <p>✓ Delete PixiTestPage.tsx and PixiTestStage.tsx after verification</p>
            </div>
        </div>
    )
}
