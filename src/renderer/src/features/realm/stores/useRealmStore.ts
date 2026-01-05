import { create } from 'zustand';
import { RealmState, RealmCurrency, RealmPopulation, RealmWellnessLevel, RealmDate, FoodStatus } from '../types/realmTypes';
import { processTurn } from '../logic/turnOrchestrator';
import { RealmAction } from '../config/actions';
import { executeAction } from '../logic/actions/actionDispatcher';
import { PersistenceService } from '../../../services/PersistenceService';

interface RealmActions {
  // Simple state setters for now
  setRings: (amount: RealmCurrency) => void;
  modifyRings: (amount: RealmCurrency) => void;
  setPopulation: (population: RealmPopulation) => void;
  modifyWellness: (amount: number) => void;
  advanceTurn: () => void;
  dispatchAction: (action: RealmAction) => void;
  addOwnedHex: (hexId: string, tags: string[]) => void;
  saveRealm: () => void;
  loadRealm: () => void;
  
  // Debug/Cheat
  resetRealm: () => void;
}

import { TurnPhase } from '../types/turnTypes';

// ...

const INITIAL_STATE: RealmState = {
  rings: 0, // Will be randomized on "Start Game" theoretically
  population: {
    total: 4, // Prison Escape default
    availableWorkers: 4,
    assignedWorkers: 0
  },
  wellness: 0, // STABLE
  foodStatus: FoodStatus.STARVATION, // Start with 0 production vs 4 pop
  date: {
    turn: 1
  },
  tax: {
    amount: 50, // Base Tax
    daysUntilDue: 4, // 4 Turns cycle
    status: 'PAID'
  },
  baronPatience: 50, // Neutral start
  buildings: [],
  phase: TurnPhase.MIDDAY,
  ownedHexes: [],
  actionPoints: {
    current: 2, // Base 2 actions
    max: 2      // Potentially upgradable (Manor, etc.)
  },
  // Addendum 002: New state fields
  titles: ['SURVIVOR'],      // Start with SURVIVOR title
  threat: 0,
  lastDelveTurn: 0,
  clocks: []
};

export const useRealmStore = create<RealmState & RealmActions>((set, get) => ({
  ...INITIAL_STATE,

  setRings: (rings) => set({ rings }),
  modifyRings: (amount) => set((state) => ({ rings: Math.max(0, state.rings + amount) })),
  
  setPopulation: (population) => set({ population }),
  
  modifyWellness: (amount) => set((state) => {
    // Clamp between -4 and +4
    const newLevel = Math.max(-4, Math.min(4, state.wellness + amount));
    return { wellness: newLevel as RealmWellnessLevel };
  }),
  

  advanceTurn: () => set((state) => {
    const result = processTurn(state);
    console.log('Turn Processed:', result.logs);
    return result.newState;
  }),
  
  dispatchAction: (action: RealmAction) => set((state) => {
    const result = executeAction(state, action);
    if (!result.success) {
      console.warn('Action Failed:', result.message);
      return state; // No change
    }
    console.log('Action Success:', result.message);
    return result.newState;
  }),

  // Debug/Cheat
  addOwnedHex: (hexId: string, tags: string[]) => set((state) => ({
    ownedHexes: [...state.ownedHexes, { id: hexId, landTags: tags }]
  })),

  // Persistence
  saveRealm: () => {
    const state = get();
    // Strip functions/actions, just save data
    const dataToSave: RealmState = {
      rings: state.rings,
      population: state.population,
      wellness: state.wellness,
      foodStatus: state.foodStatus,
      date: state.date,
      buildings: state.buildings,
      tax: state.tax,
      baronPatience: state.baronPatience,
      phase: state.phase,
      ownedHexes: state.ownedHexes,
      actionPoints: state.actionPoints,
      // New fields
      titles: state.titles,
      threat: state.threat,
      lastDelveTurn: state.lastDelveTurn,
      clocks: state.clocks
    };
    PersistenceService.save('realm', dataToSave);
    console.log('[Realm] State saved');
  },

  loadRealm: () => {
    const loaded = PersistenceService.load<RealmState>('realm');
    if (loaded) {
      set(loaded);
      console.log('[Realm] State loaded');
    } else {
      console.warn('[Realm] No save found');
    }
  },

  resetRealm: () => set(INITIAL_STATE)
}));
