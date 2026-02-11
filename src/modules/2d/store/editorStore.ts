import { create } from 'zustand'
import { ToolType, Position } from '../types'

interface EditorState {
  // Viewport State
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
  canvasBgColor: string | null // null = transparent
  exportBgColor: string | null // null = transparent

  // Selection State
  selection: {x: number, y: number, w: number, h: number} | null
  selectionTransform: 'rotate' | 'flipH' | 'flipV' | null
  setSelection: (selection: {x: number, y: number, w: number, h: number} | null) => void
  setSelectionTransform: (transform: 'rotate' | 'flipH' | 'flipV' | null) => void

  // Clipboard
  clipboard: { width: number, height: number, data: {x: number, y: number, data: any}[] } | null
  setClipboard: (clipboard: { width: number, height: number, data: {x: number, y: number, data: any}[] } | null) => void

  setPan: (pan: Position) => void
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
  setCanvasBgColor: (color: string | null) => void
  setExportBgColor: (color: string | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
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
  canvasBgColor: '#111111',
  exportBgColor: null,
  selection: null,
  selectionTransform: null,
  clipboard: null,

  setSelection: (selection) => set({ selection }),
  setSelectionTransform: (selectionTransform) => set({ selectionTransform }),
  setClipboard: (clipboard) => set({ clipboard }),
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
}))
