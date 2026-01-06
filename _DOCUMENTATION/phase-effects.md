# Phase Wheel Glyph Effects

## Asset List

```
├── moon_night.png       — Silver crescent
├── sun_dawn.png         — Pale opal, soft rays
├── sun_morning.png      — Warm copper, growing
├── sun_midday.png       — Blazing gold, full corona
├── sun_dusk.png         — Ember red, fading
└── wheel_ring.png       — The stone band itself (no glyphs)
```

## Effects Per Glyph

| Phase | Glow | Particle | Animation |
|-------|------|----------|-----------|
| **Night** | Soft silver pulse | Faint stars | Gentle shimmer |
| **Dawn** | Pale gold bloom | Light motes rising | Slow warm-up |
| **Morning** | Warm orange aura | Heat distortion | Strengthening pulse |
| **Midday** | Blazing corona | Ember sparks | Active pulse (player's turn) |
| **Dusk** | Dying ember | Ash particles falling | Cooling fade |

## Layer Order

```
BOTTOM:  wheel_ring.png (stone, static or slow rotation)
MIDDLE:  glyph shadows (subtle depth)
TOP:     sun/moon glyphs (with individual effects)
OVERLAY: Glow/bloom shaders per glyph
```

## Notes

- **Midday** is the player's action phase — glyph should pulse like a heartbeat
- Effects should be subtle, not distracting
- Stone grinding sound when wheel rotates
- Soft chime or tone when phase locks into position
