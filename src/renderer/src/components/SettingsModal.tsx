import { useRef, useEffect, useState } from 'react'
import { useAppStore, useAppActions } from '@/stores/useAppStore'
import { MusicSystem } from '../engine/audio/MusicSystem'
import stoneDialogTexture from '@/assets/images/ui/nine-slices/stone-02.png'

// Simple slider component moved outside to prevent re-renders
const VolumeSlider = ({ label, value, type, onChange }: { label: string, value: number, type: 'master' | 'music' | 'sfx', onChange: (type: 'master' | 'music' | 'sfx', val: number) => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d4af37', fontFamily: 'serif' }}>
            <span>{label}</span>
            <span>{Math.round(value * 100)}%</span>
        </div>
        <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            onChange={(e) => onChange(type, parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#d4af37' }}
        />
    </div>
)

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
    const { settings } = useAppStore((state) => state)
    const { updateSettings } = useAppActions()
    const modalRef = useRef<HTMLDivElement>(null)
    const [currentTrack, setCurrentTrack] = useState<string>('None')

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    // Poll for current track name (simple solution for now)
    useEffect(() => {
        const checkTrack = () => {
            const track = MusicSystem.getCurrentTrackId()
            if (track) {
                // Format: "the_vast" -> "The Vast"
                const formatted = track.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
                setCurrentTrack(formatted)
            } else {
                setCurrentTrack('None')
            }
        }

        checkTrack()
        const interval = setInterval(checkTrack, 1000)
        return () => clearInterval(interval)
    }, [])

    const handleVolumeChange = (type: 'master' | 'music' | 'sfx', value: number) => {
        updateSettings({ [`${type}Volume`]: value })

        // Apply immediately to Audio System
        if (type === 'music') {
            MusicSystem.setVolume(value)
        } else if (type === 'master') {
            MusicSystem.setMasterVolume(value)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div
                ref={modalRef}
                style={{
                    width: '500px',
                    padding: '2rem',
                    backgroundImage: `url(${stoneDialogTexture})`, // This assumes it's suitable or we use 9-slice via CSS border-image? 
                    // Actually raw img as bg might not stretch well without CSS tricks.
                    // Let's use a solid/gradient bg with border for now essentially or use CSS border-image if texture supports it.
                    // For simplicity/robustness in React:
                    background: '#2a2a2a',
                    border: '2px solid #d4af37',
                    boxShadow: '0 0 20px rgba(0,0,0,0.8), inset 0 0 50px rgba(0,0,0,0.5)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem'
                }}
            >
                <h2 style={{
                    textAlign: 'center',
                    color: '#d4af37',
                    fontFamily: 'serif',
                    fontSize: '2rem',
                    margin: 0,
                    textShadow: '0 2px 4px black'
                }}>Settings</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Now Playing */}
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#888', fontFamily: 'serif', fontSize: '0.9rem' }}>Now Playing:</span>
                        <div style={{ color: '#d4af37', fontFamily: 'serif', fontSize: '1.1rem', marginTop: '0.2rem' }}>
                            {currentTrack}
                        </div>
                    </div>

                    <VolumeSlider label="Master Volume" value={settings.masterVolume} type="master" onChange={handleVolumeChange} />
                    <VolumeSlider label="Music Volume" value={settings.musicVolume} type="music" onChange={handleVolumeChange} />
                    <VolumeSlider label="SFX Volume" value={settings.sfxVolume} type="sfx" onChange={handleVolumeChange} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 2rem',
                            fontSize: '1.2rem',
                            fontFamily: 'serif',
                            background: 'linear-gradient(to bottom, #d4af37, #a48f27)',
                            border: '1px solid #000',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#000',
                            fontWeight: 'bold'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
