# Ruins & Realms — Combat System Design Document

*Version 0.1.0 — Draft for Implementation*

---

## Overview

Combat in Ruins & Realms uses a **D88 system** — two eight-sided dice read as a two-digit result, where the **Primary Die** represents the dominant hand and the **Secondary Die** represents the off-hand. Combat is resolved through **Manoeuvres** (specific dice combinations that execute attacks), modified by **Shift Points** (the ability to adjust dice results).

The system is adapted from 2D6 Dungeon's D66 combat, expanded to accommodate the larger possibility space (64 outcomes vs 36) and a 20-level progression.

---

## Core Concepts

### The Dice

```
PRIMARY DIE:    Dominant hand, main weapon, attack arm
SECONDARY DIE:  Off-hand, shield/parry, balance, support

Roll both dice simultaneously.
Read as [Primary, Secondary] — e.g., rolling 5 and 3 = [5,3]

CRITICAL: Dice cannot swap roles.
- Primary die ONLY fills Primary slot
- Secondary die ONLY fills Secondary slot
- [5,3] and [3,5] are DIFFERENT results
```

### Dice Colors (Implementation Note)
Players need two visually distinct D8s:
- **Primary:** Suggested warm color (red, orange, brass)
- **Secondary:** Suggested cool color (blue, silver, steel)

---

## Manoeuvres

A **Manoeuvre** is a specific combat technique with a target dice combination. When your roll matches (or is shifted to match) a Manoeuvre you know, you execute that attack.

### Manoeuvre Definition

```typescript
interface Manoeuvre {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  dice: [number, number];      // [Primary, Secondary] target
  damage: string;              // e.g., "D8", "D8+2", "2D8-1"
  effect?: string;             // Special effect on hit
  description: string;         // Flavor text / visualization
}
```

### Example Manoeuvre

```json
{
  "id": "shield_bash",
  "name": "Shield Bash",
  "tier": 1,
  "dice": [3, 6],
  "damage": "D8",
  "effect": "Target loses 1 Shift Point next round",
  "description": "Lead with the shield, sword following behind"
}
```

---

## Shift Points

**Shift Points** represent combat intuition — the split-second adjustments a trained fighter makes mid-swing.

### Using Shift Points

- Spend **1 Shift Point** to adjust **one die** by **1** (up or down)
- Can distribute Shift Points across both dice in a single roll
- Can use multiple Shift Points on the same die
- **Cannot wrap:** 1↔8 transition is forbidden (no 1→8 or 8→1)

### Shift Point Progression

| Level | Shift Points |
|-------|--------------|
| 1-3   | +2           |
| 4-6   | +2           |
| 7-9   | +3           |
| 10-12 | +3           |
| 13-15 | +4           |
| 16-18 | +4           |
| 19-20 | +5           |

*(Subject to playtesting adjustment)*

---

## Locked Zones — Fumbles & Criticals

Certain dice combinations are **locked** — you cannot shift into or out of them. These represent moments where fate intervenes.

### Fumble Zone (Mishap)

```
[1,1] — Critical Fumble
[1,2] — Fumble  
[2,1] — Fumble

Probability: 3/64 = 4.69%
```

**On Fumble:**
- Attack automatically misses
- Negative consequence occurs (weapon fumble, off-balance, opening for enemy)
- Specific effect may depend on weapon style or enemy

### Prime Zone (Critical)

```
[8,8] — Critical Prime
[7,8] — Prime
[8,7] — Prime

Probability: 3/64 = 4.69%
```

**On Prime:**
- Choose ANY Manoeuvre you know to execute
- Add Shift Points to damage
- Attack ignores enemy Interrupts
- [8,8] may have additional bonus effect

### Locked Zone Rules

1. **Cannot shift INTO** Fumble or Prime zones
2. **Cannot shift OUT OF** Fumble or Prime zones
3. Natural rolls only — fate decides
4. This makes edge Manoeuvres (containing 1, 2, 7, 8) inherently risky

---

## Exact Strike

