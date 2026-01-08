export type DieValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type DiceRoll = [DieValue, DieValue]; // [Primary, Secondary]

export type GambitTier = 1 | 2 | 3 | 4;

// ============================================
// STATUS EFFECT SYSTEM
// ============================================

export type EffectTiming = 
  | 'roundStart' | 'roundEnd'
  | 'turnStart' | 'turnEnd'
  | 'onRoll' | 'onHit' | 'onMiss'
  | 'onDamage' | 'onTakeDamage';

export type EffectActionType = 
  | 'modifyDamage' 
  | 'modifyGuide' 
  | 'heal' 
  | 'dot' 
  | 'stun' 
  | 'skip';

export interface TriggerCondition {
  die: 'primary' | 'secondary' | 'either';
  value: number;
  comparison?: '=' | '<' | '>' | '<=' | '>=';  // default '='
}

export interface EventDuration {
  type: 'untilEvent';
  event: EffectTiming;
}

export interface EffectAction {
  type: EffectActionType;
  value?: number;
}

export interface StatusEffect {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  timing: EffectTiming;
  target: 'self' | 'opponent';
  duration: number | EventDuration;  // Turns or until event
  stacks: boolean;
  action: EffectAction;
  condition?: TriggerCondition;
}

// Effect icon mapping
export const EFFECT_ICONS: Record<EffectActionType, string> = {
  modifyDamage: '🛡️',
  modifyGuide: '🎯',
  heal: '💚',
  dot: '🩸',
  stun: '💫',
  skip: '⏭️'
};

// ============================================
// GAMBITS
// ============================================

export interface Gambit {
  id: string;
  name: string;
  tier: GambitTier;
  dice: DiceRoll;
  damage: string;
  effect?: string | StatusEffect;  // String (legacy) or structured
  description: string;
}

export interface EnemyGambit {
  name: string;
  dice: DiceRoll;
  damage: string;
  effect?: StatusEffect;
}

// ============================================
// ARMOR & RIPOSTES
// ============================================

export interface Armor {
  id: string;
  name: string;
  triggers: TriggerCondition[];
  effect: EffectAction;
  isDynamic?: boolean;
}

export interface Riposte {
  id: string;
  name: string;
  trigger: TriggerCondition;
  effect: EffectAction;
}

// ============================================
// APEX & NADIR (Named Special Abilities)
// ============================================

export interface ApexAbility {
  name: string;
  damage: string;
  effect?: string;  // Text description for now
}

export interface NadirAbility {
  name: string;
  effect: StatusEffect;
}

// ============================================
// CREATURE
// ============================================

export interface Creature {
  id: string;
  name: string;
  portrait?: string;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  guide: number;
  initiative: number;  // Modifier for 1d8 + initiative roll
  gambits: EnemyGambit[];
  armor?: Armor[];
  ripostes?: Riposte[];
  apex: ApexAbility;
  nadir: NadirAbility;
  loot?: string;
  description: string;
}

// ============================================
// COMBAT STATE
// ============================================

export type TurnPhase = 
  | 'initiative'       // Roll initiative phase
  | 'player-roll' 
  | 'player-resolve' 
  | 'enemy-roll' 
  | 'enemy-resolve' 
  | 'combat-over';

// Combatant in turn order (player or enemy)
export interface TurnOrderEntry {
  type: 'player' | 'enemy';
  id: string;           // 'player' or creature id
  name: string;
  initiative: number;   // Rolled value (1d8 + modifier)
  orderIndex: number;   // Position in original list (for tiebreakers)
}

// Enemy instance in combat (creature + runtime state)
export interface EnemyInstance {
  creature: Creature;
  instanceId: string;   // Unique ID for this instance
  currentHp: number;
  activeEffects: StatusEffect[];
  initiativeRoll: number | null;  // Displayed on portrait
}

export interface CombatState {
  isActive: boolean;
  round: number;
  turnPhase: TurnPhase;
  
  // Player state
  player: {
    hp: number;
    maxHp: number;
    guide: number;
    maxGuide: number;
    initiative: number;        // Player's initiative modifier
    initiativeRoll: number | null;  // Player's rolled initiative
    equippedGambits: string[];
    armor: Armor[];
    ripostes?: Riposte[];
    activeEffects: StatusEffect[];
  };
  
  // Multi-enemy support
  enemies: EnemyInstance[];
  currentEnemyIndex: number;   // Index of enemy whose turn it is (-1 for player)
  selectedTargetIndex: number; // Index of enemy player is targeting
  
  // Turn order
  turnOrder: TurnOrderEntry[];
  currentTurnIndex: number;    // Index in turnOrder array
  
  // Dice state
  currentRoll: DiceRoll | null;
  enemyRoll: DiceRoll | null;
  
  // Combat log
  log: CombatLogEntry[];
  
  // Legacy support (single enemy - deprecated)
  enemy: Creature | null;
  enemyActiveEffects: StatusEffect[];
}

export interface CombatLogEntry {
  round: number;
  message: string;
  type: 'info' | 'player-action' | 'enemy-action' | 'damage' | 'effect';
}

