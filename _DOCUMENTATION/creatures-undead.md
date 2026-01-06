# Ruins & Realms — Undead Bestiary

*Creatures of the grave, risen to hunger.*

---

## Creature Stat Block Format

```
NAME
Level X | HP: ## | XP: ##
Shift: +#

MANOEUVRES:
[P,S] Name — Damage — Effect

INTERRUPT:
Trigger — Effect

MISHAP (Fumble): What happens on [1,1], [1,2], [2,1]
PRIME (Critical): What happens on [8,8], [7,8], [8,7]

LOOT: Table reference or specific drops
DESCRIPTION: Flavor text
```

---

# Level 1 — Petty Dead (Local Threats)

*The weakest of the risen. Dangerous in numbers, but individually manageable for even novice warriors.*

---

## Skeleton

```
SKELETON
Level 1 | HP: 6 | XP: 15
Shift: +1

MANOEUVRES:
[4,4] Rusty Slash    — D6    — Basic attack
[5,3] Bone Jab       — D6    — —
[3,5] Clatter Guard  — D6-1  — +1 Defense this round

INTERRUPT:
Primary 4 — Bones rattle aside, -1 damage

MISHAP: Bones scatter. Skeleton is stunned, loses next attack.
PRIME: Skull bite! D6+2 damage, ignores armor.

LOOT: Bone fragments (trade good), chance of rusty weapon
DESCRIPTION: Animated bones held together by necromantic will. 
             Mindless but persistent. Often found in groups.
```

---

## Zombie

```
ZOMBIE
Level 1 | HP: 10 | XP: 20
Shift: +0

MANOEUVRES:
[4,5] Shambling Grab — D6    — On hit: target -1 Shift next round
[5,4] Rotting Slam   — D6+1  — —
[3,4] Hungry Lunge   — D6    — —

INTERRUPT:
Primary 3 — Rotting flesh absorbs blow, -2 damage

MISHAP: Stumbles over own feet. Falls prone, loses next attack.
PRIME: Bite and hold! D6+3 damage, target grappled (escape DC 4).

LOOT: Tattered clothing, occasional coin purse
DESCRIPTION: Slow but durable. The rot makes them hard to hurt 
             with slashing weapons. Fire works better.
```

---

## Crawling Claw

```
CRAWLING CLAW
Level 1 | HP: 4 | XP: 10
Shift: +2

MANOEUVRES:
[5,5] Skitter Scratch — D4    — —
[6,4] Leaping Grasp   — D4    — On hit: attaches, D4 auto-damage next round

INTERRUPT:
Secondary 5, 6 — Dodges beneath strike, -1 damage

MISHAP: Flung away by its own momentum. Stunned 1 round.
PRIME: Eye gouge! D4+2 damage, target -1 to attacks next round.

LOOT: Severed at wrist—sometimes wears a ring
DESCRIPTION: A severed hand animated by spite. Fast and hard to hit.
             Alone they're a nuisance. In swarms, terrifying.
```

---

# Level 2 — Restless Dead

*More dangerous specimens. Some retain echoes of skill from life.*

---

## Skeleton Archer

```
SKELETON ARCHER
Level 2 | HP: 8 | XP: 30
Shift: +2

MANOEUVRES:
[6,3] Arrow Shot     — D6+1  — Ranged. Can attack before melee.
[5,4] Bone Knife     — D6    — Melee fallback
[4,6] Covering Fire  — D6    — Ranged. Target -1 Defense next round

INTERRUPT:
Primary 5 — Steps back, -1 damage from melee attacks only

MISHAP: Bowstring snaps. Must use Bone Knife until repaired (3 rounds).
PRIME: Perfect shot! D8+3 damage, ignores armor.

LOOT: Shortbow (functional), quiver with D6 arrows
DESCRIPTION: These skeletons remember how to aim. They prefer 
             to pepper targets from range before closing.
```

---

## Zombie Dog

