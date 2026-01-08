# Combat Data Schema Reference

This document provides templates and reference for all JSON data structures used in the D88 combat system.

---

## Status Effect Timing Values

These are the valid `timing` values for `StatusEffect` objects:

| Timing | When It Triggers |
|--------|------------------|
| `roundStart` | Beginning of each round (after Guide reset) |
| `roundEnd` | End of each round (before duration decrement) |
| `turnStart` | When a combatant's turn begins |
| `turnEnd` | When a combatant's turn ends |
| `onRoll` | After dice are rolled |
| `onHit` | When a gambit successfully lands (before damage) |
| `onMiss` | When no valid gambit is available (pass turn) |
| `onDamage` | When dealing damage (can modify outgoing damage) |
| `onTakeDamage` | When receiving damage (can modify incoming damage) |

---

## Effect Action Types

| Type | Description |
|------|-------------|
| `modifyDamage` | Adjust damage (positive = more, negative = block) |
| `modifyGuide` | Adjust Guide points |
| `heal` | Restore HP |
| `dot` | Deal damage over time |
| `stun` | Skip next action (checked via `hasEffect`) |
| `skip` | Similar to stun, skip turn |

---

## Creature Template

```json
{
  "id": "creature_id",
  "name": "Creature Name",
  "portrait": "assets/enemies/portrait.png",
  "level": 1,
  "hp": 10,
  "maxHp": 10,
  "xp": 25,
  "guide": 1,
  "initiative": 0,
  "gambits": [
    {
      "name": "Basic Attack",
      "dice": [3, 3],
      "damage": "1d6",
      "effect": null
    },
    {
      "name": "Heavy Strike",
      "dice": [4, 4],
      "damage": "1d6+2",
      "effect": {
        "id": "stagger",
        "name": "Stagger",
        "timing": "roundStart",
        "target": "opponent",
        "duration": 1,
        "stacks": false,
        "action": { "type": "modifyGuide", "value": -1 }
      }
    }
  ],
  "armor": [],
  "ripostes": [
    {
      "id": "riposte_id",
      "name": "Riposte Name",
      "trigger": { "die": "primary", "value": 4 },
      "effect": { "type": "modifyDamage", "value": -1 }
    }
  ],
  "apex": {
    "name": "Apex Ability Name",
    "damage": "1d6+3",
    "effect": "Ignores armor"
  },
  "nadir": {
    "name": "Nadir Ability Name",
    "effect": {
      "id": "nadir_effect",
      "name": "Stunned",
      "timing": "turnStart",
      "target": "self",
      "duration": 1,
      "stacks": false,
      "action": { "type": "stun" }
    }
  },
  "loot": "gold:10-25",
  "description": "A dangerous foe."
}
```

---

## Player Gambit Template

```json
{
  "id": "gambit_id",
  "name": "Gambit Name",
  "tier": 1,
  "dice": [4, 5],
  "damage": "1d6+1",
  "effect": {
    "id": "effect_id",
    "name": "Effect Name",
    "timing": "onTakeDamage",
    "target": "self",
    "duration": 1,
    "stacks": false,
    "action": { "type": "modifyDamage", "value": -1 }
  },
  "description": "Description of the gambit."
}
```

**Notes:**
- `effect` can be `null`, a string (legacy), or a full `StatusEffect` object
- `tier` ranges from 1-4

---

## Status Effect Template

```json
{
  "id": "unique_effect_id",
  "name": "Display Name",
  "icon": "🛡️",
  "description": "Block 2 damage from next hit",
  "timing": "onTakeDamage",
  "target": "self",
  "duration": 1,
  "stacks": false,
  "action": {
    "type": "modifyDamage",
    "value": -2
  },
  "condition": {
    "die": "primary",
    "value": 4,
    "comparison": "="
  }
}
```

**Required Fields:**
- `id`, `name`, `timing`, `target`, `duration`, `stacks`, `action`

**Description Field:**
- **Used for display** on combat UI badges/tooltips
- Should be short and descriptive (e.g., "Block 2 damage", "-1 Guide next round")

**Duration Options:**
- Number: Turns remaining (decrements at round end)
- Object: Event-based `{ "type": "untilEvent", "event": "onHit" }`

**Target Options:**
- `"self"` — Apply to the effect's source
- `"opponent"` — Apply to the source's opponent

---

## Armor Template

```json
{
  "id": "armor_id",
  "name": "Armor Name",
  "triggers": [
    { "die": "primary", "value": 5 },
    { "die": "primary", "value": 4 },
    { "die": "secondary", "value": 2 }
  ],
  "effect": { "type": "modifyDamage", "value": -2 },
  "isDynamic": false
}
```

**Notes:**
- `isDynamic: true` for Shield (uses player's secondary die as trigger value)
- Static armor: triggers are fixed values

---

## Riposte Template

```json
{
  "id": "riposte_id",
  "name": "Riposte Name",
  "trigger": {
    "die": "primary",
    "value": 4,
    "comparison": "="
  },
  "effect": { "type": "modifyDamage", "value": -1 }
}
```

**Trigger Die Options:**
- `"primary"` — Check attacker's primary die
- `"secondary"` — Check attacker's secondary die
- `"either"` — Check max of both dice

**Comparison Options:**
- `"="` (default), `"<"`, `">"`, `"<="`, `">="`

---

## Trigger Condition Reference

Used in `armor.triggers[]`, `riposte.trigger`, and `effect.condition`:

```json
{
  "die": "primary",
  "value": 4,
  "comparison": "="
}
```

| Field | Options |
|-------|---------|
| `die` | `"primary"`, `"secondary"`, `"either"` |
| `value` | 1-8 |
| `comparison` | `"="`, `"<"`, `">"`, `"<="`, `">="` (default `"="`) |
