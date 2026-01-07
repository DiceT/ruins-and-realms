import { StateCreator } from 'zustand';
import { RealmStore } from '../index';
import { CharacterData, EquippedManoeuvre, ArmourPiece, MagicScroll, MagicPotion, Condition, InventoryItem, TreasureItem, SideQuest, LootEntry } from '../types';

export interface CharacterSlice {
  character: CharacterData;
  
  // Actions
  updateCharacter: (updates: Partial<CharacterData>) => void;
  addXp: (amount: number) => void;
  damageCharacter: (amount: number) => void;
  healCharacter: (amount: number) => void;
  addItem: (item: InventoryItem, isLarge: boolean) => boolean;
  removeItem: (itemId: string, isLarge: boolean) => void;
  addTreasure: (treasure: TreasureItem) => void;
  removeTreasure: (treasureId: string) => void;
  processLoot: (entryIndex: number) => void;
}

const initialCharacterData: CharacterData = {
  name: '',
  level: 1,
  xp: 0,
  xpToNextLevel: 10,
  healthPoints: { current: 18, max: 20 },
  shift: 0,
  discipline: 0,
  precision: 0,
  weapon: '',
  appliedRunes: [],
  manoeuvres: [],
  armour: [],
  magicScrolls: [],
  magicPotions: [],
  bloodied: false,
  soaked: false,
  conditions: [],
  coins: { gold: 0, silver: 0, copper: 0 },
  gems: [],
  largeItems: [],
  smallItems: [],
  rations: 0,
  treasure: [],
  liberatedPrisoners: [],
  sideQuests: [],
  legendStatusLevel: 0,
  favourPoints: [],
  lootLockup: [],
};

export const createCharacterSlice: StateCreator<
  RealmStore,
  [['zustand/immer', never]],
  [],
  CharacterSlice
> = (set) => ({
  character: initialCharacterData,

  updateCharacter: (updates) => {
    set((state) => {
      Object.assign(state.character, updates);
    });
  },

  addXp: (amount) => {
    set((state) => {
      state.character.xp += amount;
      if (state.character.xp >= state.character.xpToNextLevel) {
        // Level up logic could go here or trigger a notification
      }
    });
  },

  damageCharacter: (amount) => {
    set((state) => {
      state.character.healthPoints.current = Math.max(0, state.character.healthPoints.current - amount);
      if (state.character.healthPoints.current <= 0) {
        state.character.conditions.push({ id: 'unconscious', name: 'Unconscious', effect: 'Cannot act' });
      }
    });
  },

  healCharacter: (amount) => {
    set((state) => {
      state.character.healthPoints.current = Math.min(
        state.character.healthPoints.max,
        state.character.healthPoints.current + amount
      );
    });
  },

  addItem: (item, isLarge) => {
    let added = false;
    set((state) => {
      const list = isLarge ? state.character.largeItems : state.character.smallItems;
      if (isLarge && list.length >= 10) {
        return; // Inventory full
      }
      
      const existing = list.find(i => i.id === item.id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        list.push(item);
      }
      added = true;
    });
    return added;
  },

  removeItem: (itemId, isLarge) => {
    set((state) => {
      const list = isLarge ? state.character.largeItems : state.character.smallItems;
      const index = list.findIndex(i => i.id === itemId);
      if (index !== -1) {
        list.splice(index, 1);
      }
    });
  },

  addTreasure: (treasure) => {
    set((state) => {
      state.character.treasure.push(treasure);
    });
  },

  removeTreasure: (treasureId) => {
    set((state) => {
      state.character.treasure = state.character.treasure.filter(t => t.id !== treasureId);
    });
  },

  processLoot: (entryIndex) => {
    set((state) => {
      if (state.character.lootLockup[entryIndex]) {
        state.character.lootLockup[entryIndex].processed = true;
        // Logic to move items to inventory would typically happen here or be handled by UI
      }
    });
  },
});
