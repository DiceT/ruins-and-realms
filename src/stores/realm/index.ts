import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { createWorldSlice, WorldSlice } from './slices/worldSlice';
import { createCharacterSlice, CharacterSlice } from './slices/characterSlice';
import { createLandSlice, LandSlice } from './slices/landSlice';
import { createBuildingsSlice, BuildingsSlice } from './slices/buildingsSlice';
import { createLedgerSlice, LedgerSlice } from './slices/ledgerSlice';
import { RealmSaveData } from './types';

// Placeholder types for future slices

export type RealmStore = 
  CharacterSlice & 
  LedgerSlice & 
  BuildingsSlice & 
  LandSlice & 
  WorldSlice & {
    // Meta actions
    saveGame: () => RealmSaveData;
    loadGame: (data: RealmSaveData) => void;
    newGame: (worldSeed?: string) => void;
    getVersion: () => string;
  };

export const useRealmStore = create<RealmStore>()(
  persist(
    immer((set, get, api) => ({
      ...createWorldSlice(set, get, api),
      ...createCharacterSlice(set, get, api),
      ...createLandSlice(set, get, api),
      ...createBuildingsSlice(set, get, api),
      ...createLedgerSlice(set, get, api),
      
      saveGame: () => {
        const state = get();
        return {
          version: '1.0.0',
          timestamp: Date.now(),
          character: state.character,
          ledger: state.ledger,
          buildings: state.buildings,
          houses: state.houses,
          claimedLand: state.claimedLand,
          unclaimedLand: state.unclaimedLand,
          world: state.world,
        } as RealmSaveData;
      },
      
      loadGame: (data) => {
        set((state) => {
          // TODO: Add migrations here
          state.world = data.world;
          if (data.character) state.character = data.character;
          if (data.ledger) state.ledger = data.ledger;
          if (data.claimedLand) state.claimedLand = data.claimedLand;
          if (data.unclaimedLand) state.unclaimedLand = data.unclaimedLand;
          if (data.buildings) state.buildings = data.buildings;
          if (data.houses) state.houses = data.houses;
        });
      },
      
      newGame: (worldSeed) => {
         set((state) => {
             // Reset world data
             state.world = {
                 seed: worldSeed || Math.random().toString(36).substring(7),
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
         });
      },
      
      getVersion: () => '1.0.0',
    })),
    {
      name: 'ruins-and-realms-save',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist actual game data, not UI state
        // character: state.character,
        world: state.world,
      }),
    }
  )
);
