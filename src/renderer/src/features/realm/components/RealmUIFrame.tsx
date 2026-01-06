import React, { useEffect, useRef, useMemo } from 'react';
import { Application, Container, Sprite, Texture, Assets } from 'pixi.js';

// Import all slice assets
import topBarImg from '../../../assets/images/backgrounds/realm-ui-slices/top-bar.png';
import bottomBarImg from '../../../assets/images/backgrounds/realm-ui-slices/bottom-bar.png';
import leftBorderImg from '../../../assets/images/backgrounds/realm-ui-slices/left-border.png';
import rightPanelImg from '../../../assets/images/backgrounds/realm-ui-slices/right-panel.png';
import innerTopImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-top.png';
import innerBottomImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-bottom.png';
import innerLeftImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-left.png';
import innerRightImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-right.png';
import innerTopLeftImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-top-left.png';
import innerTopRightImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-top-right.png';
import innerLowerLeftImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-lower-left.png';
import innerLowerRightImg from '../../../assets/images/backgrounds/realm-ui-slices/inner-lower-right.png';

// Original design dimensions (2784x1536 at 16:9)
const DESIGN_WIDTH = 2784;
const DESIGN_HEIGHT = 1536;

// Slice definitions with original pixel dimensions
const SLICES = {
    topBar: { src: topBarImg, w: 2314, h: 57 },
    bottomBar: { src: bottomBarImg, w: 2314, h: 265 },
    leftBorder: { src: leftBorderImg, w: 68, h: 1536 },
    rightPanel: { src: rightPanelImg, w: 402, h: 1536 },
    innerTop: { src: innerTopImg, w: 1968, h: 102 },
    innerBottom: { src: innerBottomImg, w: 1959, h: 89 },
    innerLeft: { src: innerLeftImg, w: 102, h: 858 },
    innerRight: { src: innerRightImg, w: 100, h: 885 },
    innerTopLeft: { src: innerTopLeftImg, w: 173, h: 182 },
    innerTopRight: { src: innerTopRightImg, w: 173, h: 182 },
    innerLowerLeft: { src: innerLowerLeftImg, w: 177, h: 177 },
    innerLowerRight: { src: innerLowerRightImg, w: 173, h: 177 },
};

interface RealmUIFrameProps {
    width: number;
    height: number;
}

/**
 * RealmUIFrame - A self-contained PixiJS component that renders the 12-slice
 * wood-leather UI frame around the map viewport. Scales proportionally with
 * the viewport while maintaining proper slice positioning.
 */
