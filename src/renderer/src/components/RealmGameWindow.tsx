import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Application } from 'pixi.js';
import { OverworldController } from '../engine/game/controllers/OverworldController';
import { TerrainAssetLoader } from '../engine/map/TerrainAssetLoader';
import { Plot } from '../engine/managers/OverworldManager';

// UI Components
import { RealmTopBar, MapLayerToggle } from '../features/realm/components/RealmTopBar';
import { RealmRightPanel } from '../features/realm/components/RealmRightPanel';
import { ActionHotbar } from '../features/realm/components/ActionHotbar';
import { EventLogOverlay, EventLogEntry } from '../features/realm/components/EventLogOverlay';
import { ToastNotifications, Toast } from '../features/realm/components/ToastNotifications';
import { RealmDebugUI } from '../features/realm/components/RealmDebugUI';
import { PhaseWheelDebug } from '../features/realm/components/PhaseWheelDebug';
import { RealmUIFrame } from '../features/realm/components/RealmUIFrame';

// Store
import { useRealmStore } from '../features/realm/stores/useRealmStore';
import { RealmActionType } from '../features/realm/config/actions';

// Assets
import woodLeatherBg from '../assets/images/backgrounds/wood-leather.png';

interface RealmGameWindowProps {
    onExit?: () => void;
}

