import { StateCreator } from 'zustand';
import { RealmStore } from '../index';
import { ClaimedPlot, UnclaimedPlot } from '../types';

export interface LandSlice {
  claimedLand: ClaimedPlot[];
  unclaimedLand: UnclaimedPlot[];
  
  // Actions
  claimLand: (plotTag: string) => boolean;
  addUnclaimedPlot: (plot: UnclaimedPlot) => void;
  updateClaimedPlot: (tag: string, updates: Partial<ClaimedPlot>) => void;
  updateBuildingPoints: (plotTag: string, used: number) => void;
}

const initialClaimedLand: ClaimedPlot[] = [
    // Pre-populating some dummy data for testing
    {
        plotTag: 'A1',
        landType: 'Meadow',
        size: 100,
        rank: 3,
        rankModifier: 12,
        providedTags: ['FERTILE', 'WATER'],
        details: 'Settlement center. Blacksmith, Well.',
        claimedOn: 835,
        taxesInSilver: 15,
        buildingPoints: { used: 65, total: 100 },
        buildings: ['bld_1', 'bld_2'],
        adjacentUnclaimedPlots: ['C1'],
        hexCoordinates: { q: 0, r: 0 }
    }
];

const initialUnclaimedLand: UnclaimedPlot[] = [
    {
        plotTag: 'C1',
        landType: 'Forest',
        size: 100,
        rank: 3,
        rankModifier: 0,
        providedTags: ['TIMBER', 'GAME', 'HERBS'],
        details: 'Dense forest storage.',
        canDispute: true,
        adjacentClaimedPlots: ['A1', 'A2'],
        distance: 1,
        threatLevel: 2,
        hexCoordinates: { q: 1, r: -1 }
    }
];

export const createLandSlice: StateCreator<
  RealmStore,
  [['zustand/immer', never]],
  [],
  LandSlice
> = (set, get) => ({
  claimedLand: initialClaimedLand,
  unclaimedLand: initialUnclaimedLand,

  claimLand: (plotTag) => {
    let success = false;
    set((state) => {
      const plotIndex = state.unclaimedLand.findIndex(p => p.plotTag === plotTag);
      if (plotIndex !== -1) {
        const plot = state.unclaimedLand[plotIndex];
        
        // Convert to claimed
        const newClaimedPlot: ClaimedPlot = {
          ...plot,
          claimedOn: state.world.currentYear,
          taxesInSilver: plot.size * plot.rank, // Simplified calc
          buildingPoints: { used: 0, total: 100 },
          buildings: [],
          adjacentUnclaimedPlots: [] // Would calculate this for neighbors
        };
        
        // Remove from unclaimed
        state.unclaimedLand.splice(plotIndex, 1);
        
        // Add to claimed
        state.claimedLand.push(newClaimedPlot);
        success = true;
      }
    });
    return success;
  },

  addUnclaimedPlot: (plot) => {
    set((state) => {
      if (!state.unclaimedLand.find(p => p.plotTag === plot.plotTag)) {
        state.unclaimedLand.push(plot);
      }
    });
  },

  updateClaimedPlot: (tag, updates) => {
    set((state) => {
      const plot = state.claimedLand.find(p => p.plotTag === tag);
      if (plot) {
        Object.assign(plot, updates);
      }
    });
  },

  updateBuildingPoints: (plotTag, used) => {
    set((state) => {
        const plot = state.claimedLand.find(p => p.plotTag === plotTag);
        if (plot) {
            plot.buildingPoints.used = used;
        }
    });
  }
});
