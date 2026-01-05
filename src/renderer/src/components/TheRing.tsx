/**
 * TheRing Component
 * 
 * The Aspect/Domain wheel that defines dungeon identity.
 * - Outer ring (Aspect) rotates counter-clockwise
 * - Inner ring (Domain) rotates clockwise
 * - When BOTH rings have their symbol centered at top, snap and reveal
 * - Masks cover the rings and fade out a specific slice (7s) on alignment
 * 
 * Each ring has 8 segments at 45° each.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// Import ring images
import aspectRingImage from '@/assets/images/ui/the-ring/aspect-outer-ring.png'
import aspectMaskImage from '@/assets/images/ui/the-ring/aspect-mask-ring.png'
import domainRingImage from '@/assets/images/ui/the-ring/domain-inner-ring.png'
import domainMaskImage from '@/assets/images/ui/the-ring/domain-mask-ring.png'

// Import audio
import heavyStoneSound from '@/assets/audio/sfx/heavy-stone-001.mp3'
import ironGratingSound from '@/assets/audio/sfx/iron-grating-001.wav'

// Domain order (clockwise from 0/top)
const DOMAINS = ['Castle', 'Temple', 'Ruins', 'Mine', 'Dungeon', 'Lair', 'Cavern', 'Catacomb']

// Aspect order (clockwise from 0/top)
const ASPECTS = ['Haunted', 'Overgrown', 'Hallow', 'Blighted', 'Infested', 'Cursed', 'Veiled', 'Forsaken']

const SEGMENT_DEGREES = 360 / 8 // 45° per segment

interface TheRingProps {
    visible: boolean
    size?: number
    onAligned?: (aspect: string, domain: string) => void
}

interface MaskRingProps {
    src: string
    revealedIndices: number[]
    size: number
}

// Helper component to render the mask as 8 slices
// allowing us to fade out just one specific slice
function MaskRing({ src, revealedIndices, size }: MaskRingProps) {
    const slices = Array.from({ length: 8 }, (_, i) => i)

    // Clip path for a 45° wedge centered at top (spanning -22.5 to +22.5)
    // 50% 50% is center. 
    // Top edge intersection points for +/- 22.5 deg are approx 29.3% and 70.7% x
    const wedgeClip = 'polygon(50% 50%, 70.8% 0%, 29.2% 0%)'

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            {slices.map((i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        transform: `rotate(${i * 45}deg)`,
                        // Check if this slice should be revealed (faded out)
                        opacity: revealedIndices.includes(i) ? 0 : 1,
                        transition: 'opacity 7s ease-in-out', // 7 second slow fade reveal
                        pointerEvents: 'none',
                        // Use clip-path on the container to slice the wedge
                        clipPath: wedgeClip,
                        WebkitClipPath: wedgeClip,
                    }}
                >
                    {/* 
                         Counter-rotate the image inside so it stays static relative to the ring,
                         effectively reconstructing the original image but now sliceable.
                    */}
                    <img
                        src={src}
                        alt=""
                        style={{
                            width: '100%',
                            height: '100%',
                            transform: `rotate(${-i * 45}deg)`,
                        }}
                    />
                </div>
            ))}
        </div>
    )
}

// Normalize angle to 0-360
function normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360
}

// Get which index is at top for a given rotation
function getIndexAtTop(rotation: number, isClockwise: boolean): number {
    const normalized = normalizeAngle(rotation)
    if (isClockwise) {
        return Math.round((360 - normalized) / SEGMENT_DEGREES) % 8
    } else {
        return Math.round(normalized / SEGMENT_DEGREES) % 8
    }
}

// Check if ANY symbol is centered at top (rotation is near a multiple of 45°)
function isSymbolCenteredAtTop(rotation: number, threshold: number): boolean {
    const normalized = normalizeAngle(rotation)
    const remainder = normalized % SEGMENT_DEGREES
    // Symbol is centered when rotation is within threshold of any 45° mark
    return remainder <= threshold || remainder >= (SEGMENT_DEGREES - threshold)
}

