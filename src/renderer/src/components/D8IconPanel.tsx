import React from 'react'
import { useSettings } from '../integrations/anvil-dice-app/store/SettingsContext'

export const D8IconPanel: React.FC = () => {
  const { settings } = useSettings()
  const theme = settings.theme

  // Default Fallbacks
  const primaryDice = theme?.diceColor || '#dddddd'
  const primaryLabel = theme?.labelColor || '#000000'
  const primaryOutline = theme?.outlineColor || '#000000'

  const secondaryDice = theme?.diceColorSecondary || primaryDice
  const secondaryLabel = theme?.labelColorSecondary || primaryLabel
  const secondaryOutline = theme?.outlineColorSecondary || primaryOutline

  const icons = Array.from({ length: 8 }, (_, i) => i + 1)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50px', // Align with other buttons
        width: '200px', // Match button width
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '8px',
        backgroundColor: '#2e3f41', // Optional: Panel background or transparent? User asked for "panel of them".
        // Let's make it look integrated, maybe just transparent or a subtle frame.
        // Matching the button style a bit:
        padding: '10px',
        border: '1px solid #bcd3d2',
        pointerEvents: 'auto',
        userSelect: 'none'
      }}
    >
      {icons.map((num) => {
        const isEven = num % 2 === 0
        const diceColor = isEven ? secondaryDice : primaryDice
        const labelColor = isEven ? secondaryLabel : primaryLabel
        const outlineColor = isEven ? secondaryOutline : primaryOutline

        return (
          <div
            key={num}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="40" height="40" viewBox="0 0 100 100">
              {/* Equilateral Triangle (Pointing Up) */}
              {/* Center ~50,50. Size ~80 */}
              <polygon
                points="50,10 90,80 10,80"
                fill={diceColor}
                stroke={outlineColor}
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <text
                x="50"
                y="60" // Visual optical center
                textAnchor="middle"
                dominantBaseline="middle"
                fill={labelColor}
                fontSize="32"
                fontFamily={theme?.font || 'Arial'}
                fontWeight="bold"
              >
                {num}
              </text>
            </svg>
          </div>
        )
      })}
    </div>
  )
}
