import { diceEngine } from '../../integrations/anvil-dice-app/engine/DiceEngine';
import { DiceRoll, Gambit, Creature, CombatState, DieValue, CombatLogEntry, EffectTiming, StatusEffect, EventDuration } from './types';
import gambitsData from './data/maneuvers.json';
import bestiaryData from './data/bestiary.json';
import { EffectManager } from './EffectManager';

// Simple check for uuid, can replace if library exists
const generateId = () => Math.random().toString(36).substr(2, 9);

export class CombatEngine {
  private state: CombatState;
  private listeners: ((state: CombatState) => void)[] = [];
  private effectManager: EffectManager;

  constructor() {
    this.state = this.getInitialState();
    this.effectManager = new EffectManager((msg, type) => this.log(msg, type));
  }

  private getInitialState(): CombatState {
    return {
      isActive: false,
      round: 0,
      turnPhase: 'initiative',
      player: {
        hp: 20,
        maxHp: 20,
        guide: 2,
        maxGuide: 2,
        initiative: 0,  // Player's initiative modifier
        initiativeRoll: null,
        equippedGambits: ['guard_strike', 'shield_bash', 'measured_thrust'],
        armor: [
          { 
            id: 'scale_jacket', 
            name: 'Scale Jacket', 
            triggers: [
              { die: 'primary', value: 5 },
              { die: 'primary', value: 4 },
              { die: 'secondary', value: 2 }
            ], 
            effect: { type: 'modifyDamage', value: -2 }
          },
          { 
            id: 'shield', 
            name: 'Shield', 
            triggers: [], 
            effect: { type: 'modifyDamage', value: -1 }, 
            isDynamic: true 
          },
        ],
        activeEffects: [],
      },
      // Multi-enemy support
      enemies: [],
      currentEnemyIndex: -1,
      selectedTargetIndex: 0,
      
      // Turn order
      turnOrder: [],
      currentTurnIndex: 0,
      
      // Legacy (single enemy - for backward compat)
      enemy: null,
      enemyActiveEffects: [],
      
      currentRoll: null,
      enemyRoll: null,
      log: [],
    };
  }

  public getState(): CombatState {
    return this.state;
  }