When you roll the **exact dice combination** of a Manoeuvre without any shifting, you achieve an **Exact Strike**.

**Exact Strike Bonus:**
- Add your current Shift Point total to damage
- Represents perfect instinct, no adjustment needed

### Example

```
Warrior has +3 Shift Points
Knows "Overhead Cleave" [6,4] — D8+3 damage

SCENARIO A: Rolls [6,4]
→ Exact Strike!
→ Damage: D8+3 (base) + 3 (Shift bonus) = D8+6

SCENARIO B: Rolls [5,4], spends 1 Shift to make [6,4]
→ Shifted Strike
→ Damage: D8+3 (base only, no Shift bonus)
```

---

## Combat Sequence

### Turn Order

1. **Player attacks first** (unless ambushed or specific circumstance)
2. **Enemy attacks**
3. **Increment Fatigue Die** (if using)
4. **Repeat** until combat ends

### Player Attack Resolution

```
1. ROLL D88
   └── Roll both dice, read as [Primary, Secondary]

2. CHECK FOR LOCKED ZONES
   ├── Fumble [1,1], [1,2], [2,1] → Mishap occurs, turn ends
   └── Prime [8,8], [7,8], [8,7] → Choose any Manoeuvre, bonus damage

3. ATTEMPT MANOEUVRE MATCH
   ├── Check if roll matches any known Manoeuvre
   ├── If yes → Exact Strike (add Shift to damage)
   └── If no → Consider shifting

4. SHIFT (optional)
   ├── Spend Shift Points to adjust dice
   ├── Cannot shift into/out of locked zones
   ├── Cannot wrap 1↔8
   └── Goal: Match a known Manoeuvre

5. RESOLVE HIT OR MISS
   ├── Match found → Execute Manoeuvre, roll damage
   ├── No match possible → Miss, turn ends
   └── Apply enemy Interrupts (if not Prime)

6. APPLY DAMAGE
   ├── Roll damage dice
   ├── Add Exact Strike bonus (if applicable)
   ├── Subtract enemy Armor/Defense
   └── Reduce enemy HP
```

### Enemy Attack Resolution

```
1. ROLL D88 FOR ENEMY
   └── Use enemy's Shift Points optimally

2. CHECK FOR LOCKED ZONES
   ├── Fumble → Enemy mishap (see creature card)
   └── Prime → Enemy's Prime attack (see creature card)

3. MATCH ENEMY MANOEUVRE
   ├── Shift enemy dice toward their Manoeuvres
   ├── Choose most damaging option if multiple available
   └── Enemies cannot Exact Strike (player advantage)

4. PLAYER DEFENSE
   ├── Check Armor Dice Sets for deflection
   ├── Apply Shield mechanics (if applicable)
   └── Reduce incoming damage

5. APPLY DAMAGE TO PLAYER
   └── Reduce player HP
```

---

## Armor & Defense

### Armor Dice Sets

Each piece of armor has a **Dice Set** — specific die values it can block.

```
ARMOR EXAMPLE:
Chainmail Shirt
├── Dice Set: Primary 4, Primary 5
├── Reduction: -2 damage
└── If enemy hits with Primary 4 or 5, reduce damage by 2
```

When an enemy's successful Manoeuvre has a Primary or Secondary die matching your armor's Dice Set, you deflect some damage.

### Shield Mechanic (Sword & Shield Style)

```
SHIELD DEFENSE:
├── Your SECONDARY die value from your attack...
├── ...sets your shield position for the round
├── Enemy attacks with that PRIMARY value? Blocked/reduced.

EXAMPLE:
You roll [5,7] on your attack.
Your shield is "set" at 7.
Enemy attacks with [7,3] — their Primary 7 matches your shield.
Block triggered — reduce incoming damage.
```

This creates tactical choice: shift for damage, or keep secondary high for defense?

---

## The Fatigue Die (Optional Rule)

Combat becomes easier over time as combatants tire and leave openings.