```
ZOMBIE DOG
Level 2 | HP: 8 | XP: 25
Shift: +1

MANOEUVRES:
[6,4] Rotting Bite    — D6+2  — —
[5,5] Pounce          — D6+1  — On hit: target knocked prone
[4,3] Gnashing Snap   — D6    — —

INTERRUPT:
Secondary 4 — Twists away, -1 damage

MISHAP: Leg gives out. Movement halved for 2 rounds.
PRIME: Throat lunge! D8+2 damage, target bleeding (D4/round for 2 rounds).

LOOT: Dog collar (occasionally valuable), rotting meat (1 ration if desperate)
DESCRIPTION: Fast for a corpse. Hunts in packs alongside zombie masters.
             The barking stopped long ago, replaced by wet growling.
```

---

## Ghoul

```
GHOUL
Level 2 | HP: 12 | XP: 40
Shift: +2

MANOEUVRES:
[5,4] Raking Claws   — D6+1  — —
[6,5] Paralyzing Bite— D6    — On hit: target must save or -2 Shift for 2 rounds
[4,4] Feasting Frenzy— D6+2  — Only usable on prone/grappled target

INTERRUPT:
Primary 6 — Unnatural dodge, -2 damage

MISHAP: Hunger overtakes sense. Attacks nearest corpse instead (loses turn).
PRIME: Throat tear! D8+3 damage, target paralyzed 1 round.

LOOT: Grave goods (coins, jewelry), partially digested valuables
DESCRIPTION: Once human, now driven only by hunger. Clever enough 
             to ambush. The paralytic touch makes them deadly.
```

---

# Level 3 — Hungry Dead

*Serious threats requiring preparation and skill to defeat.*

---

## Ghast

```
GHAST
Level 3 | HP: 16 | XP: 60
Shift: +2

MANOEUVRES:
[6,4] Eviscerating Claws — D8+1  — —
[5,6] Stench Aura        — D6    — All adjacent: -1 to attacks this round
[7,3] Leaping Feast      — D8+2  — Must not have attacked last round

INTERRUPT:
Primary 5, 6 — Stench confuses attacker, -2 damage

MISHAP: Vomits grave-bile. Stunned 1 round, adjacent take D4 poison.
PRIME: Eviscerate! D10+3 damage, target bleeding D6/round for 2 rounds.

LOOT: Ghast claws (alchemical ingredient), stomach contents (roll trinket table)
DESCRIPTION: A ghoul that has fed well and grown stronger. 
             The stench alone can incapacitate. Leader of ghoul packs.
```

---

## Skeletal Warrior

```
SKELETAL WARRIOR
Level 3 | HP: 14 | XP: 55
Shift: +2

MANOEUVRES:
[5,4] Disciplined Strike — D8    — —
[6,5] Shield Deflect     — D6    — +2 Defense this round
[7,4] Overhead Cleave    — D8+3  — —

INTERRUPT:
Primary 4, 5 — Shield block, -2 damage
Secondary 6 — Parry, -1 damage

MISHAP: Ancient joints lock. Loses next attack.
PRIME: Remembers how to kill! D10+4 damage, ignores Interrupts.

LOOT: Rusted but functional weapon, battered shield, bone armor scraps
DESCRIPTION: These were soldiers in life and death has not dulled 
             their training. Dangerous and disciplined.
```

---

## Shadow

```
SHADOW
Level 3 | HP: 10 | XP: 65
Shift: +3

MANOEUVRES:
[4,5] Cold Touch      — D6    — Ignores physical armor
[6,6] Strength Drain  — D8    — On hit: target -1 Shift until rest (stacks)
[3,6] Slip Through    — D6    — Can attack through walls/obstacles

INTERRUPT:
Primary 1, 2, 3 — Incorporeal, attack passes through, -3 damage
Secondary 7, 8 — Dissolves into darkness, -2 damage

MISHAP: Sunlight or bright light banishes temporarily. Flees for D4 rounds.
PRIME: Embrace of shadow! D8+2 damage, target -2 Shift, cannot be healed this combat.

LOOT: Essence of shadow (magical component), nothing physical
DESCRIPTION: Not truly undead—a fragment of consumed soul given hunger.
             Physical weapons are less effective. Bring light.
```

---

# Level 4 — Malicious Dead

*Intelligent undead with cunning and power. Plan carefully.*

---

## Wight

