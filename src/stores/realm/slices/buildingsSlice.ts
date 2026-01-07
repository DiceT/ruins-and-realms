import { StateCreator } from 'zustand';
import { RealmStore } from '../index';
import { BuildingInstance, HousingInstance } from '../types';

export interface BuildingsSlice {
  buildings: BuildingInstance[];
  houses: HousingInstance[];
  
  // Actions
  addBuilding: (building: Omit<BuildingInstance, 'instanceId'>) => string;
  damageBuilding: (instanceId: string, damage: number) => void;
  repairBuilding: (instanceId: string, amount: number) => void;
  allocateWorkers: (instanceId: string, count: number) => void;
  
  // Computeds (Helpers)
  getTotalWorkers: () => number;
  getAvailableWorkers: () => number;
  getTotalPopulationCapacity: () => number;
  getTotalBuildingIncome: () => number;
}

const initialBuildings: BuildingInstance[] = [
    {
        instanceId: 'bld_1',
        buildingId: 'blacksmith',
        plotTag: 'A1',
        name: 'Blacksmith',
        level: 1,
        hp: { current: 6, max: 6 },
        size: 10,
        rankMod: 5,
        income: 3,
        workers: { required: 2, allocated: 2 },
        requiredTags: ['SMELTING'],
        providedTags: ['SMITHING'],
        operational: true,
        damaged: false,
        notes: ''
    },
    {
        instanceId: 'bld_2',
        buildingId: 'well',
        plotTag: 'A1',
        name: 'Well',
        level: 1,
        hp: { current: 4, max: 4 },
        size: 5,
        rankMod: 1,
        income: 0,
        workers: { required: 0, allocated: 0 },
        requiredTags: [],
        providedTags: ['WATER'],
        operational: true,
        damaged: false,
        notes: ''
    }
];

const initialHouses: HousingInstance[] = [
    {
        instanceId: 'house_1',
        buildingId: 'shack',
        plotTag: 'A1',
        name: 'Shack',
        level: 1,
        hp: { current: 4, max: 4 },
        size: 5,
        rankMod: 1,
        income: 0,
        workers: { required: 0, allocated: 0 },
        requiredTags: [],
        providedTags: [],
        operational: true,
        damaged: false,
        notes: '',
        capacity: 2,
        occupants: 2,
        allocatedWorkers: []
    },
    {
        instanceId: 'house_2',
        buildingId: 'house',
        plotTag: 'A1',
        name: 'House',
        level: 1,
        hp: { current: 6, max: 6 },
        size: 10,
        rankMod: 2,
        income: 0,
        workers: { required: 0, allocated: 0 },
        requiredTags: [],
        providedTags: [],
        operational: true,
        damaged: false,
        notes: '',
        capacity: 4,
        occupants: 3,
        allocatedWorkers: []
    }
];

export const createBuildingsSlice: StateCreator<
  RealmStore,
  [['zustand/immer', never]],
  [],
  BuildingsSlice
> = (set, get) => ({
  buildings: initialBuildings,
  houses: initialHouses,
  
  addBuilding: (building) => {
    let newId = '';
    set((state) => {
      const instanceId = `bld_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      newId = instanceId;
      const newBuilding: BuildingInstance = {
        ...building,
        instanceId,
      };
      
      // Determine if housing or regular
      if (['house', 'shack', 'manor'].includes(building.buildingId)) {
           state.houses.push(newBuilding as HousingInstance);
      } else {
           state.buildings.push(newBuilding);
      }
    });
    return newId;
  },
  
  damageBuilding: (instanceId, damage) => {
    set((state) => {
      // Helper to find in either array
      const building = state.buildings.find(b => b.instanceId === instanceId) 
                    || state.houses.find(h => h.instanceId === instanceId);
      if (building) {
        building.hp.current = Math.max(0, building.hp.current - damage);
        building.damaged = building.hp.current < (building.hp.max * 0.5);
        if (building.hp.current === 0) building.operational = false;
      }
    });
  },
  
  repairBuilding: (instanceId, amount) => {
      set((state) => {
      const building = state.buildings.find(b => b.instanceId === instanceId) 
                    || state.houses.find(h => h.instanceId === instanceId);
      if (building) {
        building.hp.current = Math.min(building.hp.max, building.hp.current + amount);
        building.damaged = building.hp.current < (building.hp.max * 0.5);
      }
    });
  },
  
  allocateWorkers: (instanceId, count) => {
      set((state) => {
       const building = state.buildings.find(b => b.instanceId === instanceId);
       if (building) {
           building.workers.allocated = count; // Simplified for now
           building.operational = building.workers.allocated >= building.workers.required;
       }
    });
  },
  
  // These helpers might need to be used outside the store or wrapped in a hook for reactivity if they depend on state
  getTotalWorkers: () => {
      const state = get();
      return state.houses.reduce((sum, h) => sum + (h.occupants || 0), 0);
  },
  
  getAvailableWorkers: () => {
      const state = get();
      const total = state.houses.reduce((sum, h) => sum + (h.occupants || 0), 0);
      const used = state.buildings.reduce((sum, b) => sum + (b.workers.allocated || 0), 0);
      return total - used;
  },

  getTotalPopulationCapacity: () => {
      const state = get();
      return state.houses.reduce((sum, h) => sum + (h.capacity || 0), 0);
  },

  getTotalBuildingIncome: () => {
    const state = get();
    return state.buildings.reduce((sum, b) => {
        if (!b.operational || b.damaged) return sum;
        return sum + (b.income || 0);
    }, 0);
  }

});