```
FATIGUE PROGRESSION:
├── Rounds 1-3: Normal
├── Round 4: All combatants +1 Shift
├── Round 5: All combatants +2 Shift
├── Round 6+: All combatants +3 Shift (cap)
```

**Implementation:** Place a D6 beside the combat area, increment each round.

---

## Weapon Styles

Each weapon style has a distinct **Manoeuvre philosophy** based on how Primary and Secondary dice map to body mechanics.

### Sword & Shield
*Defensive specialist. Balance of offense and defense.*

```
HIGH PRIMARY, LOW SECONDARY → Striking (sword leads)
LOW PRIMARY, HIGH SECONDARY → Blocking (shield leads)
BALANCED (4-5 range) → Versatile stance

Special: Shield Defense mechanic
Damage: Lower base, higher survivability
```

### Two-Handed (Greatsword, Greataxe, Polearm)
*Raw power. Both hands driving the arc.*

```
ADJACENT NUMBERS → Power swings (hands together)
DOUBLES → Perfect form
SPREAD → Wild swings (risky)

Special: Cleave (hit multiple enemies?)
Damage: Higher base, less defense
```

### Dual Wield
*Speed and chaos. Independent hands.*

```
SPREAD APART → Flurry (independent strikes)
CLOSE TOGETHER → Scissor/trap (converging)
DOUBLES → Twin strike

Special: Bonus attack chance?
Damage: Moderate per hit, more hits
```

### One-Handed (no off-hand)
*Finesse and precision. Secondary is footwork.*

```
HIGH PRIMARY → Aggressive thrust
BALANCED → Measured strikes
DOUBLES → Precision strike

Special: Riposte/counter mechanics?
Damage: Moderate, high crit potential
```

### Monk / Unarmed
*Flow and philosophy. Yin and yang.*

```
OPPOSITES [1,8], [2,7], [3,6], [4,5] → Yin/yang techniques
DOUBLES → Combination strikes
ADJACENT → Flowing strikes

Special: Multiple smaller hits, status effects
Damage: Lower per hit, many effects
```

---

## Manoeuvre Tiers & Progression

### Tier Distribution (20 Manoeuvres per Style)

| Tier | Levels | Available | Typical Targets | Character |
|------|--------|-----------|-----------------|-----------|
| 1 | 1-5 | 8 Manoeuvres | Center (3-6 range) | Fundamentals |
| 2 | 6-10 | 6 Manoeuvres | Center + edges | Developing |
| 3 | 11-15 | 4 Manoeuvres | Edge-heavy | Advanced |
| 4 | 16-20 | 2 Manoeuvres | Extremes | Signature |

### Equipped Manoeuvre Slots

| Level | Slots |
|-------|-------|
| 1-4 | 3 |
| 5-9 | 3 |
| 10-14 | 4 |
| 15-19 | 4 |
| 20 | 5 |

Players can swap equipped Manoeuvres when resting/between combats.

---

## Enemy Design

### Creature Stats

```typescript
interface Creature {
  id: string;
  name: string;
  level: number;
  hp: number;
  xp: number;
  shift: number;              // Enemy's Shift Points
  manoeuvres: EnemyManoeuvre[];
  interrupts: Interrupt[];
  mishap: string;             // What happens on enemy fumble
  prime: string;              // What happens on enemy crit
  loot?: string;              // Loot table reference
  description: string;
}

interface EnemyManoeuvre {
  name: string;
  dice: [number, number];
  damage: string;
  effect?: string;
}

interface Interrupt {
  trigger: string;            // e.g., "Primary 3" or "Secondary 1,2"
  effect: string;             // e.g., "-2 damage" or "Reflect 1 damage"
  type: "armor" | "movement" | "magic";
}
```

### Interrupt Mechanic

Enemies have **Interrupts** — defensive triggers on specific die values.

```
EXAMPLE:
Skeleton Warrior
├── Interrupt: "Shield Block on Primary 4,5 — reduce damage by 2"
│
├── You hit with [4,3] → Interrupt triggers, -2 damage
└── You hit with [6,3] → No interrupt, full damage
```

Interrupts create target preference — some Manoeuvres bypass specific enemies better.

