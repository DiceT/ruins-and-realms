import { 
  StatusEffect, 
  EffectTiming, 
  EffectAction, 
  TriggerCondition,
  Armor,
  Riposte,
  DiceRoll
} from './types';

/**
 * EffectManager - Centralized service for status effect handling
 * 
 * Responsible for:
 * - Adding/removing effects
 * - Processing effects at each combat phase
 * - Evaluating trigger conditions
 * - Managing effect durations
 */
export class EffectManager {
  private logCallback: (message: string, type: 'effect' | 'damage') => void;

  constructor(logCallback: (message: string, type: 'effect' | 'damage') => void) {
    this.logCallback = logCallback;
  }

  private log(message: string, type: 'effect' | 'damage' = 'effect') {
    this.logCallback(message, type);
  }

  // ============================================
  // EFFECT MANAGEMENT
  // ============================================

  /**
   * Add an effect to a combatant's effect list
   */
  add(effect: StatusEffect, effects: StatusEffect[]): void {
    // Check for stacking
    if (!effect.stacks) {
      const existingIndex = effects.findIndex(e => e.id === effect.id);
      if (existingIndex >= 0) {
        // Refresh duration instead of stacking
        effects[existingIndex] = { ...effect };
        return;
      }
    }
    
    effects.push({ ...effect });
    this.log(`${effect.name} applied!`);
  }

  /**
   * Remove an effect by ID
   */
  remove(effectId: string, effects: StatusEffect[]): void {
    const index = effects.findIndex(e => e.id === effectId);
    if (index >= 0) {
      const removed = effects.splice(index, 1)[0];
      this.log(`${removed.name} removed.`);
    }
  }

  /**
   * Process all effects for a given timing phase
   * Returns a damage modifier (for onDamage/onTakeDamage)
   */
  process(
    timing: EffectTiming, 
    effects: StatusEffect[], 
    context: {
      playerHp: number;
      playerMaxHp: number;
      playerGuide: number;
      enemyHp?: number;
      enemyMaxHp?: number;
      enemyGuide?: number;
      isPlayer: boolean;
    }
  ): { modifier: number; hpChange: number; guideChange: number } {
    let modifier = 0;
    let hpChange = 0;
    let guideChange = 0;
    
    for (const effect of effects) {
      if (effect.timing !== timing) continue;
      
      // Apply the effect
      const result = this.applyEffect(effect, context);
      modifier += result.modifier;
      hpChange += result.hpChange;
      guideChange += result.guideChange;
      
      // Log activation
      this.log(`${effect.name} activates!`);
    }
    
    return { modifier, hpChange, guideChange };
  }

  /**
   * Apply a single effect and return results
   */
  private applyEffect(
    effect: StatusEffect, 
    context: { isPlayer: boolean }
  ): { modifier: number; hpChange: number; guideChange: number } {
    const action = effect.action;
    
    switch (action.type) {
      case 'modifyDamage':
        return { modifier: action.value || 0, hpChange: 0, guideChange: 0 };
        
      case 'modifyGuide':
        return { modifier: 0, hpChange: 0, guideChange: action.value || 0 };
        
      case 'heal':
        const healAmount = action.value || 0;
        this.log(`Healed for ${healAmount}!`);
        return { modifier: 0, hpChange: healAmount, guideChange: 0 };
        
      case 'dot':
        const dotDamage = action.value || 0;
        this.log(`${effect.name} deals ${dotDamage} damage!`, 'damage');
        return { modifier: 0, hpChange: -dotDamage, guideChange: 0 };
        
      case 'stun':
      case 'skip':
        // These are handled by checking hasEffect in turn logic
        return { modifier: 0, hpChange: 0, guideChange: 0 };
        
      default:
        return { modifier: 0, hpChange: 0, guideChange: 0 };
    }
  }

  /**
   * Decrement durations and remove expired effects
   */
  tick(effects: StatusEffect[]): StatusEffect[] {
    return effects.filter(effect => {
      if (typeof effect.duration === 'number') {
        effect.duration--;
        if (effect.duration <= 0) {
          this.log(`${effect.name} fades.`);
          return false;
        }
      }
      // EventDuration effects persist until triggered
      return true;
    });
  }

