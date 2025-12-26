/**
 * Table System Type Definitions
 * Adapted from Anvil and Loom v2 for Ruins and Realms
 */

export interface TableRow {
  floor: number
  ceiling: number
  result: string

  // Extended properties for Ruins & Realms (Land Table, etc.)
  tag?: string
  type?: string
  rank?: string | number
  folder?: string
}

export interface RollTable {
  id: string
  name: string
  description?: string
  summary?: string

  // Rolling configuration
  maxRoll: number // e.g. 100 for d100, 88 for d88
  diceNotation?: string // Explicit notation like 'd88', '1d100', '2d6'

  tableData: TableRow[]
}

export interface TableRollResult {
  tableId: string
  tableName: string
  roll: number
  result: string
  row: TableRow
}
