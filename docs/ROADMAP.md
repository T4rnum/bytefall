# Bytefall Roadmap (Unified Three.js)

---

# Phase 1 — Three.js Rendering Core

- [x] Stabilize ThreeStage lifecycle (resize, pixelRatio, on-demand render)
- [x] GridRenderer as LineSegments (aligned to cell bounds)
- [x] SymbolInstancedRenderer: full frame build + incremental updates
- [x] GlyphAtlas: BMFont + MSDF texture loading
- [x] Coordinate contract: 1 unit = 1 cell, center at (0,0)

Goal:
Stable 2D rendering on Three.js only.

---

# Phase 2 — Tool Overlays in Three.js

- [x] Selection/hover/path/mask overlays fully in Three.js
- [x] Gradient preview and guides in Three.js
- [x] CanvasRenderer becomes input-only layer

Goal:
No visual rendering on Canvas, overlays are GPU-accelerated.

---

# Phase 3 — Performance & Scalability

- [x] Instance buffer updates with updateRange
- [x] Optional chunking for large canvases
- [x] Viewport-aware culling
- [x] RenderScheduler tuned for interaction bursts

Goal:
Smooth interaction on large grids.

---

# Phase 4 — 3D View Enhancements

- [x] Ortho/Persp camera controls parity
- [x] Optional depth/layer separation
- [x] UI controls for 3D render settings

Goal:
Consistent 2D/3D views on one pipeline.

---

# Phase 5 — Export Pipeline

- [ ] Validate PNG/GIF/SpriteSheet path with Three-based content
- [ ] Optional WebGL snapshot exporter
- [ ] Regression tests for export output

Goal:
Reliable export regardless of renderer backend.

---

# Phase 6 — Stability & Recovery

- [ ] WebGL context loss handling
- [ ] Memory profiling for large projects
- [ ] Stress tests for draw/update loops

Goal:
Production stability.
