BEFORE:
SeedGrowthControlPanel.tsx:265 [SeedGrowthControlPanel] Syncing heat map: false
GameWindow.tsx:340 [ViewAsDungeon] Effect triggered: {viewAsDungeon: true, gameMode: 'dungeon', showMap: true, hasState: false}
GameWindow.tsx:355 [ViewAsDungeon] No state available
BackgroundSystem.ts:92 [BackgroundSystem] setVisible: false
DungeonController.ts:87 [DungeonController] Created
DungeonController.ts:100 [DungeonController] init()
SeedGrowthControlPanel.tsx:265 [SeedGrowthControlPanel] Syncing heat map: false
GameWindow.tsx:340 [ViewAsDungeon] Effect triggered: {viewAsDungeon: true, gameMode: 'dungeon', showMap: true, hasState: false}
GameWindow.tsx:361 [ViewAsDungeon] Spine Mode State Check:
GameWindow.tsx:362  - roomSeeds count: 24
GameWindow.tsx:363  - spineTiles present: true 35
GameWindow.tsx:427 [ViewAsDungeon] Entering Spine Adapter logic
GameWindow.tsx:446 [ViewAsDungeon] Pruned rooms count: 24
GameWindow.tsx:447 [ViewAsDungeon] Calling renderDungeonView() with spine settings
DungeonViewRenderer.ts:251 [DungeonViewRenderer] renderDungeonView Start {showWalkmap: false, rooms: 24}
DungeonViewRenderer.ts:429 [DungeonViewRenderer] Rendering Floors for 24 rooms
LabelLayer.ts:108 PixiJS Deprecation Warning: strokeThickness is now a part of strokeDeprecated since v8.0.0
DungeonViewRenderer.ts:493 [DungeonViewRenderer] Render Complete
GameWindow.tsx:561 [ViewAsDungeon] Render returned



----
AFTER:
GameWindow.tsx:340 [ViewAsDungeon] Effect triggered: 
{viewAsDungeon: true, gameMode: 'dungeon', showMap: true, hasState: false}
GameWindow.tsx:361 [ViewAsDungeon] Spine Mode State Check:
GameWindow.tsx:362  - roomSeeds count: 24
GameWindow.tsx:363  - spineTiles present: true 35
GameWindow.tsx:427 [ViewAsDungeon] Entering Spine Adapter logic
GameWindow.tsx:446 [ViewAsDungeon] Pruned rooms count: 24
GameWindow.tsx:447 [ViewAsDungeon] Calling renderDungeonView() with spine settings
DungeonViewRenderer.ts:251 [DungeonViewRenderer] renderDungeonView Start 
{showWalkmap: false, rooms: 24}
DungeonViewRenderer.ts:429 [DungeonViewRenderer] Rendering Floors for 24 rooms
DungeonViewRenderer.ts:493 [DungeonViewRenderer] Render Complete
GameWindow.tsx:561 [ViewAsDungeon] Render returned
DungeonController.ts:295 [DungeonController] regenerate()
GameWindow.tsx:340 [ViewAsDungeon] Effect triggered: 
{viewAsDungeon: true, gameMode: 'dungeon', showMap: true, hasState: false}
GameWindow.tsx:361 [ViewAsDungeon] Spine Mode State Check:
GameWindow.tsx:362  - roomSeeds count: 24
GameWindow.tsx:363  - spineTiles present: true 25
GameWindow.tsx:427 [ViewAsDungeon] Entering Spine Adapter logic
GameWindow.tsx:446 [ViewAsDungeon] Pruned rooms count: 0
GameWindow.tsx:447 [ViewAsDungeon] Calling renderDungeonView() with spine settings
DungeonViewRenderer.ts:251 [DungeonViewRenderer] renderDungeonView Start 
{showWalkmap: false, rooms: 0}
DungeonViewRenderer.ts:429 [DungeonViewRenderer] Rendering Floors for 0 rooms
DungeonViewRenderer.ts:493 [DungeonViewRenderer] Render Complete
GameWindow.tsx:561 [ViewAsDungeon] Render returned