export const RealmGameWindow: React.FC<RealmGameWindowProps> = ({ onExit }) => {
    // === Refs ===
    const containerRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const controllerRef = useRef<OverworldController | null>(null);

    // === Realm Store ===
    const realmState = useRealmStore();

    // === Local State ===
    const [isLoading, setIsLoading] = useState(true);
    const [overworldStep, setOverworldStep] = useState(0);
    const [unclaimedPlots, setUnclaimedPlots] = useState<Plot[]>([]);
    const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [activeToggles, setActiveToggles] = useState<MapLayerToggle[]>([]);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    // === Logging ===
    const addLog = useCallback((message: string, type: EventLogEntry['type'] = 'INFO') => {
        const entry: EventLogEntry = {
            id: crypto.randomUUID(),
            message,
            type,
            turn: realmState.date.turn,
            timestamp: Date.now()
        };
        setEventLog(prev => [...prev.slice(-50), entry]); // Keep last 50
        console.log(`[Realm] ${message}`);
    }, [realmState.date.turn]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'INFO') => {
        const toast: Toast = {
            id: crypto.randomUUID(),
            message,
            type
        };
        setToasts(prev => [...prev, toast]);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // === Viewport Size Tracking ===
    useEffect(() => {
        const rootEl = rootRef.current;
        if (!rootEl) return;

        const updateSize = () => {
            setViewportSize({ width: rootEl.clientWidth, height: rootEl.clientHeight });
        };
        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(rootEl);

        return () => observer.disconnect();
    }, []);

    // === Pixi Initialization ===
    useEffect(() => {
        if (!containerRef.current) return;

        let destroyed = false;

        const initPixi = async () => {
            // 1. Create Application
            const app = new Application();
            await app.init({
                width: containerRef.current!.clientWidth,
                height: containerRef.current!.clientHeight,
                backgroundColor: 0x1a1a2e,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            });

            if (destroyed) {
                app.destroy(true);
                return;
            }

            appRef.current = app;
            containerRef.current!.appendChild(app.canvas as HTMLCanvasElement);

            // 2. Load Terrain Assets
            await TerrainAssetLoader.loadAll();

            // 3. Create Controller (no GameLayout - uses full viewport)
            const controller = new OverworldController({
                onStepChange: setOverworldStep,
                onLog: (msg) => addLog(msg),
                onUnclaimedLogChange: setUnclaimedPlots,
                onHexClicked: (x, y) => {
                    console.log(`[Realm] Hex clicked: ${x}, ${y}`);
                }
            });

            controller.init(app);  // No layout - full screen
            controller.initMapEngine();
            controllerRef.current = controller;

            // Auto-place town at 0,0 for new games
            const mapEngine = controller.getMapEngine();
            if (mapEngine && !controller.isTownPlaced()) {
                // Simulate town placement at center (0,0)
                setTimeout(() => {
                    if (!controller.isTownPlaced()) {
                        controller.getMapEngine()?.interactionState.mode === 'placing_town';
                        // Force place at 0,0
                        (controller as any).handleTownPlaced(0, 0);
                        addLog('Your town has been founded at the heart of your realm.');
                    }
                }, 500);
            }

            setIsLoading(false);
            addLog('Overworld initialized.');
        };

        initPixi();

        return () => {
            destroyed = true;
            if (controllerRef.current) {
                controllerRef.current.destroy();
                controllerRef.current = null;
            }
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
            }
        };
    }, [addLog]);

    // === Handle Resize ===
    useEffect(() => {
        const handleResize = () => {
            if (!appRef.current || !containerRef.current) return;
            const { clientWidth, clientHeight } = containerRef.current;
            appRef.current.renderer.resize(clientWidth, clientHeight);
            layoutRef.current?.resize();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // === Exploration Mode State ===
    const [isExploreMode, setIsExploreMode] = useState(false);

    // === Action Handlers ===
    const handleActionSelect = useCallback((action: RealmActionType) => {
        console.log(`[Realm] Action selected: ${action}`);

        // Special handling for EXPLORE - activates hex highlights
        if (action === RealmActionType.EXPLORE) {
            if (!isExploreMode) {
                // Enter exploration mode - show valid hexes
                const controller = controllerRef.current;
                if (controller) {
                    const mapEngine = controller.getMapEngine();
                    const validMoves = controller.getOverworldManager().getValidMoves();
                    mapEngine?.highlightValidMoves(validMoves);
                    setIsExploreMode(true);
                    addLog('Select a hex to explore...');
                    addToast('Click a glowing hex to explore', 'INFO');
                }
            } else {
                // Cancel exploration mode
                controllerRef.current?.getMapEngine()?.clearHighlights?.();
                setIsExploreMode(false);
                addLog('Exploration cancelled.');
            }
            return;
        }

        // Route other actions to realm store
        realmState.dispatchAction({ type: action, payload: {} });
        addToast(`Action: ${action}`, 'INFO');
    }, [realmState, addToast, addLog, isExploreMode]);

    const handleEndTurn = useCallback(() => {
        // Cancel exploration mode on turn end
        if (isExploreMode) {
            controllerRef.current?.getMapEngine()?.clearHighlights?.();
            setIsExploreMode(false);
        }

        realmState.advanceTurn();
        addToast('Turn advanced!', 'SUCCESS');
        addLog('Turn ended. Processing phases...', 'SUCCESS');
    }, [realmState, addToast, addLog, isExploreMode]);

    const handleToggleLayer = useCallback((layer: MapLayerToggle) => {
        setActiveToggles(prev =>
            prev.includes(layer)
                ? prev.filter(l => l !== layer)
                : [...prev, layer]
        );
    }, []);

    // === Render ===
    return (
        <div ref={rootRef} id="realm-root" style={styles.root}>
            {/* Top Bar */}
            <RealmTopBar
                activeToggles={activeToggles}
                onToggleLayer={handleToggleLayer}
                onExitOverworld={onExit}
            />

            {/* Main Content Area */}
            <div style={styles.mainContent}>
                {/* Map Canvas */}
                <div ref={containerRef} style={styles.mapContainer}>
                    {isLoading && (
                        <div style={styles.loadingOverlay}>
                            <span>Loading Overworld...</span>
                        </div>
                    )}

                    {/* Event Log Overlay */}
                    <EventLogOverlay entries={eventLog} />

                    {/* Toast Notifications */}
                    <ToastNotifications toasts={toasts} onDismiss={dismissToast} />

                    {/* Debug UI */}
                    <RealmDebugUI />
                </div>

                {/* Right Panel */}
                <RealmRightPanel />
            </div>

            {/* Bottom Hotbar */}
            <ActionHotbar
                onActionSelect={handleActionSelect}
                onEndTurn={handleEndTurn}
            />

            {/* DEBUG: Phase Wheel Assembly */}
            {/* <PhaseWheelDebug /> */}

            {/* UI Frame Overlay */}
            {viewportSize.width > 0 && (
                <RealmUIFrame width={viewportSize.width} height={viewportSize.height} />
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    root: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0a0a1a',
        overflow: 'hidden',
        position: 'relative'
    },
    mainContent: {
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden'
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 10, 26, 0.9)',
        color: '#888',
        fontSize: '18px',
        zIndex: 50
    },
    placeTownButton: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px 40px',
        fontSize: '18px',
        backgroundColor: '#2a4a2a',
        border: '2px solid #4a8a4a',
        borderRadius: '8px',
        color: '#fff',
        cursor: 'pointer',
        zIndex: 60
    }
};

export default RealmGameWindow;
