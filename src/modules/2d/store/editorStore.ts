import { create } from 'zustand'
import { ToolType, Position } from '../types'

interface EditorState {
  // Viewport State
  activeTab: '2D' | '3D'
  zoom: number
  pan: Position
  
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
  
  // Background Settings
  canvasBgColor: string // The actual canvas/project background
  exportBgColor: string | null // null = transparent

  // View Settings
  showGrid: boolean
  showCenterGuide: boolean
  workspaceColor: string // The color of the area OUTSIDE the canvas

  // 3D Settings
  renderMode3D: 'voxel' | 'plane'
  autoRotate3D: boolean
  asciiMode3D: boolean
  asciiFontSize: number
  cameraState3D: { position: [number, number, number], target: [number, number, number] } | null
  setActiveTab: (tab: '2D' | '3D') => void
  setRenderMode3D: (mode: 'voxel' | 'plane') => void
  setAutoRotate3D: (autoRotate: boolean) => void
  setAsciiMode3D: (ascii: boolean) => void
  setAsciiFontSize: (size: number) => void
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
  setSelection: (selection: {x: number, y: number, w: number, h: number} | null) => void
  setSelectionPath: (path: Position[] | null) => void
  setSelectionMask: (mask: Set<string> | null) => void
  setSelectionTransform: (transform: 'rotate' | 'flipH' | 'flipV' | null) => void
  setSelectionMode: (mode: 'new' | 'add' | 'subtract' | 'intersect') => void
  setFloatingSelection: (floatingSelection: {dx: number, dy: number, data: any}[] | null) => void

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
  canvasBgColor: '#1a1918',
  exportBgColor: null,
  showGrid: true,
  showCenterGuide: false,
  workspaceColor: '#111111',
  renderMode3D: 'voxel',
  autoRotate3D: false,
  asciiMode3D: false,
  asciiFontSize: 12,
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
  clipboard: null,
  wandMode: 'color',

  setSelection: (selection) => set({ selection }),
  setSelectionPath: (selectionPath) => set({ selectionPath }),
  setSelectionMask: (selectionMask) => set({ selectionMask }),
  setSelectionTransform: (selectionTransform) => set({ selectionTransform }),
  setSelectionMode: (selectionMode) => set({ selectionMode }),
  setFloatingSelection: (floatingSelection) => set({ floatingSelection }),
  setClipboard: (clipboard) => set({ clipboard }),
  setWandMode: (wandMode) => set({ wandMode }),
  setWandTolerance: (wandTolerance) => set({ wandTolerance }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setPan: (pan) => set({ pan }),
  setZoom: (zoom) => set({ zoom }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setBrushChar: (brushChar) => set({ brushChar }),
  setBrushColor: (brushColor) => set({ brushColor }),
  setSecondaryChar: (secondaryChar) => set({ secondaryChar }),
  setSecondaryColor: (secondaryColor) => set({ secondaryColor }),
  setCursorPos: (cursorPos) => set({ cursorPos }),
  setOnionSkinEnabled: (onionSkinEnabled) => set({ onionSkinEnabled }),
  setGradientType: (gradientType) => set({ gradientType }),
  setGradientColors: (start, end) => set({ gradientColorStart: start, gradientColorEnd: end }),
  setCanvasBgColor: (canvasBgColor) => set({ canvasBgColor }),
  setExportBgColor: (exportBgColor) => set({ exportBgColor }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowCenterGuide: (showCenterGuide) => set({ showCenterGuide }),
  setWorkspaceColor: (workspaceColor) => set({ workspaceColor }),
  setRenderMode3D: (renderMode3D) => set({ renderMode3D }),
  setAutoRotate3D: (autoRotate3D) => set({ autoRotate3D }),
  setAsciiMode3D: (asciiMode3D) => set({ asciiMode3D }),
  setAsciiFontSize: (asciiFontSize) => set({ asciiFontSize: Math.max(5, Math.min(10, asciiFontSize)) }),
  setCameraState3D: (cameraState3D) => set({ cameraState3D }),
  setPalette: (palette) => set({ palette }),
  addColorToPalette: (color) => set((state) => ({ 
      palette: state.palette.includes(color) ? state.palette : [...state.palette, color] 
  })),
}))
