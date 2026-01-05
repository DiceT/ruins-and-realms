/**
 * Persistence Service
 * Handles saving and loading game data to LocalStorage.
 */

const SAVE_KEY_PREFIX = 'ruins-and-realms:save:';

export const PersistenceService = {
  /**
   * Save data with a specific key.
   */
  save: (key: string, data: any): void => {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(`${SAVE_KEY_PREFIX}${key}`, serialized);
      console.log(`[Persistence] Saved ${key}`);
    } catch (err) {
      console.error(`[Persistence] Failed to save ${key}`, err);
    }
  },

  /**
   * Load data by key.
   */
  load: <T>(key: string): T | null => {
    try {
      const serialized = localStorage.getItem(`${SAVE_KEY_PREFIX}${key}`);
      if (!serialized) return null;
      return JSON.parse(serialized) as T;
    } catch (err) {
      console.error(`[Persistence] Failed to load ${key}`, err);
      return null;
    }
  },

  /**
   * Clear a specific save key.
   */
  clear: (key: string): void => {
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${key}`);
  }
};
