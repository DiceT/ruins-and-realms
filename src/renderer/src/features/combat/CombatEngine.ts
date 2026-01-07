import { diceEngine } from '../../integrations/anvil-dice-app/engine/DiceEngine';
import { DiceRoll, Maneuver, Creature, CombatState, DieValue, CombatLogEntry } from './types';
import maneuversData from './data/maneuvers.json';
import bestiaryData from './data/bestiary.json';

// Simple check for uuid, can replace if library exists
const generateId = () => Math.random().toString(36).substr(2, 9);

export class CombatEngine {
  private state: CombatState;
  private listeners: ((state: CombatState) => void)[] = [];

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): CombatState {
    return {
      isActive: false,
      round: 0,
      turnPhase: 'player-roll',
      player: {
        hp: 20,
        maxHp: 20,
        shift: 2,
        maxShift: 2,
        equippedManeuvers: ['guard_strike', 'shield_bash', 'measured_thrust'],
        armor: [
          { id: 'scale_jacket', name: 'Scale Jacket', triggers: ['P5', 'P4', 'S2'], effect: 'Block 2' },
          { id: 'shield', name: 'Shield', triggers: [], effect: 'Block 1', isDynamic: true },
        ],
      },
      enemy: null,
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

  public startCombat(enemyId: string) {
    const enemyData = bestiaryData.find((c) => c.id === enemyId);
    if (!enemyData) {
      console.error(`Enemy ${enemyId} not found`);
      return;
    }

    // Deep copy to avoid mutating static data
    const enemy: Creature = JSON.parse(JSON.stringify(enemyData));

    this.state = {
      ...this.getInitialState(),
      isActive: true,
      round: 1,
      turnPhase: 'player-roll',
      enemy,
      currentRoll: null,
      enemyRoll: null,
    };
    
    this.log(`Combat started against ${enemy.name}!`, 'info');
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
       this.notify();
    }
  }

  private checkLockedZones() {
    if (!this.state.currentRoll) return;
    const [p, s] = this.state.currentRoll;

    if ((p === 1 && s === 1) || (p === 1 && s === 2) || (p === 2 && s === 1)) {
        this.log('FUMBLE! The dice are locked against you.', 'effect');
        // Handle Mishap automatically? Or let user confirm?
    } else if ((p === 8 && s === 8) || (p === 7 && s === 8) || (p === 8 && s === 7)) {
        this.log('PRIME! A moment of perfection.', 'effect');
    }
  }

  public canShift(): boolean {
      if (!this.state.currentRoll) return false;
      const [p, s] = this.state.currentRoll;
      
      // Locked Zones
      if ((p === 1 && s === 1) || (p === 1 && s === 2) || (p === 2 && s === 1)) return false; // Fumble
      if ((p === 8 && s === 8) || (p === 7 && s === 8) || (p === 8 && s === 7)) return false; // Prime
      
      return this.state.player.shift > 0;
  }

  public shiftDie(die: 'primary' | 'secondary', direction: 'up' | 'down') {
      if (!this.canShift() || !this.state.currentRoll) return;
      
      const index = die === 'primary' ? 0 : 1;
      const currentVal = this.state.currentRoll[index];
      
      if (direction === 'up' && currentVal === 8) return; // No wrap
      if (direction === 'down' && currentVal === 1) return; // No wrap

      const newVal = direction === 'up' ? currentVal + 1 : currentVal - 1;
      
      // Update state
      const newRoll = [...this.state.currentRoll] as DiceRoll;
      newRoll[index] = newVal as DieValue;
      
      // Check if we entered a locked zone (Forbidden)
      // "Cannot shift INTO Fumble or Prime zones"
      const [np, ns] = newRoll;
      if ((np === 1 && ns === 1) || (np === 1 && ns === 2) || (np === 2 && ns === 1)) {
          this.log('Cannot shift into Fumble zone!', 'info');
          return;
      }
      if ((np === 8 && ns === 8) || (np === 7 && ns === 8) || (np === 8 && ns === 7)) {
          this.log('Cannot shift into Prime zone!', 'info');
          return;
      }

      this.state.currentRoll = newRoll;
      this.state.player.shift -= 1;
      this.log(`Shifted ${die} ${direction} to ${newVal}. Remaining Shift: ${this.state.player.shift}`, 'player-action');
      this.notify();
  }

  public getAvailableManeuvers(): Maneuver[] {
      if (!this.state.currentRoll) return [];
      const [p, s] = this.state.currentRoll;
      
      // Filter maneuvers that match current dice
      const equipped = maneuversData.filter(m => this.state.player.equippedManeuvers.includes(m.id)) as unknown as Maneuver[];
      
      return equipped.filter(m => m.dice[0] === p && m.dice[1] === s);
  }
  
  public getAllEquippedManeuvers(): Maneuver[] {
      return maneuversData.filter(m => this.state.player.equippedManeuvers.includes(m.id)) as unknown as Maneuver[];
  }

  public async executeManeuver(maneuverId: string) {
      if (!this.state.currentRoll || !this.state.enemy) return;
      
      const maneuver = maneuversData.find(m => m.id === maneuverId);
      if (!maneuver) return;

      // Check for exact strike (dice match without shifting)
      const [p, s] = this.state.currentRoll;
      const [mp, ms] = maneuver.dice;
      const isExactStrike = (p === mp && s === ms);

      this.log(`Executed ${maneuver.name}!${isExactStrike ? ' EXACT STRIKE!' : ''}`, 'player-action');
      
      // Parse damage notation - convert "D8+2" to "1d8+2" format
      let dieNotation = maneuver.damage.toLowerCase().replace(/^d/, '1d');
      
      // Roll damage with 3D dice (uses player's primary color from settings)
      let baseDamage = 0;
      try {
        const result = await diceEngine.roll(dieNotation);
        baseDamage = result.total;
      } catch (e) {
        // Fallback - parse manually
        let fallbackDamage = 0;
        if (maneuver.damage.includes('D8')) {
            fallbackDamage = Math.floor(Math.random() * 8) + 1;
        } else if (maneuver.damage.includes('D6')) {
            fallbackDamage = Math.floor(Math.random() * 6) + 1;
        }
        if (maneuver.damage.includes('+')) {
            fallbackDamage += parseInt(maneuver.damage.split('+')[1]);
        }
        if (maneuver.damage.includes('-')) {
            fallbackDamage -= parseInt(maneuver.damage.split('-')[1]);
        }
        baseDamage = fallbackDamage;
      }
      
      // Exact Strike Bonus: add shift value to damage
      if (isExactStrike) {
          baseDamage += this.state.player.maxShift;
          this.log(`+${this.state.player.maxShift} Exact Strike bonus!`, 'effect');
      }
      
      this.applyDamageToEnemy(baseDamage);
      
      if (maneuver.effect) {
          this.log(`Effect: ${maneuver.effect}`, 'effect');
      }

      this.endTurn();
  }

  public passTurn() {
      if (!this.state.isActive) return;
      if (this.state.turnPhase !== 'player-resolve') return;
      this.log('Player passes the turn (Miss).', 'player-action');
      this.endTurn();
  }

  private applyDamageToEnemy(amount: number) {
      if (!this.state.enemy) return;
      
      this.state.enemy.hp -= amount;
      this.log(`Dealt ${amount} damage to ${this.state.enemy.name}.`, 'damage');
      
      if (this.state.enemy.hp <= 0) {
          this.log(`${this.state.enemy.name} defeated!`, 'info');
          this.state.isActive = false;
          this.state.turnPhase = 'combat-over';
      }
      this.notify();
  }

  public endTurn() {
      if (!this.state.isActive) return;
      
      // After player resolves, switch to enemy's turn
      if (this.state.turnPhase === 'player-resolve') {
          this.state.currentRoll = null;
          this.state.turnPhase = 'enemy-roll';
          this.log(`Enemy's turn - click ROLL`, 'enemy-action');
          this.notify();
          // No auto-roll - wait for user to click Roll button
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
        this.notify();
      } catch (e) {
        console.error('Enemy dice roll failed:', e);
        // Fallback to simulated roll
        const primary = (Math.floor(Math.random() * 8) + 1) as DieValue;
        const secondary = (Math.floor(Math.random() * 8) + 1) as DieValue;
        
        this.state.enemyRoll = [primary, secondary];
        this.state.turnPhase = 'enemy-resolve';
        this.log(`${this.state.enemy.name} rolled [${primary}, ${secondary}]`, 'enemy-action');
        this.notify();
      }
  }

  public getAvailableEnemyManeuvers() {
      if (!this.state.enemyRoll || !this.state.enemy) return [];
      const [p, s] = this.state.enemyRoll;
      const shift = this.state.enemy.shift;
      
      return this.state.enemy.maneuvers.filter(m => {
          const [tp, ts] = m.dice;
          if (p === tp && s === ts) return true;
          const distance = Math.abs(p - tp) + Math.abs(s - ts);
          return distance <= shift;
      });
  }

  public async resolveEnemyManeuver(index: number) {
      if (!this.state.enemy || this.state.turnPhase !== 'enemy-resolve' || !this.state.enemyRoll) return;
      
      const maneuver = this.state.enemy.maneuvers[index];
      if (!maneuver) {
          this.enemyMiss();
          return;
      }
      
      // Check for exact strike
      const [p, s] = this.state.enemyRoll;
      const [mp, ms] = maneuver.dice;
      const isExactStrike = (p === mp && s === ms);
      
      this.log(`${this.state.enemy.name} uses ${maneuver.name}!${isExactStrike ? ' EXACT STRIKE!' : ''}`, 'enemy-action');
      
      // Parse damage notation - convert "D6-1" to "1d6-1" format
      let dieNotation = maneuver.damage.toLowerCase().replace(/^d/, '1d');
      
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
        if (maneuver.damage.includes('D8')) {
            baseDamage = Math.floor(Math.random() * 8) + 1;
        } else if (maneuver.damage.includes('D6')) {
            baseDamage = Math.floor(Math.random() * 6) + 1;
        }
        if (maneuver.damage.includes('+')) {
            baseDamage += parseInt(maneuver.damage.split('+')[1]);
        }
        if (maneuver.damage.includes('-')) {
            baseDamage -= parseInt(maneuver.damage.split('-')[1]);
        }
        damage = baseDamage;
      }
      
      // Exact Strike Bonus: add enemy shift to damage
      if (isExactStrike) {
          damage += this.state.enemy.shift;
          this.log(`+${this.state.enemy.shift} Exact Strike bonus!`, 'effect');
      }
      
      damage = Math.max(0, damage);
      
      this.state.player.hp -= damage;
      this.log(`You take ${damage} damage.`, 'damage');
      
      if (maneuver.effect) {
          this.log(`Effect: ${maneuver.effect}`, 'effect');
      }
      
      this.nextRound();
  }

  public enemyMiss() {
      if (this.state.turnPhase !== 'enemy-resolve') return;
      this.log(`${this.state.enemy?.name} missed!`, 'enemy-action');
      this.nextRound();
  }

  private nextRound() {
      if (this.state.player.hp <= 0) {
          this.log('You have been defeated!', 'info');
          this.state.isActive = false;
          this.state.turnPhase = 'combat-over';
          this.notify();
          return;
      }
      
      // Reset for next round
      this.state.round++;
      
      // Shift bonus at rounds 4, 5, 6
      if (this.state.round >= 4 && this.state.round <= 6) {
          this.state.player.maxShift++;
          if (this.state.enemy) {
              this.state.enemy.shift++;
          }
          this.log(`Round ${this.state.round}: Combat intensifies! +1 Shift to all.`, 'effect');
      } else {
          this.log(`Round ${this.state.round}`, 'info');
      }
      
      this.state.player.shift = this.state.player.maxShift;
      this.state.currentRoll = null;
      this.state.enemyRoll = null;
      this.state.turnPhase = 'player-roll';
      this.notify();
  }
}

export const combatEngine = new CombatEngine();