```
WIGHT
Level 4 | HP: 20 | XP: 90
Shift: +3

MANOEUVRES:
[5,5] Grave Blade     — D8+2  — —
[6,4] Life Drain      — D8    — Heals Wight for half damage dealt
[7,5] Commanding Blow — D8+3  — On hit: nearby lesser undead gain +1 Shift

INTERRUPT:
Primary 5, 6 — Armored, -2 damage
Secondary 4, 5 — Parries with ancient weapon, -1 damage

MISHAP: Memories of life surface. Hesitates, loses turn.
PRIME: Death's embrace! D10+4 damage, heals full damage dealt, target -1 max HP.

LOOT: Ancient weapon (functional, possibly magical), burial treasures, armor scraps
DESCRIPTION: A warrior whose hatred anchored them to undeath.
             Commands lesser dead. Life Drain makes them hard to wear down.
```

---

## Specter

```
SPECTER
Level 4 | HP: 14 | XP: 85
Shift: +3

MANOEUVRES:
[4,6] Chilling Wail   — D8    — All enemies in area: -1 Shift this round
[6,5] Spectral Touch  — D8+2  — Ignores physical armor
[5,7] Phase Strike    — D8+1  — Cannot be Interrupted

INTERRUPT:
Primary 1, 2, 3, 4 — Incorporeal, -3 damage from physical attacks
Secondary 7, 8 — Fades from reality, attack misses entirely

MISHAP: Anchor to mortal realm weakens. Cannot attack next round.
PRIME: Soul freeze! D10+3 damage, target cannot use abilities for 2 rounds.

LOOT: Ectoplasm (magical component), anchoring object (jewelry, weapon)
DESCRIPTION: The ghost of someone who died in terror or rage.
             More substantial than a shadow, fueled by emotion.
```

---

## Zombie Bear

```
ZOMBIE BEAR
Level 4 | HP: 28 | XP: 80
Shift: +1

MANOEUVRES:
[5,4] Rotting Swipe   — D10   — —
[6,3] Crushing Slam   — D10+2 — On hit: target prone
[4,4] Gnaw and Tear   — D8+3  — Only on prone/grappled target

INTERRUPT:
Primary 3, 4, 5 — Massive bulk absorbs blow, -3 damage

MISHAP: Lumbers past target. Target gets free attack.
PRIME: Bear hug! D12+4 damage, target grappled and takes D8 crush damage/round.

LOOT: Bear pelt (damaged but usable), bear fat (alchemical), meat (don't eat it)
DESCRIPTION: Whatever killed this bear, it wasn't enough.
             Slow but devastating. Do not let it grab you.
```

---

# Level 5 — Grave Champions

*The elite of the unliving. Boss-tier threats.*

---

## Wraith

```
WRAITH
Level 5 | HP: 18 | XP: 120
Shift: +4

MANOEUVRES:
[5,5] Soul Rend       — D10   — Ignores all armor
[7,4] Life Siphon     — D8+2  — Heals Wraith for damage dealt
[6,6] Create Spawn    — D8    — On kill: target rises as Shadow under Wraith's control

INTERRUPT:
Primary 1, 2, 3 — Incorporeal, physical attacks deal half damage
Secondary 6, 7, 8 — Phases out, -4 damage

MISHAP: Sunlight sears. Takes D6 damage, flees bright light.
PRIME: Consume soul! D12+4 damage, target -3 max HP permanently, Wraith fully heals.

LOOT: Wraith essence (powerful magical component), nothing physical
DESCRIPTION: The apex incorporeal undead. Creates more of its kind.
             Sunlight is mandatory. Silver weapons help.
```

---

## Skeletal Knight

```
SKELETAL KNIGHT
Level 5 | HP: 24 | XP: 110
Shift: +3

MANOEUVRES:
[6,4] Knight's Strike     — D10+2 — —
[5,6] Shield Wall         — D8    — +3 Defense, adjacent allies +1 Defense
[7,5] Devastating Charge  — D10+4 — Must have moved this round
[4,5] Disciplined Defense — D8    — Counter: if attacked this round, free attack

INTERRUPT:
Primary 4, 5, 6 — Tower shield, -3 damage
Secondary 5, 6 — Armor deflection, -2 damage

MISHAP: Honorable instincts emerge. Cannot attack prone or fleeing enemies this round.
PRIME: Deathblow! D12+5 damage, ignores all Interrupts and armor.

LOOT: Knight's weapon (quality), tower shield, plate armor (damaged but repairable)
DESCRIPTION: A knight who swore an oath even death couldn't break.
             Masterful combatant. Often guards something important.
```

