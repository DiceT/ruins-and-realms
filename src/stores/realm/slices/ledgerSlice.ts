import { StateCreator } from 'zustand';
import { RealmStore } from '../index';
import { LedgerData, YearlyIncome, WellnessModifier, AspectInfluence } from '../types';

export interface LedgerSlice {
  ledger: LedgerData;
  
  // Actions
  recordIncome: (year: number) => void;
  addWellnessModifier: (modifier: WellnessModifier) => void;
  removeWellnessModifier: (source: string) => void;
  updateAspectInfluence: (aspectId: string, change: number) => void;
  
  // Computeds
  getNetWellness: () => number;
}

const initialLedger: LedgerData = {
  year: 837,
  incomeHistory: [
      {
          year: 836,
          gold: 12,
          silver: 150,
          gems: 2,
          totalIncome: 12 + (150/10) + (2*10), // Approx
          buildingIncome: 25,
          highActuaryModifiers: []
      }
  ],
  wellness: {
      permanent: [
          { source: 'Decor', value: 1, description: 'Statue of the Founder', category: 'decor' }
      ],
      temporary: []
  },
  currentTitle: 'THANE',
  claimedTitles: ['SURVIVOR', 'FOUNDER', 'THANE'],
  titleClaimArea: 'Blackstone Vale',
  landownerTitle: 'Lord',
  kaladearFavourPoints: [],
  aspectInfluence: [
      { aspectId: 'aspect_1', influence: 3, effects: ['+1 Combat'], history: [] },
      { aspectId: 'aspect_2', influence: -1, effects: ['-1 Harvest'], history: [] }
  ],
  landowners: []
};

export const createLedgerSlice: StateCreator<
  RealmStore,
  [['zustand/immer', never]],
  [],
  LedgerSlice
> = (set, get) => ({
  ledger: initialLedger,
  
  recordIncome: (year) => {
    const state = get();
    // Calculate current income from all sources
    const buildingIncome = state.getTotalBuildingIncome();
    // This is a simplified calculation placeholder
    const total = buildingIncome; 
    
    set((s) => {
      s.ledger.incomeHistory.push({
        year,
        gold: Math.floor(total),
        silver: Math.floor((total % 1) * 10),
        gems: 0,
        totalIncome: total,
        buildingIncome,
        highActuaryModifiers: []
      });
    });
  },
  
  addWellnessModifier: (modifier) => {
    set((state) => {
      if (modifier.category === 'event') {
        state.ledger.wellness.temporary.push(modifier);
      } else {
        state.ledger.wellness.permanent.push(modifier);
      }
    });
  },
  
  removeWellnessModifier: (source) => {
    set((state) => {
      state.ledger.wellness.permanent = state.ledger.wellness.permanent.filter(m => m.source !== source);
      state.ledger.wellness.temporary = state.ledger.wellness.temporary.filter(m => m.source !== source);
    });
  },
  
  updateAspectInfluence: (aspectId, change) => {
    set((state) => {
      const aspect = state.ledger.aspectInfluence.find(a => a.aspectId === aspectId);
      if (aspect) {
        aspect.influence += change;
      }
    });
  },
  
  getNetWellness: () => {
    const state = get();
    const perm = state.ledger.wellness.permanent.reduce((sum, m) => sum + m.value, 0);
    const temp = state.ledger.wellness.temporary.reduce((sum, m) => sum + m.value, 0);
    return perm + temp;
  }
});
