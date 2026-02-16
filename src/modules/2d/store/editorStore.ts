import { create } from 'zustand'
import { ToolType, Position } from '../types'

interface EditorState {
  // Viewport State
  activeTab: '2D' | '3D'
  zoom: number
  pan: Position
  cameraState2D: { pan: Position; zoom: number } | null
  // camera2DMode removed; Three Ortho is default for 2D tab
  overlayDraft: { 
    type: 'line' | 'rectangle' | 'circle' | 'gradient', 
    points?: { x: number; y: number }[], 
    dir?: { x0: number; y0: number; x1: number; y1: number },
    cells?: { x: number; y: number; color: string; char: string }[] 
  } | null
  
  // Tool State
  activeTool: ToolType
  brushChar: string
  brushColor: string
  secondaryChar: string
  secondaryColor: string
  cursorPos: { x: number; y: number }
  
  // Display Options
  onionSkinEnabled: boolean
  gradientType: 'linear' | 'radial'
  gradientColorStart: string
  gradientColorEnd: string
  showFps: boolean
  
  // Background Settings
  canvasBgColor: string // The actual canvas/project background
  exportBgColor: string | null // null = transparent

  // View Settings
  showGrid: boolean
  showCenterGuide: boolean
  workspaceColor: string // The color of the area OUTSIDE the canvas
  // renderer2D and camera2DMode removed
  setOverlayDraft: (draft: EditorState['overlayDraft']) => void

  // 3D Settings
  renderMode3D: 'voxel' | 'plane'
  autoRotate3D: boolean
  asciiMode3D: boolean
  asciiFontSize: number
  asciiFillBackground3D: boolean
  cameraType3D: 'persp' | 'ortho'
  cameraZoom3D: number
  layerDepth3D: number
  cameraState3D: { position: [number, number, number], target: [number, number, number] } | null
  setActiveTab: (tab: '2D' | '3D') => void
  setRenderMode3D: (mode: 'voxel' | 'plane') => void
  setAutoRotate3D: (autoRotate: boolean) => void
  setAsciiMode3D: (ascii: boolean) => void
  setAsciiFontSize: (size: number) => void
  setAsciiFillBackground3D: (fill: boolean) => void
  setCameraType3D: (type: 'persp' | 'ortho') => void
  setCameraZoom3D: (zoom: number) => void
  setLayerDepth3D: (depth: number) => void
  setCameraState3D: (state: { position: [number, number, number], target: [number, number, number] } | null) => void

  // Palette
  palette: string[]
  setPalette: (colors: string[]) => void
  addColorToPalette: (color: string) => void

  // Selection State
  selection: {x: number, y: number, w: number, h: number} | null
  selectionPath: Position[] | null // For Lasso
  selectionMask: Set<string> | null // For Magic Wand & Lasso (set of "x,y")
  selectionTransform: 'rotate' | 'flipH' | 'flipV' | null
  selectionMode: 'new' | 'add' | 'subtract' | 'intersect'
  floatingSelection: {dx: number, dy: number, data: any}[] | null
  dragOffset: { x: number; y: number }
  selectionMoveOffset: { x: number; y: number }
  setSelection: (selection: {x: number, y: number, w: number, h: number} | null) => void
  setSelectionPath: (path: Position[] | null) => void
  setSelectionMask: (mask: Set<string> | null) => void
  setSelectionTransform: (transform: 'rotate' | 'flipH' | 'flipV' | null) => void
  setSelectionMode: (mode: 'new' | 'add' | 'subtract' | 'intersect') => void
  setFloatingSelection: (floatingSelection: {dx: number, dy: number, data: any}[] | null) => void
  setDragOffset: (offset: { x: number; y: number }) => void
  setSelectionMoveOffset: (offset: { x: number; y: number }) => void

  // Interaction State
  isDragging: boolean
  dragStartPos: Position | null
  setIsDragging: (isDragging: boolean) => void
  setDragStartPos: (pos: Position | null) => void

  // Clipboard
  clipboard: { width: number, height: number, data: {x: number, y: number, data: any}[] } | null
  setClipboard: (clipboard: { width: number, height: number, data: {x: number, y: number, data: any}[] } | null) => void

  // Magic Wand Settings
  wandMode: 'color' | 'char',
  wandTolerance: number,
  setWandMode: (mode: 'color' | 'char') => void,
  setWandTolerance: (tolerance: number) => void,

