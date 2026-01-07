export type DieValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type DiceRoll = [DieValue, DieValue]; // [Primary, Secondary]

export type ManeuverTier = 1 | 2 | 3 | 4;

export interface Maneuver {
  id: string;
  name: string;
  tier: ManeuverTier;
  dice: DiceRoll;
  damage: string; // e.g., "D8", "D8+2"
  effect?: string;
  description: string;
}

export type InterruptType = 'armor' | 'movement' | 'magic';

export interface Interrupt {
  trigger: string; // Description of the trigger condition (e.g., "Primary 3")
  effect: string;
  type: InterruptType;
}

export interface EnemyManeuver {
  name: string;
  dice: DiceRoll;
  damage: string;
  effect?: string;
}

export interface Creature {
  id: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  shift: number;
  maneuvers: EnemyManeuver[];
  interrupts: Interrupt[];
  mishap: string;
  prime: string;
  loot?: string;
  description: string;
}

export type TurnPhase = 'player-roll' | 'player-resolve' | 'enemy-roll' | 'enemy-resolve' | 'combat-over';

export interface PlayerArmor {
  id: string;
  name: string;
  triggers: string[]; // e.g., ["P5", "P4", "S2"] - triggers on enemy's dice
  effect: string;
  isDynamic?: boolean; // If true, uses player's secondary roll as the trigger value
}

export interface CombatState {
  isActive: boolean;
  round: number;
  turnPhase: TurnPhase;
  player: {
    hp: number;
    maxHp: number;
    shift: number;
    maxShift: number;
    equippedManeuvers: string[];
    armor: PlayerArmor[];
  };
  enemy: Creature | null;
  currentRoll: DiceRoll | null;  // Player's roll
  enemyRoll: DiceRoll | null;    // Enemy's roll
  log: CombatLogEntry[];
}

export interface CombatLogEntry {
  round: number;
  message: string;
  type: 'info' | 'player-action' | 'enemy-action' | 'damage' | 'effect';
}
