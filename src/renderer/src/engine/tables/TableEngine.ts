import { diceEngine } from '../../integrations/anvil-dice-app'
import { RollTable, TableRollResult, TableRow } from './types'

/**
 * Table Engine
 * Handles rolling on RollTables and resolving results.
 */
export class TableEngine {
  /**
   * Roll on a given RollTable.
   * Uses the Anvil Dice Engine for the actual roll.
   */
  public static async rollOnTable(table: RollTable): Promise<TableRollResult> {
    // Determine dice notation
    // If table specifies notation, use it.
    // Otherwise derive from maxRoll:
    // - 100 -> d100
    // - 88 -> d88
    // - 20 -> d20
    let notation = table.diceNotation
    if (!notation) {
      if (table.maxRoll === 88) notation = 'd88'
      else if (table.maxRoll === 100) notation = 'd100'
      else notation = `d${table.maxRoll}`
    }

    // Execute Roll
    const result = await diceEngine.roll(notation)
    const total = result.total

    // Relocate logic is now handled in RollController for d88/2d8 rolls.

    // Resolve Row
    const row = this.resolveRoll(table, total)

    if (!row) {
      console.warn(
        `[TableEngine] Failed to resolve roll ${total} on table '${table.name}' (max: ${table.maxRoll})`
      )
      // Fallback: return raw result or throw
      throw new Error(`Roll ${total} yielded no result on table ${table.id}`)
    }

    return {
      tableId: table.id,
      tableName: table.name,
      roll: total,
      result: row.result,
      row: row
    }
  }

  /**
   * Find the table row that matches the given roll value
   */
  public static resolveRoll(table: RollTable, roll: number): TableRow | null {
    return table.tableData.find((row) => roll >= row.floor && roll <= row.ceiling) || null
  }
}