  setPan: (pan: Position) => void,
  setZoom: (zoom: number) => void
  setActiveTool: (tool: ToolType) => void
  setBrushChar: (char: string) => void
  setBrushColor: (color: string) => void
  setSecondaryChar: (char: string) => void
  setSecondaryColor: (color: string) => void
  setCursorPos: (pos: { x: number; y: number }) => void
  setOnionSkinEnabled: (enabled: boolean) => void
  setGradientType: (type: 'linear' | 'radial') => void
  setGradientColors: (start: string, end: string) => void
  setShowFps: (show: boolean) => void
  toggleShowFps: () => void
  setCanvasBgColor: (color: string) => void
  setExportBgColor: (color: string | null) => void
  setShowGrid: (show: boolean) => void
  setShowCenterGuide: (show: boolean) => void
  setWorkspaceColor: (color: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTab: '2D',
  zoom: 1,
  pan: { x: 0, y: 0 },
  cameraState2D: null,
  overlayDraft: null,
  activeTool: 'brush',
  brushChar: '#',
  brushColor: '#ffffff',
  secondaryChar: '',
  secondaryColor: '#000000',
  cursorPos: { x: 0, y: 0 },
  onionSkinEnabled: false,
  gradientType: 'linear',
  gradientColorStart: '#ffffff',
  gradientColorEnd: '#000000',
  showFps: false,
  canvasBgColor: '#1a1918',
  exportBgColor: null,
  showGrid: true,
  showCenterGuide: false,
  workspaceColor: '#111111',
  renderMode3D: 'voxel',
  autoRotate3D: false,
  asciiMode3D: false,
  asciiFontSize: 5,
  asciiFillBackground3D: false,
  cameraType3D: 'persp',
  cameraZoom3D: 1,
  layerDepth3D: 0.05,
  cameraState3D: null,
  palette: [
    '#000000', '#1D2B53', '#7E2553', '#008751',
    '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
    '#FF004D', '#FFA300', '#FFEC27', '#00E436',
    '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA'
  ], // PICO-8 Palette is a great default for pixel art
  selection: null,
  selectionPath: null,
  selectionMask: null,
  selectionTransform: null,
  selectionMode: 'new',
  floatingSelection: null,
  dragOffset: { x: 0, y: 0 },
  selectionMoveOffset: { x: 0, y: 0 },
  clipboard: null,
  wandMode: 'color',
  wandTolerance: 0,

  isDragging: false,
  dragStartPos: null,
  setIsDragging: (isDragging) => set({ isDragging }),
  setDragStartPos: (dragStartPos) => set({ dragStartPos }),

  setSelection: (selection) => set({ selection }),
  setSelectionPath: (selectionPath) => set({ selectionPath }),
  setSelectionMask: (selectionMask) => set({ selectionMask }),
  setSelectionTransform: (selectionTransform) => set({ selectionTransform }),
  setSelectionMode: (selectionMode) => set({ selectionMode }),
  setFloatingSelection: (floatingSelection) => set({ floatingSelection }),
  setDragOffset: (dragOffset) => set({ dragOffset }),
  setSelectionMoveOffset: (selectionMoveOffset) => set({ selectionMoveOffset }),
  setClipboard: (clipboard) => set({ clipboard }),
  setWandMode: (wandMode) => set({ wandMode }),
  setWandTolerance: (wandTolerance) => set({ wandTolerance }),
  setActiveTab: (activeTab) =>
    set((state) => {
      if (activeTab === state.activeTab) return {}
      if (activeTab === '3D') {
        return {
          activeTab,
          cameraState2D: { pan: state.pan, zoom: state.zoom }
        }
      }
      const restore = state.cameraState2D ?? { pan: { x: 0, y: 0 }, zoom: 1 }
      return {
        activeTab,
        pan: restore.pan,
        zoom: restore.zoom
      }
    }),
  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom }),
  setOverlayDraft: (overlayDraft) => set({ overlayDraft }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushChar: (brushChar) => set({ brushChar }),
  setBrushColor: (brushColor) => set({ brushColor }),
  setSecondaryChar: (secondaryChar) => set({ secondaryChar }),
  setSecondaryColor: (secondaryColor) => set({ secondaryColor }),
  setCursorPos: (cursorPos) => set({ cursorPos }),
  setOnionSkinEnabled: (onionSkinEnabled) => set({ onionSkinEnabled }),
  setGradientType: (gradientType) => set({ gradientType }),
  setGradientColors: (start, end) => set({ gradientColorStart: start, gradientColorEnd: end }),
  setShowFps: (showFps) => set({ showFps }),
  toggleShowFps: () => set((state) => ({ showFps: !state.showFps })),
  setCanvasBgColor: (canvasBgColor) => set({ canvasBgColor }),
  setExportBgColor: (exportBgColor) => set({ exportBgColor }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowCenterGuide: (showCenterGuide) => set({ showCenterGuide }),
  setWorkspaceColor: (workspaceColor) => set({ workspaceColor }),
  setRenderMode3D: (renderMode3D) => set({ renderMode3D }),
  setAutoRotate3D: (autoRotate3D) => set({ autoRotate3D }),
  setAsciiMode3D: (asciiMode3D) => set({ asciiMode3D }),
  setAsciiFontSize: (asciiFontSize) => set({ asciiFontSize: Math.max(5, Math.min(10, asciiFontSize)) }),
  setAsciiFillBackground3D: (asciiFillBackground3D) => set({ asciiFillBackground3D }),
  setCameraType3D: (cameraType3D) => set({ cameraType3D }),
  setCameraZoom3D: (cameraZoom3D) => set({ cameraZoom3D: Math.max(0.1, Math.min(20, cameraZoom3D)) }),
  setLayerDepth3D: (layerDepth3D) => {
    const rounded = Math.round(layerDepth3D * 100) / 100
    set({ layerDepth3D: Math.max(0.0, Math.min(5, rounded)) })
  },
  setCameraState3D: (cameraState3D) => set({ cameraState3D }),
  setPalette: (palette) => set({ palette }),
  addColorToPalette: (color) => set((state) => ({ 
      palette: state.palette.includes(color) ? state.palette : [...state.palette, color] 
  })),
}))
