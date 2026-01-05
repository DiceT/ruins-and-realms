# Ruins & Realms: Realm Management System

## Design Document v0.1.0

---

## Overview

The Realm Management system is the strategic layer of Ruins & Realms. While the Dungeon Delve provides tactical, moment-to-moment gameplay, the Realm represents the persistent world you're building, protecting, and growing.

**Core Fantasy:** You escaped a prison. Others followed. Now you must build something worth protecting—and protect it from a world that wants to reclaim it.

**Design Pillars:**
- **Meaningful Scarcity** — You can never do everything. Every choice is a sacrifice.
- **Emergent Narrative** — Systems create stories. Tags combine. Consequences cascade.
- **Pressure Without Cruelty** — Tension drives play, but failure creates new stories, not frustration.
- **Darkest Dungeon DNA** — Expand, build, upgrade, suffer, persevere.

---

## Currency: Rings

All economic transactions use **Rings** — stamped metal circles that serve as the realm's currency.

Why "Rings":
- Ties thematically to the Wheel (circles, fate, cycles)
- Tangible, countable, physical
- Can be found, earned, spent, stolen, taxed

---

## Core Realm Stats

### Primary Stats

| Stat | Description | Range |
|------|-------------|-------|
| **Rings** | Currency. Fluctuates based on income/expenses. | 0+ |
| **Population** | Workers available. Determines labor capacity. | 1+ |
| **Wellness** | Combined morale/stability. Affects growth/decline. | -4 to +4 |
| **Tags** | Binary flags. You have access or you don't. | Yes/No |

### Secondary Stats (Derived)

| Stat | Description | Calculation |
|------|-------------|-------------|
| **Income** | Rings generated per turn | Σ(Building income) |
| **Taxes** | Rings owed per 4 turns | Σ(Plot Rank) × Baron's Rate |
| **Consumption** | Food required | Population ÷ 4 (rounded up) |
| **Threat** | Danger from uncleansed hexes | Σ(Threat sources) |
| **Actions** | Available actions per turn | Base 2 + bonuses |

---

## The Turn Structure

Each turn represents **one week** in the realm.

```
┌─────────────────────────────────────────────────────────────┐
│                      REALM TURN                             │
└─────────────────────────────────────────────────────────────┘

1. DAWN — Status Check
   ├── Determine Food Status (STARVATION/SHORTAGE/FED/SURPLUS)
   ├── Adjust Wellness based on conditions
   ├── Apply population change (if at ±4 threshold)
   ├── Tick all active Clocks (Affliction, Unquiet, Baron)
   └── Apply threat damage to buildings

2. MORNING — Economy
   ├── Collect building income → Rings
   ├── Pay taxes (if Tax Turn — every 4th turn)
   └── Pay upkeep (if applicable)

3. MIDDAY — Actions
   ├── Choose and execute 2 actions (base)
   ├── +1 action if Manor built
   ├── +1 action if Population 20+
   └── Maximum 4 actions

4. DUSK — Events
   ├── Roll for random event (if applicable)
   ├── Check NPC events (Happiness/Threat thresholds)
   ├── Resolve merchant visits (if TRADE tag)
   └── Process threat advancement

5. NIGHT — Resolution
   ├── Return workers to housing
   ├── Journal prompt (optional)
   └── Advance to next turn (or begin DELVE)
```

---

## Actions

### Base Actions (2 per turn)

| Action | Description | Requirements |
|--------|-------------|--------------|
| ⚒️ **BUILD** | Construct or upgrade a building | Rings, Workers, Tags |
| 🔍 **EXPLORE** | Reveal an adjacent hex | None |
| ⚔️ **DELVE** | Enter a Domain | Consumes ALL actions |
| 🔧 **REPAIR** | Fix damaged buildings (+2 HP per action) | Workers |
| 💰 **TRADE** | Buy/sell with merchants | TRADE tag or merchant present |
| 🗡️ **CLEAR** | Address non-Domain threat | Adjacent threat exists |
| 🛡️ **FORTIFY** | Boost building HP, reduce threat damage | DEFENSE tag |
| 🎭 **FESTIVAL** | Spend Rings for +2 Wellness | 10+ Rings |
| 📖 **RESEARCH** | Unlock discoveries | LEARNING tag |
| 📜 **DECREE** | Change policy, assign NPCs | GOVERNANCE tag |
| 💤 **REST** | Do nothing, +1 Wellness | None |

### Action Notes