  /**
   * Remove effects that end on a specific event (for "until X" effects)
   */
  removeOnEvent(event: EffectTiming, effects: StatusEffect[]): StatusEffect[] {
    return effects.filter(effect => {
      if (typeof effect.duration === 'object' && effect.duration.type === 'untilEvent') {
        if (effect.duration.event === event) {
          this.log(`${effect.name} ends.`);
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Check if any effect of a specific type exists
   */
  has(type: EffectAction['type'], effects: StatusEffect[]): boolean {
    return effects.some(e => e.action.type === type);
  }

  /**
   * Clear all effects
   */
  clear(effects: StatusEffect[]): void {
    effects.length = 0;
  }

  // ============================================
  // TRIGGER EVALUATION
  // ============================================

  /**
   * Check if a trigger condition is met by a dice roll
   */
  isTriggerActive(
    trigger: TriggerCondition, 
    roll: DiceRoll
  ): boolean {
    const comparison = trigger.comparison || '=';
    const targetVal = trigger.value;
    
    const dieValue = trigger.die === 'primary' ? roll[0] 
      : trigger.die === 'secondary' ? roll[1] 
      : Math.max(roll[0], roll[1]);  // 'either' uses max
    
    switch (comparison) {
      case '=': return dieValue === targetVal;
      case '<': return dieValue < targetVal;
      case '>': return dieValue > targetVal;
      case '<=': return dieValue <= targetVal;
      case '>=': return dieValue >= targetVal;
      default: return dieValue === targetVal;
    }
  }

  /**
   * Check armor triggers against enemy's roll and return damage modifier
   */
  checkArmorTriggers(
    armor: Armor[], 
    enemyRoll: DiceRoll, 
    playerRoll?: DiceRoll | null
  ): number {
    let modifier = 0;
    
    for (const piece of armor) {
      let isActive = false;
      
      if (piece.isDynamic && playerRoll) {
        // Dynamic armor (Shield): uses player's secondary as trigger value
        const dynamicTrigger: TriggerCondition = { 
          die: 'primary', 
          value: playerRoll[1] 
        };
        isActive = this.isTriggerActive(dynamicTrigger, enemyRoll);
      } else {
        // Static armor: check each trigger
        for (const trigger of piece.triggers) {
          if (this.isTriggerActive(trigger, enemyRoll)) {
            isActive = true;
            break;
          }
        }
      }
      
      if (isActive && piece.effect.type === 'modifyDamage' && piece.effect.value) {
        modifier += piece.effect.value;
        this.log(`${piece.name} activates! ${piece.effect.value > 0 ? '+' : ''}${piece.effect.value} damage`);
      }
    }
    
    return modifier;
  }

  /**
   * Check riposte triggers against attacker's roll and return damage modifier
   */
  checkRiposteTriggers(
    ripostes: Riposte[], 
    attackerRoll: DiceRoll
  ): number {
    let modifier = 0;
    
    for (const riposte of ripostes) {
      if (this.isTriggerActive(riposte.trigger, attackerRoll)) {
        if (riposte.effect.type === 'modifyDamage' && riposte.effect.value) {
          modifier += riposte.effect.value;
          this.log(`${riposte.name} activates! ${riposte.effect.value > 0 ? '+' : ''}${riposte.effect.value} damage`);
        }
      }
    }
    
    return modifier;
  }

  // ============================================
  // GAMBIT EFFECT ROUTING
  // ============================================

  /**
   * Determine which combatant receives a gambit effect
   * Returns true if player should receive, false if enemy
   */
  resolveEffectTarget(effect: StatusEffect, sourceIsPlayer: boolean): boolean {
    if (effect.target === 'self') {
      return sourceIsPlayer;
    } else {
      // target is opponent
      return !sourceIsPlayer;
    }
  }
}

// Singleton instance (optional - can also instantiate per combat)
let instance: EffectManager | null = null;

export function getEffectManager(logCallback: (message: string, type: 'effect' | 'damage') => void): EffectManager {
  if (!instance) {
    instance = new EffectManager(logCallback);
  }
  return instance;
}

export function resetEffectManager(): void {
  instance = null;
}
