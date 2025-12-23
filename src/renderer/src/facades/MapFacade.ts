/**
 * MapFacade
 * The public interface for interacting with the 2D Map Engine (Plough).
 */

class MapFacadeService {
  /**
   * Load a map data object into the engine.
   * @param mapData The map serialization object.
   */
  async loadMap(mapData: any): Promise<void> {
    console.log('[MapFacade] Loading map', mapData)
    // In the future, this will emit an event or update a store that the MapCanvas listens to.
    // For now, we will just prove the data flow.
  }

  /**
   * Center the viewport on a specific coordinate.
   */
  centerView(x: number, y: number): void {
    console.log(`[MapFacade] Centering view on ${x}, ${y}`)
  }
}

export const MapFacade = new MapFacadeService()