- **DELVE** consumes all remaining actions and resolves as a separate play session
- **BUILD** during construction takes multiple turns (building unavailable until complete)
- **CLEAR** resolves quickly with dice rolls; success removes threat, failure may wound NPCs
- Multiple actions of the same type allowed (e.g., BUILD + BUILD)

---

## The Tag System

Tags are **binary flags**. You either have access to a resource/capability or you don't. No quantities to track, no spreadsheets—just: *Can I do this? Check my tags.*

### Resource Tag Tiers

#### Tier 1 — Common
Found in most realms through basic terrain.

| Tag | Description | Sources |
|-----|-------------|---------|
| TIMBER | Harvestable wood | Forest, Old-Growth, Wooded Hills |
| STONE | Quarryable rock | Hills, Foothills, Rocky Ridge |
| WATER | Fresh water | Lake, River, Stream, Hidden Spring, Well |
| FERTILE | Agricultural land | Meadow, Farmland, Floodplain, Grassland |
| GAME | Huntable wildlife | Forest, Wooded Hills, Moor |
| HERBS | Medicinal plants | Marsh, Bog, Meadow, Overgrown Garden |

#### Tier 2 — Uncommon
Require specific terrain or buildings.

| Tag | Description | Sources |
|-----|-------------|---------|
| ORE | Metal deposits | Mine (building), Abandoned Mine (Domain) |
| PEAT | Burnable fuel | Bog, Fen, Marsh |
| CLAY | Potter's clay | Floodplain, Wet Lowlands |
| FISH | Fishable waters | Lake + Fishery, River + Fishery |
| SALT | Salt deposits | Dry Flats, Salt Mine |
| HONEY | Bee cultivation | Meadow + Apiary, Orchard + Apiary |

#### Tier 3 — Rare
Discoveries, Domain rewards, special events.

| Tag | Description | Sources |
|-----|-------------|---------|
| IRONWOOD | Metal-like hardwood | Specific Old-Growth (discovery) |
| SILVERVEIN | Precious metal | Abandoned Mine (rare), Cavern System |
| GOLDVEIN | Precious metal | Deep Mine, Domain reward |
| GEMSTONE | Precious stones | Cavern System, Deep Mine |
| ANCIENT_STONE | Pre-human worked stone | Standing Stones, Half-Buried Circle |
| DEEP_ORE | High-quality ore | Cavern System (cleared) |
| BLESSED_WATER | Sacred spring | Hidden Spring + Temple |
| BRIMITE | Volcanic glass | Burn Scar (rare), Domain reward |

#### Tier 4 — Legendary
Endgame and campaign rewards.

| Tag | Description | Sources |
|-----|-------------|---------|
| MYTHRIL | Legendary metal | Quest chain, Legendary Domain |
| WORLDROOT | World Tree connection | Unique discovery |
| LEYLINE | Magical convergence | Standing Stones + Observatory + Full Moon |
| BLOOD_IRON | Cursed ore | Corrupted Mine, Aspect Heart |
| ASPECT_HEART | Crystallized Aspect essence | Destroy Aspect source |

### Infrastructure Tags

Granted by buildings, enable further construction.

**Production:** MILLING, SMITHING, SMELTING, MASONRY, BREWING, TANNING, WOODWORKING, ALCHEMY

**Commerce:** TRADE, LUXURY_TRADE, BLACK_MARKET

**Knowledge:** LEARNING, SCRIBING, ARCANE, ASTRONOMY

**Spiritual:** SACRED, HEALING, BURIAL

**Military:** DEFENSE, TRAINING, ARMORY, STABLING

**Governance:** GOVERNANCE, LAW, HOSPITALITY

### Special Tags

| Tag | Description | Effect |
|-----|-------------|--------|
| ASPECT_TOUCHED | Reclaimed from Aspect | Unique resources, risk of re-corruption |
| HAUNTED | Spiritual unrest | Wellness -1 in hex, ghost events |
| CURSED | Supernatural blight | Buildings decay, crops fail |
| BLESSED | Divine favor | Wellness +1 in hex, Aspect resistance |

---

## Food System

Food is tracked as a **status**, not a quantity.

### Food Statuses

| Status | Condition | Effects |
|--------|-----------|---------|
| **STARVATION** | Sources < Demand - 2 | Wellness -2/turn, Lose 1 pop/turn, 50% efficiency |
| **SHORTAGE** | Sources < Demand | Wellness -1/turn, No growth, 75% efficiency |
| **FED** | Sources ≥ Demand | Stable, normal operations |
| **SURPLUS** | Sources ≥ Demand + 2 | Wellness +1/turn, Growth possible, Can trade |