**Note:** Prime attacks ignore Interrupts entirely.

---

## Damage Calculation

### Base Formula

```
DAMAGE = Weapon Damage + Manoeuvre Modifier + Exact Strike Bonus - Enemy Defense

Where:
├── Weapon Damage: Base die (e.g., D8 for longsword)
├── Manoeuvre Modifier: +X or -X from specific Manoeuvre
├── Exact Strike Bonus: +Shift Points (if natural roll matched)
├── Enemy Defense: Armor value, Interrupt reduction, etc.
```

### Minimum Damage

A 6 on any damage die always deals **at least 1 damage**, regardless of reductions.

---

## Combat States

### Player Conditions

```
HEALTHY → WOUNDED → CRITICAL → DOWN → DEAD

WOUNDED: Below 50% HP — possible mechanical effect
CRITICAL: Below 25% HP — definite mechanical effect  
DOWN: 0 HP — unconscious, one more hit = death
DEAD: Permadeath (or resurrection mechanics if available)
```

### Combat End Conditions

```
VICTORY: All enemies defeated
├── Gain XP
├── Roll loot
├── Heal? (based on abilities/items)

DEFEAT: Player reduced to DOWN, enemy finishes
├── Death (permadeath campaign)
├── OR rescue/capture mechanic

FLED: Player successfully escapes
├── No XP
├── Threat remains
├── Possible free enemy attack on flee attempt
```

---

## Implementation Notes

### UI Requirements

1. **Dice Display**
   - Two distinct D8 representations
   - Clear Primary/Secondary labeling
   - Roll animation
   - Shift adjustment interface

2. **Manoeuvre Reference**
   - List of known Manoeuvres
   - Target dice combinations clearly visible
   - Damage and effects shown
   - Highlight reachable Manoeuvres based on current roll

3. **Shift Tracker**
   - Current Shift Points available
   - Points spent this roll
   - Visual feedback on valid shifts

4. **Combat Log**
   - Roll results
   - Shifts applied
   - Manoeuvre executed
   - Damage dealt/received
   - Narrative flavor text

5. **Enemy Display**
   - HP bar
   - Known Interrupts (after encounter? or hidden?)
   - Current action/intent (optional)

### Data Files Needed

```
/data/combat/
├── manoeuvres/
│   ├── sword-and-shield.json
│   ├── two-handed.json
│   ├── dual-wield.json
│   ├── one-handed.json
│   └── monk.json
├── creatures/
│   ├── undead.json
│   ├── beasts.json
│   ├── humanoids.json
│   └── [etc].json
├── armor.json
└── combat-config.json
```

---

## Playtest Variables

These values are initial estimates and need tuning:

| Variable | Initial Value | Notes |
|----------|---------------|-------|
| Starting Shift | +2 | Match 2D6 Dungeon |
| Fumble Zone | [1,1], [1,2], [2,1] | ~4.7% |
| Prime Zone | [8,8], [7,8], [8,7] | ~4.7% |
| Starting Manoeuvres | 3 | Compensates for 64 vs 36 outcomes |
| Exact Strike Bonus | +Shift to damage | Rewards natural rolls |
| Fatigue Die | Optional | May slow digital play |

---

## Glossary

| Term | Definition |
|------|------------|
| **Primary Die** | The die representing dominant hand; fills Primary slot only |
| **Secondary Die** | The die representing off-hand; fills Secondary slot only |
| **Manoeuvre** | A combat technique with specific dice target |
| **Shift Points** | Resource spent to adjust dice by ±1 |
| **Exact Strike** | Natural roll matching Manoeuvre; bonus damage |
| **Fumble/Mishap** | Locked bad roll zone; cannot shift in/out |
| **Prime/Critical** | Locked good roll zone; cannot shift in/out |
| **Interrupt** | Enemy defensive trigger on specific die values |
| **Dice Set** | Armor's blocking values |

---

*Document Version: 0.1.0*
*Last Updated: 2026-01-05*
*Author: Design Seren*

---