---

## Mummy

```
MUMMY
Level 5 | HP: 26 | XP: 130
Shift: +3

MANOEUVRES:
[5,4] Wrapping Grasp  — D8+2  — On hit: target grappled
[6,5] Ancient Curse   — D10   — On hit: target cursed (-1 all rolls until rest)
[7,6] Desiccating Touch— D10+3— On hit: target cannot heal for 3 rounds
[4,4] Relentless Slam — D8+1  — —

INTERRUPT:
Primary 4, 5 — Linen wrappings absorb blow, -2 damage
Secondary 3, 4 — Ancient wards flare, magical attacks deal half damage

MISHAP: Wrappings catch fire (if fire present) or unravel. -2 Defense for 2 rounds.
PRIME: Royal decree! D12+4 damage, target cursed AND cannot heal. Terrifying presence: all enemies -1 Shift.

LOOT: Burial gold, sacred amulet, mummy wrappings (magical component), canopic jars
DESCRIPTION: Entombed royalty, cursed to guard their treasures forever.
             Fire is their weakness. The curses are their strength.

SPECIAL: Vulnerable to fire. Fire damage +50%.
```

---

# Quick Reference Table

| Creature | Lvl | HP | XP | Shift | Manoeuvres | Key Threat |
|----------|-----|-----|-----|-------|------------|------------|
| Skeleton | 1 | 6 | 15 | +1 | 3 | Numbers |
| Zombie | 1 | 10 | 20 | +0 | 3 | Durability, grapple |
| Crawling Claw | 1 | 4 | 10 | +2 | 2 | Speed, attach |
| Skeleton Archer | 2 | 8 | 30 | +2 | 3 | Ranged attacks |
| Zombie Dog | 2 | 8 | 25 | +1 | 3 | Speed, bleed |
| Ghoul | 2 | 12 | 40 | +2 | 3 | Paralysis |
| Ghast | 3 | 16 | 60 | +2 | 3 | Stench, bleed |
| Skeletal Warrior | 3 | 14 | 55 | +2 | 3 | Trained fighter |
| Shadow | 3 | 10 | 65 | +3 | 3 | Incorporeal, drain |
| Wight | 4 | 20 | 90 | +3 | 3 | Life drain, commands |
| Specter | 4 | 14 | 85 | +3 | 3 | Incorporeal, disables |
| Zombie Bear | 4 | 28 | 80 | +1 | 3 | Raw damage, grapple |
| Wraith | 5 | 18 | 120 | +4 | 3 | Soul damage, spawn |
| Skeletal Knight | 5 | 24 | 110 | +3 | 4 | Elite combatant |
| Mummy | 5 | 26 | 130 | +3 | 4 | Curses, anti-healing |

---

# Design Notes

## Scaling Philosophy
- **Level 1:** HP 4-10, Shift +0-2, 2-3 manoeuvres, simple effects
- **Level 2:** HP 8-12, Shift +1-2, 3 manoeuvres, status effects appear
- **Level 3:** HP 10-16, Shift +2-3, 3 manoeuvres, dangerous effects
- **Level 4:** HP 14-28, Shift +1-3, 3 manoeuvres, healing/draining
- **Level 5:** HP 18-26, Shift +3-4, 3-4 manoeuvres, boss mechanics

## Interrupt Design
- Low-level: Single die trigger, small reduction
- Mid-level: Multiple triggers, moderate reduction
- High-level: Wide triggers, major reduction or special effects

## Incorporeal Rules
Shadows, Specters, and Wraiths are **incorporeal**:
- Physical weapons deal half damage (or less via Interrupts)
- Magical weapons deal full damage
- Silver weapons deal full damage
- They can move through solid objects
- Sunlight/bright light is harmful

## Undead Immunities (All)
- Immune to poison
- Immune to sleep/charm
- Immune to fear (they cause it)
- Don't need to breathe

---

*Document Version: 0.1.0*
*Last Updated: 2026-01-05*
*Author: Design Seren*