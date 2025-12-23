# Ruins and Realms: Concept & Planning

## Pillars of Design

1.  **Immersive Pen & Paper**: The digital system facilitates the analog feel. No "game logic automation" (like auto-damage). We provide tools (Dice, Sheets, Maps), player provides agency.
2.  **Visual Fidelity**: High-quality Portraits, 3D Dice, Cards, and Maps.
3.  **Discovery**: Monsters, Terrain, and Buildings are hidden behind a discovery system (The "Lore" tab).

## Architecture Changes

### 1. Main Screen

- **Current**: Tapestry Selection.
- **New Vision**: The primary hub for starting/loading Adventures (Sessions).
- **Tapestry Tree**: Repurposed to organize Game Sheets (Character, Ledger, Lore) instead of just generic text notes.

### 2. Thread Engine (Tapestry)

- **Current Role**: Handles data persistence (Threads, Entries, Sessions).
- **New Role**: The backbone for _everything_.
  - **Character Sheets**: Just a structured Thread.
  - **Realm Ledger**: A structured Thread.
  - **Session Logs**: Already supported.
  - **Lore**: Discovery entries stored here.
- **Action**: We will need to subclass or extend Thread types to support these specific schemas (e.g., a "CharacterThread" with stats vs a generic text thread).

### 3. Panels & Tabs

- **Retention**: Keep the multi-pane layout. It's perfect for having a Map open on one side and a Ledger/Character Sheet on the other.

### 4. Integration

- **Dice**: Already integrated. Will refine as specific mechanics (Shift, D66) dictate.
- **Map (Plough)**: The visual board for the Dungeon/Realm.
- **Cards**: Will likely be UI overlays or specific Panel types to display discovered Lore (Monsters/Items).

## To-Do List (Brainstorming)

- [ ] **Define Thread Schemas**: What does the JSON structure for a "Character Sheet" look like?
- [ ] **Design "Discovery" Logic**: How do we unlock Lore? (Likely manual "Reveal" or linked to Map tokens).
- [ ] **UI Update**: Adapt the Sidebar/Tree to distinguish between "My Character" (Sheet) and "My Adventure" (Session Logs).
