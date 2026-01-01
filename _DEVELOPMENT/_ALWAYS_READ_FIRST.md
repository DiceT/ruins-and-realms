# Ruins and Realms Development Guidelines

## Project Overview

This project unifies the Anvil & Loom VTT shell, the Plough Map Engine, and the Dungo/DiceT Combat systems into a cohesive "Ruins and Realms" experience.

## Engine Rules (Plough Memetics & Needs)

1.  **Engine Is the Only Loop**: Only `engine.ts` advances time. No `setInterval`.
2.  **Brains Never Mutate**: Brains read state and output choices. They DO NOT modify the world.
3.  **Behaviors Produce Actions**: Behaviors return action requests. They DO NOT run loops or mutate state.
4.  **ActionQueue Execution**: All mutations happen via Actions in the queue.
5.  **Strict Priority**: `ActionPriority` must be respected.
6.  **No New Systems**: Stick to Needs, Perception, Brain, Behaviors, Actions.

## Development Philosophy & Architecture

### 1. The "Engine" Law (Data Flow Sanctity)

- **Single Source of Truth**: The `Engine` is the only thing that advances time. No rogue `setIntervals`.
- **Unidirectional Flow**:
  - **Brains** (Logic) only read state and decide intent.
  - **Behaviors** (Intent) only request actions.
  - **Actions** (Mutation) are the _only_ things that modify state via the `ActionQueue`.
- **Determinism**: This ensures replayability and clear debugging traces.

### 2. Architecture: Explicit, Modular & Facades

- **Single Entry/Exit (Facades)**: Every subsystem (Dice, Tables, Logging) should have a single, clear definition. "If I need a dice roll, I go to the Dice Facade."
- **No Magic**: Avoid hidden side effects. Subsystem interactions must be visible (via stores/props).
- **Strangler Fig / Composition**: Build new systems cleanly. Plug in legacy modules (like Map Engine) only as isolated "cartridges".

### 3. Aesthetics & User Experience

- **Premium Feel**: State-of-the-art UI (Glassmorphism, animations). No "developer art".
- **Visual Feedback**: The system must verify its internal state visually to the user (e.g., loading states, thinking ticks).

### 4. Workflow

- **Strict Typing**: Interfaces are contracts. Enforce them.
- **Clean Workspace**: Maintain the `_DEVELOPMENT` folder. Keep the ship tidy.

## Files

- `cleanup_notes.md`: See `_DEVELOPMENT/cleanup_notes.md` for details on the migration/cleanup.

SPINE RULES:

1. The Spine PATH is the path the spine takes to eject seeds.
2. After that, the Spine PATH is only used as a GUIDE or REFERENCE.
3. ONLY on Spine widths of 3, 5, and 7, the Spine PATH is used to draw the Spine CORRIDOR.
4. The Spine CORRIDOR is always 2 squares LESS wide than the Spine width (3 = 1 wide, 5 = 3 wide, 7 = 5 wide).
5. DO NOT TOUCH THE SPINE PATH! DO NOT USE IT FOR ANYTHING UNLESS EXPLICITLY INSTRUCTED TO!


