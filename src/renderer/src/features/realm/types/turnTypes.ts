export enum TurnPhase {
  DAWN = 'DAWN',       // Status checks, hunger, wellness updates, threat damage
  MORNING = 'MORNING', // Economy: income, taxes, upkeep
  MIDDAY = 'MIDDAY',   // Player actions (Build, Explore, etc.)
  DUSK = 'DUSK',       // Events, threat advancement, merchant visits
  NIGHT = 'NIGHT'      // Resolution, cleanup, turn increment
}