  public subscribe(listener: (state: CombatState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }

  private log(message: string, type: CombatLogEntry['type'] = 'info') {
    this.state.log.push({
      round: this.state.round,
      message,
      type,
    });
    this.notify();
  }
  // ============================================
  // EFFECT UTILITIES (delegated to EffectManager)
  // ============================================

  /**
   * Check if combatant has a specific effect type (for stun/skip checks)
   */
  public hasEffect(effectType: StatusEffect['action']['type'], forPlayer: boolean): boolean {
    const effects = forPlayer 
      ? this.state.player.activeEffects 
      : this.state.enemyActiveEffects;
    
    return this.effectManager.has(effectType, effects);
  }

  /**
   * Process effects at a combat phase and apply any HP/Guide changes
   */
  private processPhaseEffects(timing: EffectTiming, forPlayer: boolean): void {
    const effects = forPlayer 
      ? this.state.player.activeEffects 
      : this.state.enemyActiveEffects;
    
    const result = this.effectManager.process(timing, effects, {
      playerHp: this.state.player.hp,
      playerMaxHp: this.state.player.maxHp,
      playerGuide: this.state.player.guide,
      enemyHp: this.state.enemy?.hp,
      enemyMaxHp: this.state.enemy?.maxHp,
      enemyGuide: this.state.enemy?.guide,
      isPlayer: forPlayer
    });
    
    // Apply HP/Guide changes
    if (forPlayer) {
      this.state.player.hp = Math.min(this.state.player.maxHp, this.state.player.hp + result.hpChange);
      this.state.player.guide += result.guideChange;
    } else if (this.state.enemy) {
      this.state.enemy.hp = Math.min(this.state.enemy.maxHp, this.state.enemy.hp + result.hpChange);
      this.state.enemy.guide += result.guideChange;
    }
  }


  /**
   * Apply damage to selected enemy with effect processing
   */
  private applyDamageToEnemy(baseDamage: number): number {
    // Get selected target from enemies array
    const targetIndex = this.state.selectedTargetIndex;
    const targetEnemy = this.state.enemies[targetIndex];
    
    if (!targetEnemy || targetEnemy.currentHp <= 0) {
      // Fall back to legacy enemy for backward compat
      if (!this.state.enemy) return 0;
    }
    
    const enemy = targetEnemy?.creature || this.state.enemy;
    if (!enemy) return 0;
    
    const enemyEffects = targetEnemy?.activeEffects || this.state.enemyActiveEffects;
    
    // Process player's onDamage effects (modifiers to outgoing damage)
    const playerEffects = this.effectManager.process('onDamage', this.state.player.activeEffects, {
      playerHp: this.state.player.hp,
      playerMaxHp: this.state.player.maxHp,
      playerGuide: this.state.player.guide,
      isPlayer: true
    });
    
    // Process enemy's onTakeDamage effects (modifiers to incoming damage)
    const targetEffects = this.effectManager.process('onTakeDamage', enemyEffects, {
      playerHp: this.state.player.hp,
      playerMaxHp: this.state.player.maxHp,
      playerGuide: this.state.player.guide,
      enemyHp: targetEnemy?.currentHp || enemy.hp,
      enemyMaxHp: enemy.maxHp,
      enemyGuide: enemy.guide,
      isPlayer: false
    });
    
    // Check SELECTED enemy's ripostes (only selected enemy can riposte)
    const riposteModifier = this.state.currentRoll && enemy.ripostes
      ? this.effectManager.checkRiposteTriggers(enemy.ripostes, this.state.currentRoll)
      : 0;
    
    const totalModifier = playerEffects.modifier + targetEffects.modifier + riposteModifier;
    const finalDamage = Math.max(0, baseDamage + totalModifier);
    
    // Apply damage to selected enemy
    if (targetEnemy) {
      targetEnemy.currentHp -= finalDamage;
      this.log(`Dealt ${finalDamage} damage to ${enemy.name}.`, 'damage');
      
      // Remove event-based effects
      targetEnemy.activeEffects = this.effectManager.removeOnEvent('onTakeDamage', targetEnemy.activeEffects);
      
      // Check for enemy defeat
      if (targetEnemy.currentHp <= 0) {
        this.log(`${enemy.name} defeated!`, 'info');
        
        // Check if all enemies defeated
        const aliveEnemies = this.state.enemies.filter(e => e.currentHp > 0);
        if (aliveEnemies.length === 0) {
          this.state.isActive = false;
          this.state.turnPhase = 'combat-over';
          this.log('Victory!', 'info');
        }
      }
    } else {
      // Legacy path
      this.state.enemy!.hp -= finalDamage;
      this.log(`Dealt ${finalDamage} damage to ${enemy.name}.`, 'damage');
      
      if (this.state.enemy!.hp <= 0) {
        this.log(`${enemy.name} defeated!`, 'info');
        this.state.isActive = false;
        this.state.turnPhase = 'combat-over';
      }
    }
    
    // Remove player event-based effects
    this.state.player.activeEffects = this.effectManager.removeOnEvent('onDamage', this.state.player.activeEffects);
    
    this.notify();
    return finalDamage;
  }

  /**
   * Select an enemy to target (called when player clicks enemy portrait)
   */
  public selectTarget(enemyIndex: number) {
    if (enemyIndex < 0 || enemyIndex >= this.state.enemies.length) return;
    
    const enemy = this.state.enemies[enemyIndex];
    if (enemy.currentHp <= 0) {
      this.log(`${enemy.creature.name} is already defeated.`, 'info');
      return;
    }
    
    this.state.selectedTargetIndex = enemyIndex;
    this.log(`Targeting ${enemy.creature.name}`, 'info');
    this.notify();
  }

  /**
   * Get the currently selected target enemy
   */
  public getSelectedTarget(): import('./types').EnemyInstance | null {
    return this.state.enemies[this.state.selectedTargetIndex] || null;
  }

  /**
   * Apply damage to player with effect processing
   */
  private applyDamageToPlayer(baseDamage: number): number {
    // Process enemy's onDamage effects (modifiers to outgoing damage)
    const enemyEffects = this.effectManager.process('onDamage', this.state.enemyActiveEffects, {
      playerHp: this.state.player.hp,
      playerMaxHp: this.state.player.maxHp,
      playerGuide: this.state.player.guide,
      enemyHp: this.state.enemy?.hp,
      enemyMaxHp: this.state.enemy?.maxHp,
      enemyGuide: this.state.enemy?.guide,
      isPlayer: false
    });
    
    // Process player's onTakeDamage effects (modifiers to incoming damage)
    const playerEffects = this.effectManager.process('onTakeDamage', this.state.player.activeEffects, {
      playerHp: this.state.player.hp,
      playerMaxHp: this.state.player.maxHp,
      playerGuide: this.state.player.guide,
      isPlayer: true
    });
    
    // Check player armor (based on ENEMY's current roll)
    const armorModifier = this.state.enemyRoll
      ? this.effectManager.checkArmorTriggers(this.state.player.armor, this.state.enemyRoll, this.state.currentRoll)
      : 0;
    
    const totalModifier = enemyEffects.modifier + playerEffects.modifier + armorModifier;
    const finalDamage = Math.max(0, baseDamage + totalModifier);
    
    this.state.player.hp -= finalDamage;
    this.log(`You take ${finalDamage} damage.`, 'damage');
    
    // Remove event-based effects
    this.state.enemyActiveEffects = this.effectManager.removeOnEvent('onDamage', this.state.enemyActiveEffects);
    this.state.player.activeEffects = this.effectManager.removeOnEvent('onTakeDamage', this.state.player.activeEffects);
    
    return finalDamage;
  }

  /**
   * Apply a gambit's effect if it has one
   * sourceIsPlayer: true if the effect comes from the player, false if from enemy
   */
  private applyGambitEffect(effect: StatusEffect | string | undefined, sourceIsPlayer: boolean) {
    if (!effect) return;
    
    // Handle legacy string effects (just log them)
    if (typeof effect === 'string') {
      this.log(`Effect: ${effect}`, 'effect');
      return;
    }
    
    // Determine who receives the effect using effectManager
    const recipientIsPlayer = this.effectManager.resolveEffectTarget(effect, sourceIsPlayer);
    
    // Add effect to appropriate combatant
    const effects = recipientIsPlayer 
      ? this.state.player.activeEffects 
      : this.state.enemyActiveEffects;
    
    this.effectManager.add(effect, effects);
    this.notify();
  }

  /**
   * Start combat with one or more enemies
   */
  public startCombat(enemyIds: string | string[]) {
    const ids = Array.isArray(enemyIds) ? enemyIds : [enemyIds];
    
    // Create enemy instances
    const enemies: import('./types').EnemyInstance[] = [];
    
    for (let i = 0; i < ids.length; i++) {
      const enemyData = bestiaryData.find((c) => c.id === ids[i]);
      if (!enemyData) {
        console.error(`Enemy ${ids[i]} not found`);
        continue;
      }
      
      // Deep copy to avoid mutating static data
      const creature: Creature = JSON.parse(JSON.stringify(enemyData));
      
      enemies.push({
        creature,
        instanceId: `${creature.id}_${i}`,
        currentHp: creature.hp,
        activeEffects: [],
        initiativeRoll: null,
      });
    }
    
    if (enemies.length === 0) {
      console.error('No valid enemies for combat');
      return;
    }

    this.state = {
      ...this.getInitialState(),
      isActive: true,
      round: 1,
      turnPhase: 'initiative',
      enemies,
      selectedTargetIndex: 0,
      // Legacy support - set first enemy
      enemy: enemies[0].creature,
      enemyActiveEffects: enemies[0].activeEffects,
    };
    
    const enemyNames = enemies.map(e => e.creature.name).join(', ');
    this.log(`Combat started against ${enemyNames}!`, 'info');
    this.log('Roll Initiative!', 'info');
    this.notify();
  }

  /**
   * Roll initiative for player and all enemies, build turn order
   */
  public async rollInitiative() {
    if (this.state.turnPhase !== 'initiative') return;
    
    // Roll player initiative (1d8 + modifier) with 3D dice
    let playerInit = 0;
    try {
      const result = await diceEngine.roll('1d8');
      playerInit = result.total + this.state.player.initiative;
    } catch (e) {
      // Fallback
      playerInit = Math.floor(Math.random() * 8) + 1 + this.state.player.initiative;
    }
    
    this.state.player.initiativeRoll = playerInit;
    this.log(`You rolled Initiative: ${playerInit}`, 'player-action');
    
    // Roll enemy initiatives (silent - no 3D dice)
    for (let i = 0; i < this.state.enemies.length; i++) {
      const enemy = this.state.enemies[i];
      const roll = Math.floor(Math.random() * 8) + 1;
      const init = roll + enemy.creature.initiative;
      enemy.initiativeRoll = init;
      this.log(`${enemy.creature.name} Initiative: ${init}`, 'enemy-action');
    }
    
    // Build turn order
    // Player entry
    const turnOrder: import('./types').TurnOrderEntry[] = [
      {
        type: 'player',
        id: 'player',
        name: 'You',
        initiative: playerInit,
        orderIndex: 0,  // Player always first for tiebreaker
      }
    ];
    
    // Enemy entries
    for (let i = 0; i < this.state.enemies.length; i++) {
      const enemy = this.state.enemies[i];
      turnOrder.push({
        type: 'enemy',
        id: enemy.instanceId,
        name: enemy.creature.name,
        initiative: enemy.initiativeRoll || 0,
        orderIndex: i + 1,  // Left-to-right order for tiebreaker
      });
    }
    
    // Sort by initiative (descending), then by orderIndex (ascending for tiebreaker)
    turnOrder.sort((a, b) => {
      if (b.initiative !== a.initiative) {
        return b.initiative - a.initiative;
      }
      return a.orderIndex - b.orderIndex;  // Player (0) wins ties
    });
    
    this.state.turnOrder = turnOrder;
    this.state.currentTurnIndex = 0;
    
    // Log turn order
    const orderStr = turnOrder.map((t, i) => `${i + 1}. ${t.name} (${t.initiative})`).join(', ');
    this.log(`Turn Order: ${orderStr}`, 'info');
    
    // Start first turn
    this.advanceToNextTurn();
  }

  /**
   * Advance to the next combatant's turn
   */
  private advanceToNextTurn() {
    const currentEntry = this.state.turnOrder[this.state.currentTurnIndex];
    
    if (!currentEntry) {
      // End of turn order, new round
      this.nextRound();
      return;
    }
    
    if (currentEntry.type === 'player') {
      this.state.currentEnemyIndex = -1;
      this.state.turnPhase = 'player-roll';
      this.log(`Your turn!`, 'info');
    } else {
      // Find enemy index
      const enemyIndex = this.state.enemies.findIndex(e => e.instanceId === currentEntry.id);
      if (enemyIndex < 0) {
        // Enemy dead or not found, skip
        this.state.currentTurnIndex++;
        this.advanceToNextTurn();
        return;
      }
      
      this.state.currentEnemyIndex = enemyIndex;
      // Update legacy enemy reference
      this.state.enemy = this.state.enemies[enemyIndex].creature;
      this.state.enemyActiveEffects = this.state.enemies[enemyIndex].activeEffects;
      
      this.state.turnPhase = 'enemy-roll';
      this.log(`${currentEntry.name}'s turn!`, 'enemy-action');
    }
    
    this.notify();
  }

  public async rollDice() {
    if (!this.state.isActive) return;

    this.log('Rolling D88...', 'info');

    // Roll 1d8 for Primary (Red) and 1d8 for Secondary (Blue)
    // We treat index 0 as Primary, index 1 as Secondary
    try {
      // Roll 2d8 as a single request - dice engine will use primary color for first, secondary for second
      const result = await diceEngine.roll('2d8');

      // Assuming breakdown order matches request order
      // We need to parse valid breakdown. If using '1d8', we expect one die result per request.
      // NOTE: Integration details with Anvil Dice Engine might vary.
      // For now, we assume result.dice exists or we parse breakdown.
      
      let primary = 1;
      let secondary = 1;
      
      if (result.dice && result.dice.length >= 2) {
         primary = result.dice[0].value;
         secondary = result.dice[1].value;
      } else if (result.breakdown && result.breakdown.length >= 2) {
         // Fallback if breakdown is simple
         primary = result.breakdown[0].value;
         secondary = result.breakdown[1].value;
      } else {
        // Fallback for simulation if engine fails
         primary = Math.floor(Math.random() * 8) + 1;
         secondary = Math.floor(Math.random() * 8) + 1;
         console.warn('Dice engine returned unexpected format, using fallback values.');
      }

      this.state.currentRoll = [primary as DieValue, secondary as DieValue];
      this.state.turnPhase = 'player-resolve';
      this.log(`Rolled [${primary}, ${secondary}]`, 'player-action');

      // Process onRoll effects
      this.processPhaseEffects('onRoll', true);

      this.checkLockedZones();
      this.notify();

    } catch (error) {
      console.error('Dice roll failed:', error);
      // Fallback
       const p = Math.floor(Math.random() * 8) + 1;
       const s = Math.floor(Math.random() * 8) + 1;
       this.state.currentRoll = [p as DieValue, s as DieValue];
       this.state.turnPhase = 'player-resolve';
       this.log(`Rolled [${p}, ${s}] (Fallback)`, 'player-action');
       
       // Process onRoll effects
       this.processPhaseEffects('onRoll', true);
       
       this.notify();
    }
  }

  private checkLockedZones() {
    if (!this.state.currentRoll) return;
    const [p, s] = this.state.currentRoll;

    if ((p === 1 && s === 1) || (p === 1 && s === 2) || (p === 2 && s === 1)) {
        this.log('NADIR! The dice are locked against you.', 'effect');
        // Handle Nadir automatically? Or let user confirm?
    } else if ((p === 8 && s === 8) || (p === 7 && s === 8) || (p === 8 && s === 7)) {
        this.log('APEX! A moment of perfection.', 'effect');
    }
  }

  public canGuide(): boolean {
      if (!this.state.currentRoll) return false;
      const [p, s] = this.state.currentRoll;
      
      // Locked Zones
      if ((p === 1 && s === 1) || (p === 1 && s === 2) || (p === 2 && s === 1)) return false; // Nadir
      if ((p === 8 && s === 8) || (p === 7 && s === 8) || (p === 8 && s === 7)) return false; // Apex
      
      return this.state.player.guide > 0;
  }

  public guideDie(die: 'primary' | 'secondary', direction: 'up' | 'down') {
      if (!this.canGuide() || !this.state.currentRoll) return;
      
      const index = die === 'primary' ? 0 : 1;
      const currentVal = this.state.currentRoll[index];
      
      if (direction === 'up' && currentVal === 8) return; // No wrap
      if (direction === 'down' && currentVal === 1) return; // No wrap

      const newVal = direction === 'up' ? currentVal + 1 : currentVal - 1;
      
      // Update state
      const newRoll = [...this.state.currentRoll] as DiceRoll;
      newRoll[index] = newVal as DieValue;
      
      // Check if we entered a locked zone (Forbidden)
      // "Cannot guide INTO Nadir or Apex zones"
      const [np, ns] = newRoll;
      if ((np === 1 && ns === 1) || (np === 1 && ns === 2) || (np === 2 && ns === 1)) {
          this.log('Cannot guide into Nadir zone!', 'info');
          return;
      }
      if ((np === 8 && ns === 8) || (np === 7 && ns === 8) || (np === 8 && ns === 7)) {
          this.log('Cannot guide into Apex zone!', 'info');
          return;
      }

      this.state.currentRoll = newRoll;
      this.state.player.guide -= 1;
      this.log(`Guided ${die} ${direction} to ${newVal}. Remaining Guide: ${this.state.player.guide}`, 'player-action');
      this.notify();
  }

  public getAvailableGambits(): Gambit[] {
      if (!this.state.currentRoll) return [];
      const [p, s] = this.state.currentRoll;
      
      // Filter gambits that match current dice
      const equipped = gambitsData.filter(m => this.state.player.equippedGambits.includes(m.id)) as unknown as Gambit[];
      
      return equipped.filter(m => m.dice[0] === p && m.dice[1] === s);
  }
  
  public getAllEquippedGambits(): Gambit[] {
      return gambitsData.filter(m => this.state.player.equippedGambits.includes(m.id)) as unknown as Gambit[];
  }

  public async executeGambit(gambitId: string) {
      if (!this.state.currentRoll || !this.state.enemy) return;
      
      const gambit = gambitsData.find(m => m.id === gambitId);
      if (!gambit) return;

      // Check for true strike (dice match without guiding)
      const [p, s] = this.state.currentRoll;
      const [mp, ms] = gambit.dice;
      const isTrueStrike = (p === mp && s === ms);

      this.log(`Executed ${gambit.name}!${isTrueStrike ? ' TRUE STRIKE!' : ''}`, 'player-action');
      
      // Parse damage notation - already in "1d6+2" format
      let dieNotation = gambit.damage.toLowerCase();
      
      // Roll damage with 3D dice (uses player's primary color from settings)
      let baseDamage = 0;
      try {
        const result = await diceEngine.roll(dieNotation);
        baseDamage = result.total;
      } catch (e) {
        // Fallback - parse manually
        let fallbackDamage = 0;
        if (gambit.damage.includes('d8')) {
            fallbackDamage = Math.floor(Math.random() * 8) + 1;
        } else if (gambit.damage.includes('d6')) {
            fallbackDamage = Math.floor(Math.random() * 6) + 1;
        }
        if (gambit.damage.includes('+')) {
            fallbackDamage += parseInt(gambit.damage.split('+')[1]);
        }
        if (gambit.damage.includes('-')) {
            fallbackDamage -= parseInt(gambit.damage.split('-')[1]);
        }
        baseDamage = fallbackDamage;
      }
      
      // True Strike Bonus: add guide value to damage
      if (isTrueStrike) {
          baseDamage += this.state.player.maxGuide;
          this.log(`+${this.state.player.maxGuide} True Strike bonus!`, 'effect');
      }
      
      // Process onHit effects before damage
      this.processPhaseEffects('onHit', true);
      
      this.applyDamageToEnemy(baseDamage);
      
      // Apply gambit effect
      if (gambit.effect) {
          this.applyGambitEffect(gambit.effect, true);  // Source is player
      }

      this.endTurn();
  }

  public passTurn() {
      if (!this.state.isActive) return;
      if (this.state.turnPhase !== 'player-resolve') return;
      this.log('Player passes the turn (Miss).', 'player-action');
      
      // Process onMiss effects
      this.processPhaseEffects('onMiss', true);
      
      this.endTurn();
  }



  public endTurn() {
      if (!this.state.isActive) return;
      
      // After player resolves, advance to next combatant in turn order
      if (this.state.turnPhase === 'player-resolve') {
          // Process turnEnd effects
          this.processPhaseEffects('turnEnd', true);
          
          // Keep currentRoll valid for defensive triggers (Shield) during enemy turns
          // Advance to next turn
          this.state.currentTurnIndex++;
          this.advanceToNextTurn();
      }
  }

  // Public method to roll enemy dice (called from UI)
  public rollEnemyDicePublic() {
    if (this.state.turnPhase === 'enemy-roll') {
      this.rollEnemyDice();
    }
  }

  private async rollEnemyDice() {
      if (!this.state.enemy) return;
      
      this.log('Enemy rolling D88...', 'info');
      
      try {
        // Roll 2d8 with enemy-specific theme colors
        const result = await diceEngine.roll([
          { 
            notation: '2d8', 
            theme: {
              diceColor: '#8b2323',           // Dark crimson (enemy primary)
              labelColor: '#ffffff',
              outlineColor: '#000000',
              diceColorSecondary: '#cc5500',  // Burnt orange (enemy secondary)
              labelColorSecondary: '#ffffff',
              outlineColorSecondary: '#000000'
            }
          }
        ]);
        
        let primary = 1 as DieValue;
        let secondary = 1 as DieValue;
        
        if (result.dice && result.dice.length >= 2) {
          primary = result.dice[0].value as DieValue;
          secondary = result.dice[1].value as DieValue;
        } else if (result.breakdown.length >= 2) {
          primary = result.breakdown[0].value as DieValue;
          secondary = result.breakdown[1].value as DieValue;
        }
        
        this.state.enemyRoll = [primary, secondary] as DiceRoll;
        this.state.turnPhase = 'enemy-resolve';
        this.log(`${this.state.enemy.name} rolled [${primary}, ${secondary}]`, 'enemy-action');
        
        // Process enemy onRoll effects
        this.processPhaseEffects('onRoll', false);
        
        this.notify();
      } catch (e) {
        console.error('Enemy dice roll failed:', e);
        // Fallback to simulated roll
        const primary = (Math.floor(Math.random() * 8) + 1) as DieValue;
        const secondary = (Math.floor(Math.random() * 8) + 1) as DieValue;
        
        this.state.enemyRoll = [primary, secondary];
        this.state.turnPhase = 'enemy-resolve';
        this.log(`${this.state.enemy.name} rolled [${primary}, ${secondary}]`, 'enemy-action');
        
        // Process enemy onRoll effects
        this.processPhaseEffects('onRoll', false);
        
        this.notify();
      }
  }

  public getAvailableEnemyGambits() {
      if (!this.state.enemyRoll || !this.state.enemy) return [];
      const [p, s] = this.state.enemyRoll;
      const guide = this.state.enemy.guide;
      
      return this.state.enemy.gambits.filter(m => {
          const [tp, ts] = m.dice;
          if (p === tp && s === ts) return true;
          const distance = Math.abs(p - tp) + Math.abs(s - ts);
          return distance <= guide;
      });
  }

  public async resolveEnemyGambit(index: number) {
      if (!this.state.enemy || this.state.turnPhase !== 'enemy-resolve' || !this.state.enemyRoll) return;
      
      const gambit = this.state.enemy.gambits[index];
      if (!gambit) {
          this.enemyMiss();
          return;
      }
      
      // Check for true strike
      const [p, s] = this.state.enemyRoll;
      const [mp, ms] = gambit.dice;
      const isTrueStrike = (p === mp && s === ms);
      
      this.log(`${this.state.enemy.name} uses ${gambit.name}!${isTrueStrike ? ' TRUE STRIKE!' : ''}`, 'enemy-action');
      
      // Parse damage notation - already in "1d6-1" format
      let dieNotation = gambit.damage.toLowerCase();
      
      // Roll damage with 3D dice (enemy primary color)
      let damage = 0;
      try {
        const result = await diceEngine.roll([{
          notation: dieNotation,
          theme: {
            diceColor: '#8b2323',  // Enemy primary color
            labelColor: '#ffffff',
            outlineColor: '#000000'
          }
        }]);
        damage = result.total;
      } catch (e) {
        // Fallback
        let baseDamage = 0;
        if (gambit.damage.includes('d8')) {
            baseDamage = Math.floor(Math.random() * 8) + 1;
        } else if (gambit.damage.includes('d6')) {
            baseDamage = Math.floor(Math.random() * 6) + 1;
        }
        if (gambit.damage.includes('+')) {
            baseDamage += parseInt(gambit.damage.split('+')[1]);
        }
        if (gambit.damage.includes('-')) {
            baseDamage -= parseInt(gambit.damage.split('-')[1]);
        }
        damage = baseDamage;
      }
      
      // True Strike Bonus: add enemy guide to damage
      if (isTrueStrike) {
          damage += this.state.enemy.guide;
          this.log(`+${this.state.enemy.guide} True Strike bonus!`, 'effect');
      }
      
      damage = Math.max(0, damage);
      
      // Process enemy onHit effects before damage
      this.processPhaseEffects('onHit', false);
      
      this.applyDamageToPlayer(damage);
      
      // Apply gambit effect
      if (gambit.effect) {
          this.applyGambitEffect(gambit.effect, false);  // Source is enemy
      }
      
      // Process enemy turnEnd effects
      this.processPhaseEffects('turnEnd', false);
      
      // Advance to next combatant in turn order
      this.state.currentTurnIndex++;
      this.advanceToNextTurn();
  }

  public enemyMiss() {
      if (this.state.turnPhase !== 'enemy-resolve') return;
      this.log(`${this.state.enemy?.name} missed!`, 'enemy-action');
      
      // Process enemy onMiss and turnEnd effects
      this.processPhaseEffects('onMiss', false);
      this.processPhaseEffects('turnEnd', false);
      
      // Advance to next combatant in turn order
      this.state.currentTurnIndex++;
      this.advanceToNextTurn();
  }

  private nextRound() {
      if (this.state.player.hp <= 0) {
          this.log('You have been defeated!', 'info');
          this.state.isActive = false;
          this.state.turnPhase = 'combat-over';
          this.notify();
          return;
      }
      
      // Round end: decrement durations using effectManager
      this.state.player.activeEffects = this.effectManager.tick(this.state.player.activeEffects);
      this.state.enemyActiveEffects = this.effectManager.tick(this.state.enemyActiveEffects);
      
      // Reset for next round
      this.state.round++;
      
      // Guide bonus at rounds 4, 5, 6
      if (this.state.round >= 4 && this.state.round <= 6) {
          this.state.player.maxGuide++;
          if (this.state.enemy) {
              this.state.enemy.guide++;
          }
          this.log(`Round ${this.state.round}: Combat intensifies! +1 Guide to all.`, 'effect');
      } else {
          this.log(`Round ${this.state.round}`, 'info');
      }
      
      // Round start: process roundStart effects for both sides using effectManager
      const playerRoundStart = this.effectManager.process('roundStart', this.state.player.activeEffects, {
          playerHp: this.state.player.hp,
          playerMaxHp: this.state.player.maxHp,
          playerGuide: this.state.player.guide,
          isPlayer: true
      });
      this.state.player.hp += playerRoundStart.hpChange;
      this.state.player.guide += playerRoundStart.guideChange;
      
      const enemyRoundStart = this.effectManager.process('roundStart', this.state.enemyActiveEffects, {
          playerHp: this.state.player.hp,
          playerMaxHp: this.state.player.maxHp,
          playerGuide: this.state.player.guide,
          enemyHp: this.state.enemy?.hp,
          enemyMaxHp: this.state.enemy?.maxHp,
          enemyGuide: this.state.enemy?.guide,
          isPlayer: false
      });
      if (this.state.enemy) {
          this.state.enemy.hp += enemyRoundStart.hpChange;
          this.state.enemy.guide += enemyRoundStart.guideChange;
      }
      
      this.state.player.guide = this.state.player.maxGuide;
      this.state.currentRoll = null;
      this.state.enemyRoll = null;
      this.state.turnPhase = 'player-roll';
      this.notify();
  }
}

export const combatEngine = new CombatEngine();