export const RealmUIFrame: React.FC<RealmUIFrameProps> = ({ width, height }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const spritesRef = useRef<Record<string, Sprite>>({});

    // Calculate scale factor based on viewport vs design dimensions
    const scale = useMemo(() => {
        const scaleX = width / DESIGN_WIDTH;
        const scaleY = height / DESIGN_HEIGHT;
        return Math.min(scaleX, scaleY);
    }, [width, height]);

    // Initialize PixiJS application
    useEffect(() => {
        if (!containerRef.current || appRef.current) return;

        const initApp = async () => {
            const app = new Application();
            await app.init({
                width,
                height,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
            });

            containerRef.current!.appendChild(app.canvas);
            appRef.current = app;

            // Load all textures first
            const textureEntries: [string, string][] = Object.entries(SLICES).map(
                ([key, slice]) => [key, slice.src]
            );

            const textures: Record<string, Texture> = {};
            for (const [key, src] of textureEntries) {
                textures[key] = await Assets.load(src);
            }

            // Create sprites with loaded textures
            const frameContainer = new Container();
            frameContainer.eventMode = 'none'; // Pass through all events

            for (const [key] of Object.entries(SLICES)) {
                const sprite = new Sprite(textures[key]);
                sprite.eventMode = 'none';
                spritesRef.current[key] = sprite;
                frameContainer.addChild(sprite);
            }

            app.stage.addChild(frameContainer);

            // Initial positioning
            updateLayout(width, height);
        };

        initApp();

        return () => {
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, []);

    // Update layout when dimensions change
    const updateLayout = (w: number, h: number) => {
        const sprites = spritesRef.current;
        if (!Object.keys(sprites).length) return;

        const s = Math.min(w / DESIGN_WIDTH, h / DESIGN_HEIGHT);

        // === Outer panels (full height/width bars) ===

        // Left border: anchored to left edge, full height
        sprites.leftBorder.x = 0;
        sprites.leftBorder.y = 0;
        sprites.leftBorder.width = SLICES.leftBorder.w * s;
        sprites.leftBorder.height = h;

        // Right panel: anchored to right edge, full height
        sprites.rightPanel.x = w - SLICES.rightPanel.w * s;
        sprites.rightPanel.y = 0;
        sprites.rightPanel.width = SLICES.rightPanel.w * s;
        sprites.rightPanel.height = h;

        // Top bar: spans from left border to right panel
        sprites.topBar.x = SLICES.leftBorder.w * s;
        sprites.topBar.y = 0;
        sprites.topBar.width = w - (SLICES.leftBorder.w + SLICES.rightPanel.w) * s;
        sprites.topBar.height = SLICES.topBar.h * s;

        // Bottom bar: spans from left border to right panel
        sprites.bottomBar.x = SLICES.leftBorder.w * s;
        sprites.bottomBar.y = h - SLICES.bottomBar.h * s;
        sprites.bottomBar.width = w - (SLICES.leftBorder.w + SLICES.rightPanel.w) * s;
        sprites.bottomBar.height = SLICES.bottomBar.h * s;

        // === Inner frame corners ===

        const innerStartX = SLICES.leftBorder.w * s;
        const innerStartY = SLICES.topBar.h * s;
        const innerEndX = w - SLICES.rightPanel.w * s;
        const innerEndY = h - SLICES.bottomBar.h * s;

        // Inner top-left corner
        sprites.innerTopLeft.x = innerStartX;
        sprites.innerTopLeft.y = innerStartY;
        sprites.innerTopLeft.width = SLICES.innerTopLeft.w * s;
        sprites.innerTopLeft.height = SLICES.innerTopLeft.h * s;

        // Inner top-right corner
        sprites.innerTopRight.x = innerEndX - SLICES.innerTopRight.w * s;
        sprites.innerTopRight.y = innerStartY;
        sprites.innerTopRight.width = SLICES.innerTopRight.w * s;
        sprites.innerTopRight.height = SLICES.innerTopRight.h * s;

        // Inner lower-left corner
        sprites.innerLowerLeft.x = innerStartX;
        sprites.innerLowerLeft.y = innerEndY - SLICES.innerLowerLeft.h * s;
        sprites.innerLowerLeft.width = SLICES.innerLowerLeft.w * s;
        sprites.innerLowerLeft.height = SLICES.innerLowerLeft.h * s;

        // Inner lower-right corner
        sprites.innerLowerRight.x = innerEndX - SLICES.innerLowerRight.w * s;
        sprites.innerLowerRight.y = innerEndY - SLICES.innerLowerRight.h * s;
        sprites.innerLowerRight.width = SLICES.innerLowerRight.w * s;
        sprites.innerLowerRight.height = SLICES.innerLowerRight.h * s;

        // === Inner frame edges (stretch to fill) ===

        // Inner top edge
        sprites.innerTop.x = innerStartX + SLICES.innerTopLeft.w * s;
        sprites.innerTop.y = innerStartY;
        sprites.innerTop.width = (innerEndX - innerStartX) - (SLICES.innerTopLeft.w + SLICES.innerTopRight.w) * s;
        sprites.innerTop.height = SLICES.innerTop.h * s;

        // Inner bottom edge
        sprites.innerBottom.x = innerStartX + SLICES.innerLowerLeft.w * s;
        sprites.innerBottom.y = innerEndY - SLICES.innerBottom.h * s;
        sprites.innerBottom.width = (innerEndX - innerStartX) - (SLICES.innerLowerLeft.w + SLICES.innerLowerRight.w) * s;
        sprites.innerBottom.height = SLICES.innerBottom.h * s;

        // Inner left edge
        sprites.innerLeft.x = innerStartX;
        sprites.innerLeft.y = innerStartY + SLICES.innerTopLeft.h * s;
        sprites.innerLeft.width = SLICES.innerLeft.w * s;
        sprites.innerLeft.height = (innerEndY - innerStartY) - (SLICES.innerTopLeft.h + SLICES.innerLowerLeft.h) * s;

        // Inner right edge
        sprites.innerRight.x = innerEndX - SLICES.innerRight.w * s;
        sprites.innerRight.y = innerStartY + SLICES.innerTopRight.h * s;
        sprites.innerRight.width = SLICES.innerRight.w * s;
        sprites.innerRight.height = (innerEndY - innerStartY) - (SLICES.innerTopRight.h + SLICES.innerLowerRight.h) * s;
    };

    // Handle resize
    useEffect(() => {
        if (!appRef.current) return;

        appRef.current.renderer.resize(width, height);
        updateLayout(width, height);
    }, [width, height]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 10,
            }}
        />
    );
};

export default RealmUIFrame;