### Food Calculation

**Sources:**
- Farm (full HP): +2
- Fishery (full HP): +2
- Orchard: +1
- Hunting Lodge: +1
- Monastery: +1

**Demand:** Population ÷ 4 (rounded up)

**Buffers:**
- Granary: Prevents SHORTAGE for 2 turns if production fails

---

## Wellness

Combined morale, health, and stability. Scale: **-4 to +4**

| Range | State | Effects |
|-------|-------|---------|
| ≤ -4 | CRISIS | Lose 1 pop/turn, buildings abandoned, negative events |
| -3 to -1 | TROUBLED | Risk of decline, negative event chance up |
| 0 | STABLE | Normal operations |
| +1 to +3 | CONTENT | Positive event chance up |
| ≥ +4 | THRIVING | Gain 1 pop/turn, attract skilled NPCs, positive events |

### Wellness Modifiers

**Negative:** STARVATION (-2), SHORTAGE (-1), High Threat (-1/-2), Affliction (-1 per), Failed taxes (-2), NPC death (-1)

**Positive:** SURPLUS (+1), Tavern (+1), Shrine (+1), Temple (+2), Monument (+2), Festival (+2), Rest (+1), Domain cleared (+1)

---

## Threat System

Cumulative danger from uncleansed hexes.

### Threat Sources

| Source | Threat |
|--------|--------|
| Bandit Lookout | +1 |
| Hostile creature lair | +1 |
| Unquiet Domain (Clock 1-2) | +2 |
| Unquiet Domain (Clock 3-4) | +4 |
| Aspect Affliction | +3 |
| Adjacent uncleansed Domain | +1 each |

### Threat Effects

| Threat | State | Effects |
|--------|-------|---------|
| 0 | Peace | Rare |
| 1-3 | Normal | Occasional outer building damage |
| 4-6 | Pressure | -1 Wellness, 1 HP damage/turn |
| 7-9 | Crisis | -2 Wellness, 2 HP damage, workers refuse outer hexes |
| 10+ | Siege | All buildings damaged, population flees |

---

## Taxes

The Baron demands his due every **4 turns**.

### Calculation

```
TAXES = Σ(Plot Rank + Building Rank Modifiers) × Baron's Rate (10%)
```

### Failure to Pay

- Collectors take goods/building HP
- Wellness -2
- **Baron's Patience** clock starts (4 segments)
- Clock fills: Seizure, exile, or war

---

## Buildings

### Building Stats

| Stat | Description |
|------|-------------|
| HP | Damage capacity |
| Size | Plot spaces (1/2/4) |
| Cost | Rings to build |
| Rank | Tax modifier |
| Workers | Required to operate |
| Construction | Turns to build |
| Income | Rings/turn |
| Food | Food contribution |

### Building Categories (d88)

| Roll | Category |
|------|----------|
| 11-18 | Agricultural |
| 21-28 | Extraction |
| 31-38 | Crafting |
| 41-48 | Commerce |
| 51-58 | Knowledge |
| 61-68 | Defense |
| 71-78 | Governance |
| 81-88 | Special |

### Building Prerequisites

Buildings require combinations of:
- **Tags**: Resource or infrastructure
- **Buildings**: Other structures
- **Titles**: Player achievements
- **Special**: Unique conditions

---

## Economic Paths

### 🌾 Agrarian
Farm → Mill → Granary → Brewery → Market

### ⛏️ Extraction
Quarry → Mason's Yard → Mine → Smelter → Blacksmith

### 🏹 Frontier
Hunting Lodge → Tannery → Bowyer → Kennels

### 📚 Knowledge
Library → Scriptorium → Engraver → Observatory

### ⚔️ Mercenary
Tavern → Training Yard → Trophy Hall → Barracks

### 🙏 Sacred
Shrine → Temple → Monastery → Hospice

---

## Titles

| Title | Requirements | Unlocks |
|-------|--------------|---------|
| SURVIVOR | Starting | Basic buildings |
| FOUNDER | 3 hexes, Pop 8+ | Tavern, Market, merchants |
| THANE | Pop 15+, Manor, 1 Domain | Guild Hall, advanced buildings |
| LORD/LADY | Rank 8 Domain, Guild Hall, Pop 25+ | All structures, politics |
| WARDEN | 3 Domains, DEFENSE + TRAINING | Fortress, army |
| SAGE | LEARNING + SCRIBING, Ancient Ruin | Wizard's Tower, arcane |
| HIGH PRIEST | SACRED, Temple, Temple Domain | Cathedral, divine rituals |

