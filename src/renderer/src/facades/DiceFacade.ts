/**
 * DiceFacade
 * The public interface for all dice-related operations using the Anvil Dice Engine.
 */

// Placeholder for the roll result structure
export interface RollResult {
  total: number
  formula: string
  dice: any[] // To be defined
}

class DiceFacadeService {
  /**
   * Roll a formula (e.g., "1d20 + 5").
   * @param formula The dice formula string.
   * @returns A promise that resolves to the roll result after the 3D animation completes.
   */
  async roll(formula: string): Promise<RollResult> {
    console.log(`[DiceFacade] Rolling: ${formula}`)
    // TODO: Connect to actual 3D engine
    return Promise.resolve({
      total: 0,
      formula,
      dice: []
    })
  }

  /**
   * Clear the dice tray of all visible dice.
   */
  clearTray(): void {
    console.log('[DiceFacade] Clearing tray')
  }
}

export const DiceFacade = new DiceFacadeService()
