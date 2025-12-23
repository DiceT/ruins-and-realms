# Ruins & Realms

## Development Constitution and Design Mandate

---

## 1. Core Identity

**Ruins & Realms (R&R)** is a lightweight, fiction-first exploration engine.  
It must feel complete as a pen-and-paper game and flexible enough to be mediated by AI.

R&R is **not**:

- A simulation engine
- A world-state platform
- A reduced version of Anvil & Loom

R&R **is**:

- Modular
- Human-scaled
- Focused on exploration and discovery
- Capable of multiple player experiences using the same core engine

The system must survive being played tired, distracted, or partially ignored.

---

## 2. Foundational Principle

**Every dice roll is critical to the engine.  
Not every dice roll is critical to the player’s experience.**

The engine always resolves fully.  
What changes is **how much of that process the player directly engages with**.

---

## 3. Immersion Levels (Dice Exposure Models)

R&R supports three immersion levels.  
These do **not** change rules, tables, or probabilities.

They only change **who handles the dice and how results are surfaced**.

---

### 3.1 Dungeon Runner

**Player Fantasy:**  
_“I only control the character and their direct decisions.”_

- Player interacts only with what the character perceives
- All background and structural rolls are resolved by the engine
- Dice are largely invisible to the player
- Results are presented as lived experience, not procedure

Emphasizes:

- Flow
- Surprise
- Immediate decision-making
- Low cognitive overhead

This is the most “game-world-facing” experience.

---

### 3.2 Strategist

**Player Fantasy:**  
_“I manage the expedition and its risks.”_

- Player engages at the meta-decision level
- The engine handles most procedural and support rolls
- The player sees summarized outcomes
- The player explicitly engages with:
  - Major risks
  - Directional choices
  - Significant consequences

Emphasizes:

- Planning
- Resource awareness
- Tradeoffs
- Strategic foresight

Dice are visible **when they influence decisions**, not when they justify structure.

---

### 3.3 Pen and Paper

**Player Fantasy:**  
_“I am the table.”_

- Player rolls every roll
- No hidden dice
- All nested tables are fully exposed
- Interpretation happens in real time

Emphasizes:

- Ritual
- Transparency
- Tactile immersion
- Old-school exploration joy

Dice clatter is part of play, not noise to be filtered.

---

## 4. Dice Design Awareness

When adding a roll during development, always consider:

- Is this roll **engine-critical**, **player-critical**, or both?
- Can this roll be:
  - Hidden (Dungeon Runner)?
  - Summarized (Strategist)?
  - Fully exposed (Pen and Paper)?

A roll that **must** be player-facing in all modes should be rare and meaningful.

---

## 5. Nested Tables and Resolution

- Nested tables are expected and supported
- Follow-up rolls are allowed when the player chooses to zoom in
- The engine may always resolve deeper than the player sees

Stopping early must never break play.

If rolling stops:

- The fiction must still function
- The situation must still be playable
- Interpretation must still be possible

---

## 6. AI Agent Guidance (Architect / Antigravity)

When working on R&R, AI agents must:

- Design one engine, not three systems
- Avoid branching rules per immersion level
- Separate **resolution** from **presentation**
- Assume dice always roll, even when unseen
- Prefer clarity of intent over mechanical cleverness

Forbidden thinking:

- “This roll doesn’t exist in Dungeon Runner”
- “This table only works in PnP”

Required thinking:

- “How is this roll surfaced differently?”
- “What does the player need to know here?”

---

## 7. Success Criteria

R&R is succeeding if:

- The same content supports all three immersion levels
- Players can shift immersion without relearning rules
- Dice depth never forces player fatigue
- Ignoring rules never collapses play

R&R fails when:

- The engine demands attention instead of offering it
- Dice exist only to justify other dice
- The player feels obligated to engage with unwanted procedure

---

## 8. Final Mandate

**Ruins & Realms is about exploration, not exposure.**

The engine may be complex.  
The experience must never feel that way unless the player asks for it.