export function TheRing({
    visible,
    size = 600,
    onAligned
}: TheRingProps) {
    const [outerRotation, setOuterRotation] = useState(0)
    const [innerRotation, setInnerRotation] = useState(0)
    const [phase, setPhase] = useState<'spinning' | 'aligned' | 'showing' | 'fading'>('spinning')
    const [textOpacity, setTextOpacity] = useState(0)
    const [currentAspect, setCurrentAspect] = useState(0)
    const [currentDomain, setCurrentDomain] = useState(0)

    // State to track which slices to reveal (cumulative)
    const [revealAspectIndices, setRevealAspectIndices] = useState<number[]>([])
    const [revealDomainIndices, setRevealDomainIndices] = useState<number[]>([])

    const [outerSpeed, setOuterSpeed] = useState(25)
    const [innerSpeed, setInnerSpeed] = useState(30)
    const animationRef = useRef<number | null>(null)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const spinStartTime = useRef<number>(0)
    const warmupDuration = useRef<number>(5000)

    // Audio refs
    const stoneAudioRef = useRef<HTMLAudioElement | null>(null)
    const gratingAudioRef = useRef<HTMLAudioElement | null>(null)

    // Setup audio
    useEffect(() => {
        // 1. Heavy Stone
        const stone = new Audio(heavyStoneSound)
        stone.loop = true
        stone.playbackRate = 0.7
        // @ts-ignore
        if (stone.preservesPitch !== undefined) stone.preservesPitch = false
        // @ts-ignore
        if (stone.mozPreservesPitch !== undefined) stone.mozPreservesPitch = false
        // @ts-ignore
        if (stone.webkitPreservesPitch !== undefined) stone.webkitPreservesPitch = false

        stoneAudioRef.current = stone

        // 2. Iron Grating
        const grating = new Audio(ironGratingSound)
        grating.loop = true
        grating.playbackRate = 0.6
        grating.volume = 0.5
        // @ts-ignore
        if (grating.preservesPitch !== undefined) grating.preservesPitch = false
        // @ts-ignore
        if (grating.mozPreservesPitch !== undefined) grating.mozPreservesPitch = false
        // @ts-ignore
        if (grating.webkitPreservesPitch !== undefined) grating.webkitPreservesPitch = false

        gratingAudioRef.current = grating

        return () => {
            stone.pause()
            stone.src = ''
            grating.pause()
            grating.src = ''
        }
    }, [])

    // Manage audio playback based on phase/visibility
    useEffect(() => {
        const stone = stoneAudioRef.current
        const grating = gratingAudioRef.current
        if (!stone || !grating) return

        if (visible && phase === 'spinning') {
            const playStone = stone.play()
            if (playStone !== undefined) {
                playStone.catch(error => console.warn("Stone audio play blocked:", error))
            }
            const playGrating = grating.play()
            if (playGrating !== undefined) {
                playGrating.catch(error => console.warn("Grating audio play blocked:", error))
            }
        } else {
            stone.pause()
            grating.pause()
        }
    }, [visible, phase])

    const startSpinning = useCallback((options: { resetMasks?: boolean, keepPositions?: boolean } = {}) => {
        const { resetMasks = false, keepPositions = false } = options

        if (!keepPositions) {
            // Reset to random positions (avoid starting near 0)
            const startOuter = 30 + Math.random() * 300
            const startInner = 30 + Math.random() * 300
            setOuterRotation(startOuter)
            setInnerRotation(startInner)
        }

        // Randomize speeds to prevent predictable alignment patterns
        setOuterSpeed(25 + Math.random() * 15)  // 25-40 degrees/sec (faster)
        setInnerSpeed(15 + Math.random() * 10)  // 15-25 degrees/sec (slower)
        setPhase('spinning')
        setTextOpacity(0)

        // Reset reveals (masks become opaque again) ONLY if explicitly requested
        if (resetMasks) {
            setRevealAspectIndices([])
            setRevealDomainIndices([])
        }

        spinStartTime.current = performance.now()
        // 5s warmup for fresh start, 1s for resume to let it roll
        // This prevents instant matching on resume
        warmupDuration.current = keepPositions ? 1000 : 5000
    }, [])

    // Initialize
    useEffect(() => {
        if (!visible) {
            setPhase('spinning')
            setTextOpacity(0)
            setRevealAspectIndices([])
            setRevealDomainIndices([])
            return
        }
        // Start spinning and RESET masks on initial visibility
        startSpinning({ resetMasks: true, keepPositions: false })
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [visible, startSpinning])

    // Spinning animation
    useEffect(() => {
        if (!visible || phase !== 'spinning') return

        let lastTime = performance.now()

        const animate = (currentTime: number) => {
            const delta = (currentTime - lastTime) / 1000
            lastTime = currentTime

            // Outer (Aspect) rotates counter-clockwise (negative)
            setOuterRotation(prev => normalizeAngle(prev - outerSpeed * delta))
            // Inner (Domain) rotates clockwise (positive)
            setInnerRotation(prev => normalizeAngle(prev + innerSpeed * delta))

            animationRef.current = requestAnimationFrame(animate)
        }

        animationRef.current = requestAnimationFrame(animate)

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current)
        }
    }, [visible, phase, outerSpeed, innerSpeed])

    // Update current Aspect/Domain based on rotation
    useEffect(() => {
        // Outer ring (Aspect) - swap direction since ring image is laid out opposite
        const aspectIdx = getIndexAtTop(outerRotation, true)
        setCurrentAspect(aspectIdx)

        // Inner ring (Domain) rotates clockwise
        const domainIdx = getIndexAtTop(innerRotation, true)
        setCurrentDomain(domainIdx)
    }, [outerRotation, innerRotation])

    // Check for alignment - both symbols centered at top
    useEffect(() => {
        if (phase !== 'spinning') return

        // Variable warmup: don't check alignment yet
        if (performance.now() - spinStartTime.current < warmupDuration.current) return

        const THRESHOLD = 1 // degrees - very tight window
        const outerCentered = isSymbolCenteredAtTop(outerRotation, THRESHOLD)
        const innerCentered = isSymbolCenteredAtTop(innerRotation, THRESHOLD)

        // Debug: log periodically
        if (Math.random() < 0.01) {
            console.log(`[TheRing] outer: ${outerRotation.toFixed(1)}° (centered: ${outerCentered}), inner: ${innerRotation.toFixed(1)}° (centered: ${innerCentered})`)
        }

        if (outerCentered && innerCentered) {
            console.log(`[TheRing] ALIGNED! ${ASPECTS[currentAspect]} ${DOMAINS[currentDomain]}`)

            // Snap to nearest 45° mark
            const snapOuter = Math.round(outerRotation / SEGMENT_DEGREES) * SEGMENT_DEGREES
            const snapInner = Math.round(innerRotation / SEGMENT_DEGREES) * SEGMENT_DEGREES
            setOuterRotation(snapOuter)
            setInnerRotation(snapInner)
            setPhase('aligned')

            // Trigger reveals - CUMULATIVE
            const newAspectIdx = getIndexAtTop(snapOuter, true)
            const newDomainIdx = getIndexAtTop(snapInner, true)
            setRevealAspectIndices(prev => [...prev, newAspectIdx])
            setRevealDomainIndices(prev => [...prev, newDomainIdx])

            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
                animationRef.current = null
            }

            // Fade in text
            timeoutRef.current = setTimeout(() => {
                setTextOpacity(1)
                setPhase('showing')
                onAligned?.(ASPECTS[currentAspect], DOMAINS[currentDomain])

                // Hold 10 seconds total (7s fade + 3s hold), then fade out
                timeoutRef.current = setTimeout(() => {
                    setPhase('fading')
                    setTextOpacity(0) // Fade text out

                    // Restart spinning, but KEEP masks revealed
                    timeoutRef.current = setTimeout(() => {
                        // Resume spinning from current position (no jump)
                        // Do NOT reset masks
                        startSpinning({ resetMasks: false, keepPositions: true })
                    }, 1500)
                }, 10000)
            }, 400)
        }
    }, [outerRotation, innerRotation, phase, onAligned, startSpinning, currentAspect, currentDomain])

    if (!visible) return null

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 1000,
            pointerEvents: 'none'
        }}>
            <div style={{
                position: 'relative',
                width: size,
                height: size
            }}>
                {/* 1. Underlying Symbol Rings (Hidden initially by masks) */}

                {/* Outer Symbol Ring (Aspect) */}
                <img
                    src={aspectRingImage}
                    alt="Aspect Ring"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        transform: `rotate(${outerRotation}deg)`,
                        transformOrigin: 'center center'
                    }}
                />

                {/* Inner Symbol Ring (Domain) */}
                <img
                    src={domainRingImage}
                    alt="Domain Ring"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        transform: `rotate(${innerRotation}deg)`,
                        transformOrigin: 'center center'
                    }}
                />

                {/* 2. Masks (Rotate with rings, fade out slice on reveal) */}

                {/* Outer Mask (covers Aspect) */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: `rotate(${outerRotation}deg)`,
                }}>
                    <MaskRing
                        src={aspectMaskImage}
                        size={size}
                        revealedIndices={revealAspectIndices}
                    />
                </div>

                {/* Inner Mask (covers Domain) */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transform: `rotate(${innerRotation}deg)`,
                }}>
                    <MaskRing
                        src={domainMaskImage}
                        size={size}
                        revealedIndices={revealDomainIndices}
                    />
                </div>

                {/* 3. Combination text - only shows when aligned */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    opacity: phase === 'spinning' ? 0 : textOpacity,
                    transition: 'opacity 1.5s ease-in-out',
                    pointerEvents: 'none',
                    fontFamily: '"IM Fell English SC", serif',
                    zIndex: 10
                }}>
                    <div style={{
                        fontSize: size * 0.05,
                        fontWeight: 400,
                        color: '#999',
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        marginBottom: '0.2em',
                        textShadow: '0 0 10px rgba(0,0,0,0.8)'
                    }}>
                        {ASPECTS[currentAspect]}
                    </div>
                    <div style={{
                        fontSize: size * 0.08,
                        fontWeight: 400,
                        color: '#fff',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        textShadow: '0 0 30px rgba(255,255,255,0.4), 0 0 10px rgba(0,0,0,0.8)'
                    }}>
                        {DOMAINS[currentDomain]}
                    </div>
                </div>
            </div>
        </div>
    )
}
