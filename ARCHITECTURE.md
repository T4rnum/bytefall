# Bytefall Architecture

## Overview
Bytefall is a powerful ASCII/Symbol-based 2D and 3D graphics editor and animation tool. It uses Electron for the desktop shell, React for the UI, and custom rendering engines for 2D (Canvas) and 3D (Three.js).

## Tech Stack
- **Runtime:** Electron
- **UI Framework:** React + TypeScript
- **Build Tool:** Vite
- **Styling:** SCSS (Global theming, pixel-perfect control)
- **State Management:** Zustand
- **3D Engine:** Three.js
- **2D Engine:** Custom HTML5 Canvas Renderer
- **Font:** "Press Start 2P" (Global usage)

## Core Modules

### 1. Main Process (`electron/`)
- **`main.ts`**: Entry point. Handles window creation, native menus, and application lifecycle.
- **`ipc.ts`**: (Planned) Handles communication between UI and System (File IO, Native Dialogs).

### 2. Renderer Process (`src/`)

#### State Management (Zustand)
- **`useEditorStore`**: UI state (active tool, zoom, pan, current color).
- **`useProjectStore`**: Data state (layers, frames, 3D objects).

#### 2D System (`src/modules/2d`)
- **`CanvasRenderer`**: A highly optimized grid renderer.
    - Handles drawing the grid, symbols, and overlays (selection, onionskin).
    - Supports zooming and panning.
- **`LayerSystem`**: Manages multiple layers with blending modes and opacity.
- **`ToolManager`**: Interfaces for tools (Brush, Fill, Select).

#### 3D System (`src/modules/3d`)
- **`SceneManager`**: Wrapper around Three.js Scene.
- **`ASCIIEffect`**: Post-processing shader to render 3D scenes as symbols.
- **`ObjectEditor`**: Tools to manipulate 3D objects (Translate, Rotate, Scale).

#### File Format (`.bfl` - ByteFall Level)
- Custom binary or optimized JSON format.
- **Structure:**
    - `header`: Version, Project Type (2D/3D).
    - `meta`: Author, date, settings.
    - `resources`: Embedded fonts/palettes (optional).
    - `data`:
        - For 2D: Array of Frames -> Array of Layers -> Grid Data (Symbol, Color, Effect).
        - For 3D: Scene Graph (Meshes, Lights, Cameras) with custom attributes.

## Roadmap

### Phase 1: Foundation (Current)
- [x] Project Setup (Electron + Vite + React).
- [x] "Press Start 2P" Font integration.
- [x] Basic Dockable UI Layout.

### Phase 2: 2D Core
- [x] Grid Rendering Engine.
- [x] Basic Tools (Pen, Eraser, Fill, Shapes).
- [x] Color Palette.

### Phase 3: Layers & Animation
- [x] Layer System (Visibility, Opacity, Rename, Delete).
- [x] Timeline UI (Playback, FPS, Frame Management).
- [x] Onion Skinning.

### Phase 4: Advanced Tools & Export
- [ ] Selection Tools (Lasso, Magic Wand).
- [x] Export to PNG.
- [ ] Export to GIF/SpriteSheet.

### Phase 5: 3D Core
- [ ] Three.js Viewport.
- [ ] Basic Mesh creation.
- [ ] Camera Controls.

### Phase 6: Advanced Features
- [ ] Hybrid Mode (2D in 3D).
- [ ] Export/Import System.
- [ ] Custom Scripting/Game Engine Integration.
