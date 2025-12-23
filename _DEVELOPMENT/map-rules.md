# Dungeon Map Generation Rules

This document explains how dungeon maps are created, step by step, in simple terms.

---

## Part 1: The Map Grid

Think of the map like a big piece of graph paper. Each little square on the paper is called a **tile** or **grid cell**.

### Map Size

- When you create a new dungeon, you pick a size like "20 by 20".
- The computer actually makes the map **4 tiles bigger** (24 by 24).
- Why? Because we need a border around the edges (explained below).

### The Dead Border

- The outer **2 rows and 2 columns** on every side are called the **"dead zone"**.
- You can't build rooms or exits here. It's like a fence around a playground.
- This border is drawn with a scratchy pencil texture so you can see it.

**Visual Example (8x8 map with 2-tile border):**

```
D D D D D D D D
D D D D D D D D
D D . . . . D D
D D . . . . D D
D D . . . . D D
D D . . . . D D
D D D D D D D D
D D D D D D D D
```

- `D` = Dead zone (can't build here)
- `.` = Open (can build here)

---

## Part 2: Placing the Entrance

The entrance is where adventurers walk into the dungeon. It's the very first thing you place.

### The Rules:

1. The entrance MUST be placed on the **bottom edge** of the playable area.
   - That means row `height - 3` (just inside the dead border).
2. It can be anywhere along that bottom row, but NOT in the dead zone corners.
3. The entrance is **1 tile wide**.

### What Happens When You Place It:

- The tile to the **left** of the entrance becomes a dead zone.
- The tile to the **right** of the entrance becomes a dead zone.
- This creates a little "corridor" feeling at the entrance.

**Example:**

```
Before:               After placing entrance at column 5:
. . . . . . .         . . . . D E D . .
                      (D = now dead, E = entrance)
```

---

## Part 3: Rolling for the Starting Room

After placing the entrance, you roll dice to determine how big your first room is.

### How to Roll:

1. Roll **2 dice (2d6)**.
2. The first die = room **width** (in tiles).
3. The second die = room **height** (in tiles).

### Special Rules for the Starting Room:

- If you roll a **1**, it becomes a **2** (no skinny 1-tile corridors for starting rooms).
- The room must have at least **6 tiles** but no more than **12 tiles**.
- If your roll is too small or too big, the computer adjusts it for you.

**Example:**

- You roll a 2 and a 4. That's 2×4 = 8 tiles. ✅ That works!
- You roll a 1 and a 2. The 1 becomes a 2, so it's 2×2 = 4. Too small!
  - The computer bumps it up to 2×3 = 6 tiles. ✅

---

## Part 4: Placing the Starting Room

Now you need to put the room on the map.

### The Rules:

1. The bottom edge of the room MUST touch the entrance.
   - The entrance tile must be directly below one of the room's bottom tiles.
2. The room must stay **inside the playable area** (not overlapping the dead border).

### What Happens When You Place It:

- The tiles under the room become "ROOM" tiles.
- A **1-tile buffer** around the room is marked as "dead zone" (so you can't build another room right next to it without a corridor).

---

## Part 5: Placing Exits

Exits are doorways that lead out of a room. Later, you can expand the dungeon through these exits.

### The Rules:

1. Exits are placed on the **walls** of the room.
2. You can't place an exit on a wall that:
   - Touches the dead border.
   - Already has another room or corridor connected.
   - Is the wall you entered through (the entrance side).
3. Exits are **1 tile** and sit just outside the room's edge.

### What Gets Blocked:

- Once you place an exit on a wall direction (top, left, or right), that wall is "used".
- You can still place exits on other parts of the same wall, but the dice will limit how many you roll.

---

## Part 6: Expanding the Dungeon

When you click on an exit you've placed, you can expand a new room from it.

### How It Works:

1. Click on an empty exit (one that isn't already connected to a room).
2. Roll dice for the new room's size (same 2d6 rules, but no special "starting room" adjustments).
3. Place the new room so it touches the exit.

### Doubles Bonus:

- If you roll **doubles** (like 3 and 3), you roll again and **add** the new dice to your size.
- This only happens once per room (no infinite bonuses).

**Example:**

- You roll 4 and 4 (doubles!). Your base room is 4×4.
- You roll bonus dice: 2 and 5.
- Final room size: (4+2) × (4+5) = 6×9 tiles. That's a big room!

---

## Part 7: How Walls Are Blocked

The computer checks if each wall of a room is "blocked" before letting you place an exit there.

### A Wall Is Blocked If:

- The tile directly outside that wall is in the **dead border**.
- The tile directly outside that wall is **already occupied** by another room.

### Checking Logic:

- **Top wall:** Is there a dead zone or room at `(room_x, room_y - 1)`?
- **Bottom wall:** Is there a dead zone or room at `(room_x, room_y + height)`?
- **Left wall:** Is there a dead zone or room at `(room_x - 1, room_y)`?
- **Right wall:** Is there a dead zone or room at `(room_x + width, room_y)`?

If the answer is "yes" for any direction, that wall is blocked.

---

## Summary: The Step-by-Step Flow

1. **Pick a size** for your dungeon (e.g., 20×20).
2. The computer **adds 4** to make room for the border (now 24×24).
3. The outer **2 tiles on every side** become the dead border.
4. You **place the entrance** on the bottom inner edge.
5. You **roll 2d6** for your starting room size.
6. You **place the starting room** above the entrance.
7. You **roll for exits** and place them on available walls.
8. When the dungeon is "complete," you can click exits to **expand** with new rooms.
9. Repeat rolling and placing until your dungeon is done!

---

## Quick Reference: Key Numbers

| Rule                  | Value                |
| --------------------- | -------------------- |
| Dead border thickness | 2 tiles on each side |
| Map size padding      | +4 (2 on each side)  |
| Entrance row          | `height - 3`         |
| Minimum starting room | 6 tiles              |
| Maximum starting room | 12 tiles             |
| Exit size             | 1 tile               |
| Buffer around rooms   | 1 tile               |

---

## Glossary

- **Tile / Grid Cell:** One square on the map.
- **Dead Zone:** A tile where you cannot build anything.
- **Playable Area:** The inner part of the map where rooms can go.
- **Buffer:** Extra space around a room that becomes dead zone to prevent rooms from touching.
- **Exit:** A 1-tile corridor leading out of a room.
- **Entrance:** The single starting exit at the bottom of the map.
