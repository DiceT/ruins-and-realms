# 00 - Session Zero: Architecture & stack Definition

**Date**: 2025-12-21
**Phase**: Planning / Initialization

## Summary

We decided to rebuild `Ruins and Realms` from the ground up ("Greenfield") rather than continuing the "Strangler Fig" migration of the legacy `Plough` engine. This ensures the Core Engine Law is respected and dependencies are clean.

## Architecture Decisions

### 1. The "Engine" Law

- The `Engine` is the single source of truth for time.
- Unidirectional Data Flow: `Brains -> Behaviors -> Actions -> ActionQueue -> Mutation`. #determinism

### 2. Tech Stack

- **Shell**: Electron (Desktop App)
- **Build**: Vite (HMR)
- **Language**: TypeScript (Strict)
- **Frontend**: React 19
- **State**: Zustand + Immer (Global Facade Stores)
- **Map Engine**: PixiJS v8 (WebGPU/WebGL) + `pixi-viewport`
- **Dice Engine**: Three.js / R3F (Planned Integration)

### 3. Facade Pattern

- Subsystems (Dice, Log, Map) will expose a single, public API (Facade).
- UI components consume Facades, never engine internals.

### 4. Ecosystem Clean-up

- Dropped `pixi-cull` (replaced by v8 native Culler).
- Dropped `pixi-layers` (replaced by v8 native Render Groups).
- Selected `react-use` for sensor hooks.
