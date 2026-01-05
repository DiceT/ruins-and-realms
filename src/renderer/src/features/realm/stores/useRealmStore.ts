import { create } from 'zustand';
import { RealmState, RealmCurrency, RealmPopulation, RealmWellnessLevel, RealmDate } from '../types/realmTypes';

interface RealmActions {
  // Simple state setters for now
  setRings: (amount: RealmCurrency) => void;
  modifyRings: (amount: RealmCurrency) => void;
  setPopulation: (population: RealmPopulation) => void;
  modifyWellness: (amount: number) => void;
  advanceTurn: () => void;
  
  // Debug/Cheat
  resetRealm: () => void;
}

const INITIAL_STATE: RealmState = {
  rings: 0, // Will be randomized on "Start Game" theoretically
  population: {
    total: 4, // Prison Escape default
    availableWorkers: 4,
    assignedWorkers: 0
  },
  wellness: 0, // STABLE
  date: {
    turn: 1
  }
};

export const useRealmStore = create<RealmState & RealmActions>((set) => ({
  ...INITIAL_STATE,

  setRings: (rings) => set({ rings }),
  modifyRings: (amount) => set((state) => ({ rings: Math.max(0, state.rings + amount) })),
  
  setPopulation: (population) => set({ population }),
  
  modifyWellness: (amount) => set((state) => {
    // Clamp between -4 and +4
    const newLevel = Math.max(-4, Math.min(4, state.wellness + amount));
    return { wellness: newLevel as RealmWellnessLevel };
  }),
  
  advanceTurn: () => set((state) => ({ 
    date: { 
      ...state.date, 
      turn: state.date.turn + 1 
    } 
  })),
  
  resetRealm: () => set(INITIAL_STATE)
}));
