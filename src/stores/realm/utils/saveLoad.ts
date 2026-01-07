import { RealmStore } from '../index';
import { RealmSaveData } from '../types';

export const exportSaveFile = (store: RealmStore): void => {
  const saveData = store.saveGame();
  const blob = new Blob(
    [JSON.stringify(saveData, null, 2)], 
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `ruins-and-realms-${saveData.world.name.replace(/\s+/g, '_')}-${saveData.timestamp}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
};

export const importSaveFile = async (
  file: File, 
  store: RealmStore
): Promise<boolean> => {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as RealmSaveData;
    
    // minimal validation
    if (!data.version || !data.world) {
      throw new Error('Invalid save file format (missing version or world data)');
    }
    
    store.loadGame(data);
    return true;
  } catch (error) {
    console.error('Failed to load save file:', error);
    return false;
  }
};
