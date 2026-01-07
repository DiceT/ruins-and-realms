import { StateCreator } from 'zustand';
import { RealmStore } from '../index';
import { WorldData } from '../types';

export interface WorldSlice {
  world: WorldData;
  
  // Actions
  advanceTurn: () => void;
  setWorldThreat: (level: number) => void;
  updateAspectInfluence: (aspectId: string, change: number) => void;
}

const initialWorldData: WorldData = {
  seed: '',
  name: 'New Realm',
  gods: [],
  activeAspects: [],
  currentTurn: 1,
  currentPhase: 'Day',
  currentYear: 837,
  currentSeason: 'Spring',
  threatLevel: 1,
  domainProgress: [],
};

export const createWorldSlice: StateCreator<
  RealmStore,
  [['zustand/immer', never]],
  [],
  WorldSlice
> = (set) => ({
  world: initialWorldData,

  advanceTurn: () => {
    set((state) => {
      state.world.currentTurn += 1;
      // Simple season/year logic placeholder
      if (state.world.currentTurn % 40 === 0) { // Arbitrary season length
        state.world.currentYear += 1;
      }
    });
  },

  setWorldThreat: (level) => {
    set((state) => {
      state.world.threatLevel = level;
    });
  },

  updateAspectInfluence: (aspectId, change) => {
    set((state) => {
      const aspect = state.world.activeAspects.find(a => a.aspectId === aspectId);
      if (aspect) {
        aspect.influence += change;
      }
    });
  },
});
