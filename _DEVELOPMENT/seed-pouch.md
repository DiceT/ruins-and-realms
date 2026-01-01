# Manual Seed Queue (Seed Pouch) – Architect Brief
## Approved, Locked Scope (v1)

This document reflects **approved decisions only**.  
Design goal: **simple, robust, extensible later**. No speculative expansion in this phase.

---

## Core Concept

The **SpineSeedGenerator** supports a **FIFO queue of manually defined seeds** (“Seed Pouch”).  
Each seed is a **ManualSeedConfig** that flows through the **same pipeline** as random seeds.

> There is **one unified path** for seed placement and growth.  
> Manual vs random only affects **where the config comes from**, not how it is processed.

---

## Schema Lock (v1)

### ManualSeedConfig (v1)

```ts
interface ManualSeedConfig {
  schemaVersion: 1;

  // Identity
  id?: string;
  type?: string;
  tags?: string[];

  // Geometry
  shape?: "rectangle" | "circle"; // default: rectangle
  width?: RangeOrNumber;
  height?: RangeOrNumber;

  // Placement
  distance?: RangeOrNumber;
  side?: "left" | "right" | "both" | "any" | "random";

  // Doors / Exits
  doorType?: DoorType;
  isExit?: boolean;
  exitType?: string;

  // Control
  mandatory?: boolean;
  allowMirror?: boolean;

  // Gameplay + tuning (non-generator logic)
  metadata?: {
    lootTier?: number;
    difficulty?: number;
    isTrapped?: boolean;
    trapType?: string;

    // Dungeon scoring
    roomScore?: number; // contributes to Dijkstra weighting
  };
}
RangeOrNumber
ts
Copy code
type RangeOrNumber = number | { min: number; max: number };
Seed Pouch Semantics
Queue behavior: FIFO (first in, first out)

No internal randomization

If random ordering is desired, scramble the pouch before injection

Boss / treasure / finale seeds should be placed last in the queue

Repeat Handling
repeat is expanded before generation

The queue contains only fully-expanded seed entries

Generator never handles repeat logic directly

Generator Changes
SpineSeedSettings
ts
Copy code
manualSeedQueue?: ManualSeedConfig[];
Unified Seed Pipeline
All seeds flow through the same method:

scss
Copy code
ejectSeed()
  ├─ if manualSeedQueue.length > 0
  │    └─ dequeue next ManualSeedConfig (FIFO)
  └─ else
       └─ generate virtual ManualSeedConfig from random settings

createRoomFromConfig(config)
There is no special-case logic for manual seeds after dequeue.

Placement Rules
Manual seeds obey all existing collision, growth, and symmetry rules

mandatory: true

Generator must retry placement according to existing retry logic

If placement ultimately fails:

Log failure

Continue generation (no hard stop in v1)

allowMirror

Respected by symmetry system

Default behavior unchanged unless explicitly disabled

Room Data Retention
Each generated room stores:

sourceConfig – the original ManualSeedConfig

resolvedValues – final rolled width/height/distance/etc

placementResult – success/failure metadata

This is required for:

Debugging

Exporting dungeon recipes

Post-generation dressing

Dijkstra / Room Scoring Integration
Rooms contribute to dungeon depth scoring via:

existing distance + door weights

additional roomScore from metadata

Default behavior:

Difficult rooms increase effective distance

Metadata is authoritative, generator does not reinterpret it

UI Requirements (v1)
Seed Pouch UI
FIFO list view

Display:

ID / type

shape

resolved or ranged size

Controls:

Move Up / Down

Delete

Copy seed JSON

Paste seed JSON

Status indicator:

Valid / Invalid schema

Input Method
Large text area (Settings or Debug tab for now)

Paste JSON array

Options:

Overwrite queue

Append to queue

No form-builder required in v1.

Validation Rules
Enforce schemaVersion === 1

Normalize all RangeOrNumber fields on ingest

Reject invalid enums with inline error feedback

Do not attempt partial recovery of malformed seeds

Explicit Non-Goals (Deferred)
Non-rectangular room shapes beyond circle

Placement targeting (near room X, fork-only, etc)

Automatic seed reordering

Gameplay interpretation of metadata

Automated tests (manual validation only)

Acceptance Checklist
Manual seeds appear in order

Manual seeds obey the same growth/collision rules as random seeds

Mandatory seeds retry and log on failure

Room metadata persists post-generation

Dijkstra scoring reflects room difficulty

Schema is versioned and validated

Design principle:

Manual seeds define intent.
The generator still decides reality.

End.