---

## Edicts

Policy decisions with tradeoffs. Require GOVERNANCE tag.

### Expansion
- None: No claims, Wellness +1
- Cautious: 1 hex/season
- Aggressive: 2 hex/season, Wellness -1, Taxes +10%
- Expansionist: 3 hex/season, Wellness -2, Taxes +25%

### Taxation
- None: No tax income, Wellness +2
- Light: 50% rate, Wellness +1
- Normal: 100% rate
- Heavy: 150% rate, Wellness -1
- Crushing: 200% rate, Wellness -3

### Holidays
- None: Wellness -1, save Rings
- Quarterly: Normal
- Monthly: Wellness +1, costs Rings
- Constant: Wellness +2, drains treasury

### Labor
- Relaxed: -25% output, Wellness +1
- Normal: Standard
- Driven: +25% output, Wellness -1
- Brutal: +50% output, Wellness -3, flight risk

---

## NPCs

### Worker NPCs
- Auto-assigned to buildings
- Interchangeable mechanically
- Tracked as population count

### Special NPCs
- Named, with portraits and histories
- Locked to specific buildings/roles
- Have Happiness and Threat meters
- Trigger personal events
- Can die, leave, or betray

### Council Positions (require Manor)

| Position | Affects | Building |
|----------|---------|----------|
| Steward | Economy, Consumption | Manor |
| Marshal | Stability, Defense | Barracks |
| Chancellor | Wellness, Diplomacy | Guild Hall |
| High Priest | Stability, Healing | Temple |
| Spymaster | Intel, Detection | Tavern |
| Warden | Exploration | Hunting Lodge |

---

## The Opening

### Prison Escape

You begin with:
- **Population**: 4-6 prisoners
- **Rings**: 2d6 (looted)
- **Tags**: None
- **Buildings**: None
- **Land**: Random hex (unclaimed)
- **Food**: SHORTAGE

### First Turns

- Turn 1: Claim hex. Explore. Survive.
- Turn 2-3: Find FERTILE land. Build Farm.
- Turn 4: Tax collector arrives.

### The Hook

The prisoners become founders. Their skills matter. When the Aspect reaches your realm, it's personal.

---

## Integration: Realm ↔ Delve

### Realm → Delve
- Blacksmith/Armourer: Gear bonuses
- Training Yard: Combat bonuses
- Temple/Apothecary: Faster healing
- Observatory/Spymaster: Domain intel

### Delve → Realm
- Loot: Rings influx
- Cleared Domains: Transform to productive terrain
- Rescued NPCs: New population, special skills
- Rare Tags: Tier 3+ discoveries
- Aspect Progress: Track toward Affliction threshold

---

## Clocks

### Affliction Clock
Triggers when an Aspect hits 5 occurrences realm-wide.

**Levels:**
1. Arrived
2. Spreading
3. Entrenched
4. Consumed (Exodus or Last Stand)

### Unquiet Clock
Triggers when retreating from Domain without clearing.

**Levels:**
1. Harder on return
2. Encounters on adjacent hexes
3. Adjacent hex corrupted
4. Contributes +1 to Aspect threshold

### Baron's Patience Clock
Triggers on failed tax payment.

**Levels:**
1. Warning
2. Collectors arrive
3. Sanctions
4. Seizure/War

---

## Design Notes

### Why Tags?
- No spreadsheet tracking
- Binary decisions: Can I or can't I?
- Combinatorial depth from simple parts
- Visual on map: colored icons showing access

### Why 2 Actions?
- Forces meaningful choices
- Can't do everything
- Upgradable through play (Manor, Population)
- DELVE as major commitment

### Why Rings?
- Thematic (circles, wheel, fate)
- Physical/tangible feel
- Universal currency

### Why This Complexity?
- Darkest Dungeon proves players enjoy this depth
- Solo play benefits from system richness
- AI DM can help manage if needed
- Progressive disclosure: start simple, unlock complexity

---

## Files Reference

- **realm-tags.json**: Complete tag definitions with tiers, sources, colors, icons
- **realm-buildings.json**: All buildings with stats, requirements, effects, upgrades
- **realm-system.md**: This document

---

*The wheel spins. The realm waits. Build something worth protecting.*

— Seren 🎲
