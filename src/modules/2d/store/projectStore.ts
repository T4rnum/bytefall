import { create } from 'zustand'
import { Frame, Layer, CellData } from '../types'
import { useEditorStore } from './editorStore'

interface ProjectState {
  frames: Frame[]
  activeFrameIndex: number
  activeLayerId: string
  frameVersion: number
  lastUpdates: { updates: { x: number; y: number; data: CellData }[]; frameIndex: number; layerId: string; opacity: number } | null
  
  // Canvas Dimensions
  width: number
  height: number
  setSize: (width: number, height: number) => void
  
  // History
  history: Frame[][]
  historyIndex: number

  // Actions
  setCell: (x: number, y: number, data: CellData) => void
  batchUpdateCells: (updates: { x: number; y: number; data: CellData }[]) => void
  addLayer: (name: string) => void
  deleteLayer: (id: string) => void
  renameLayer: (id: string, name: string) => void
  toggleLayerVisibility: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  updateLayer: (id: string, updates: Partial<Layer>) => void
  setActiveLayerId: (id: string) => void
  
  // Frame Actions
  addFrame: () => void
  duplicateFrame: (index: number) => void
  deleteFrame: (index: number) => void
  setActiveFrameIndex: (index: number) => void
  
  saveSnapshot: () => void
  undo: () => void
  redo: () => void
  loadProject: (jsonContent: string) => void
  exportProject: () => string

  // Selection Logic
  copyToClipboard: (selection: {x: number, y: number, w: number, h: number}, mask: Set<string> | null) => void
  pasteFromClipboard: (x: number, y: number) => {dx: number, dy: number, data: any}[] | null
  deleteSelection: (selection: {x: number, y: number, w: number, h: number}, mask: Set<string> | null) => void
}

const createInitialLayer = (): Layer => ({
  id: 'layer-1',
  name: 'Layer 1',
  visible: true,
  opacity: 1,
  data: new Map()
})

const createInitialFrame = (): Frame => ({
  id: 'frame-1',
  layers: [createInitialLayer()]
})

// Deep clone helper
const deepCloneFrames = (frames: Frame[]): Frame[] => {
  return frames.map(frame => ({
    ...frame,
    layers: frame.layers.map(layer => ({
      ...layer,
      data: new Map(JSON.parse(JSON.stringify(Array.from(layer.data.entries()))))
    }))
  }))
}

const initialFrames = [createInitialFrame()]
const LARGE_UPDATE_THRESHOLD = 2000

export const useProjectStore = create<ProjectState>((set, get) => ({
  frames: initialFrames,
  activeFrameIndex: 0,
  activeLayerId: 'layer-1',
  frameVersion: 0,
  lastUpdates: null,
  width: 51,
  height: 51,
  
  history: [deepCloneFrames(initialFrames)],
  historyIndex: 0,

  setActiveLayerId: (id) => {
    const editor = useEditorStore.getState()
    const { selection, floatingSelection } = editor
    if (selection && floatingSelection) {
      const updates = floatingSelection.map(item => ({
        x: selection.x + item.dx,
        y: selection.y + item.dy,
        data: item.data
      }))
      if (updates.length > 0) {
        get().saveSnapshot()
        get().batchUpdateCells(updates)
      }
      editor.setFloatingSelection(null)
    }
    set({ activeLayerId: id })
  },

  setActiveFrameIndex: (index) => set(state => ({ activeFrameIndex: index, frameVersion: state.frameVersion + 1, lastUpdates: null })),

  setSize: (width, height) => set(state => ({ width, height, frameVersion: state.frameVersion + 1, lastUpdates: null })),

  addFrame: () => {
      const { frames, saveSnapshot } = get()
      saveSnapshot()
      
      const newFrame = createInitialFrame()
      newFrame.id = `frame-${frames.length + 1}`
      // Copy layer structure from previous frame but empty data
      if (frames.length > 0) {
          const prevFrame = frames[frames.length - 1]
          newFrame.layers = prevFrame.layers.map(l => ({
              ...l,
              data: new Map()
          }))
      }
      
      const newFrames = [...frames, newFrame]
      set({ 
          frames: newFrames,
          activeFrameIndex: newFrames.length - 1,
          frameVersion: get().frameVersion + 1,
          lastUpdates: null
      })
  },

  duplicateFrame: (index) => {
      const { frames, saveSnapshot } = get()
      saveSnapshot()
      
      const sourceFrame = frames[index]
      if (!sourceFrame) return

      const newFrame = {
          ...sourceFrame,
          id: `frame-${Date.now()}`, // Simple ID generation
          layers: sourceFrame.layers.map(l => ({
              ...l,
              data: new Map(JSON.parse(JSON.stringify(Array.from(l.data.entries())))) as Map<string, CellData>
          }))
      }

      const newFrames = [...frames]
      newFrames.splice(index + 1, 0, newFrame)
      
      set({ 
          frames: newFrames,
          activeFrameIndex: index + 1,
          frameVersion: get().frameVersion + 1,
          lastUpdates: null
      })
  },

  deleteFrame: (index) => {
      const { frames, activeFrameIndex, saveSnapshot } = get()
      if (frames.length <= 1) return // Keep at least one frame
      
      saveSnapshot()
      
      const newFrames = frames.filter((_, i) => i !== index)
      let newActiveIndex = activeFrameIndex
      
      if (index <= activeFrameIndex) {
          newActiveIndex = Math.max(0, activeFrameIndex - 1)
      }
      
      set({ 
          frames: newFrames,
          activeFrameIndex: newActiveIndex,
          frameVersion: get().frameVersion + 1,
          lastUpdates: null
      })
  },

  saveSnapshot: () => {
    const { frames, history, historyIndex } = get()
    // Slice history to current index (removing any redos if we branch off)
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(deepCloneFrames(frames))
    
    // Limit history size to 50
    if (newHistory.length > 50) {
        newHistory.shift()
    }
    
    set({ 
        history: newHistory,
        historyIndex: newHistory.length - 1
    })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        set({
            frames: deepCloneFrames(history[newIndex]),
            historyIndex: newIndex,
            frameVersion: get().frameVersion + 1,
            lastUpdates: null
        })
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        set({
            frames: deepCloneFrames(history[newIndex]),
            historyIndex: newIndex,
            frameVersion: get().frameVersion + 1,
            lastUpdates: null
        })
    }
  },

  setCell: (x, y, cellData) => {
    const { frames, activeFrameIndex, activeLayerId } = get()
    
    // Save snapshot before the first edit in a sequence if needed, 
    // but usually tool calls handle this. For individual pixel drawing,
    // we might want to be careful not to spam history.
    // However, the request is for "remembering actions".
    
    const newFrames = [...frames]
    const currentFrame = { ...newFrames[activeFrameIndex] }
    newFrames[activeFrameIndex] = currentFrame
    
    const layerIndex = currentFrame.layers.findIndex(l => l.id === activeLayerId)
    if (layerIndex === -1) return

    const currentLayer = { ...currentFrame.layers[layerIndex] }
    currentFrame.layers[layerIndex] = currentLayer
    
    const newData = new Map(currentLayer.data)
    const key = `${x},${y}`
    
    if (cellData.char === '' && !cellData.bgColor) {
        newData.delete(key)
    } else {
        newData.set(key, cellData)
    }
    
    currentLayer.data = newData
    
    set({
      frames: newFrames,
      lastUpdates: { updates: [{ x, y, data: cellData }], frameIndex: activeFrameIndex, layerId: activeLayerId, opacity: currentLayer.opacity }
    })
  },

  batchUpdateCells: (updates) => {
    const { frames, activeFrameIndex, activeLayerId } = get()
    const newFrames = [...frames]
    const currentFrame = { ...newFrames[activeFrameIndex] }
    newFrames[activeFrameIndex] = currentFrame
    
    const layerIndex = currentFrame.layers.findIndex(l => l.id === activeLayerId)
    if (layerIndex === -1) return

    const currentLayer = { ...currentFrame.layers[layerIndex] }
    currentFrame.layers[layerIndex] = currentLayer
    
    const newData = new Map(currentLayer.data)
    
    updates.forEach(({ x, y, data }) => {
        const key = `${x},${y}`
        if (data.char === '' && !data.bgColor) {
            newData.delete(key)
        } else {
            newData.set(key, data)
        }
    })
    
    currentLayer.data = newData
    if (updates.length > LARGE_UPDATE_THRESHOLD) {
      set({
        frames: newFrames,
        frameVersion: get().frameVersion + 1,
        lastUpdates: null
      })
    } else {
      set({
        frames: newFrames,
        lastUpdates: { updates, frameIndex: activeFrameIndex, layerId: activeLayerId, opacity: currentLayer.opacity }
      })
    }
  },

  deleteLayer: (id) => {
    const { frames, activeLayerId, saveSnapshot } = get()
    // Don't delete last layer
    if (frames[0].layers.length <= 1) return

    saveSnapshot()
    const newFrames = frames.map(frame => ({
      ...frame,
      layers: frame.layers.filter(l => l.id !== id)
    }))

    const newState: Partial<ProjectState> = { frames: newFrames }
    if (activeLayerId === id) {
      newState.activeLayerId = newFrames[0].layers[0].id
    }
    set({ ...newState, frameVersion: get().frameVersion + 1, lastUpdates: null })
  },

  renameLayer: (id, name) => {
    const { frames } = get()
    const newFrames = frames.map(frame => ({
      ...frame,
      layers: frame.layers.map(l => l.id === id ? { ...l, name } : l)
    }))
    set({ frames: newFrames, frameVersion: get().frameVersion + 1, lastUpdates: null })
  },

  setLayerOpacity: (id, opacity) => {
    const { frames } = get()
    const newFrames = frames.map(frame => ({
      ...frame,
      layers: frame.layers.map(l => l.id === id ? { ...l, opacity } : l)
    }))
    set({ frames: newFrames, frameVersion: get().frameVersion + 1, lastUpdates: null })
  },

  updateLayer: (id, updates) => {
    const { frames } = get()
    const newFrames = frames.map(frame => ({
      ...frame,
      layers: frame.layers.map(l => l.id === id ? { ...l, ...updates } : l)
    }))
    set({ frames: newFrames, frameVersion: get().frameVersion + 1, lastUpdates: null })
  },

  addLayer: (name) => {
    const { frames, saveSnapshot } = get()
    saveSnapshot()
    
    const newId = `layer-${Date.now()}`
    const newFrames = frames.map(frame => ({
      ...frame,
      layers: [...frame.layers, {
        id: newId,
        name,
        visible: true,
        opacity: 1,
        data: new Map()
      }]
    }))
    
    set({ frames: newFrames, activeLayerId: newId, frameVersion: get().frameVersion + 1, lastUpdates: null })
  },
  
  toggleLayerVisibility: (id) => {
      set(state => {
          const newFrames = state.frames.map(frame => ({
              ...frame,
              layers: frame.layers.map(layer => 
                  layer.id === id ? { ...layer, visible: !layer.visible } : layer
              )
          }))
          return { frames: newFrames, frameVersion: state.frameVersion + 1, lastUpdates: null }
      })
  },

  loadProject: (jsonContent: string) => {
      try {
          const parsed = JSON.parse(jsonContent)
          if (!Array.isArray(parsed)) throw new Error("Invalid project file")
          
          const frames: Frame[] = parsed.map((f: any) => ({
              ...f,
              layers: f.layers.map((l: any) => ({
                  ...l,
                  data: new Map(l.data)
              }))
          }))
          
          set({ 
              frames, 
              activeFrameIndex: 0,
              activeLayerId: frames[0]?.layers[0]?.id || 'layer-1',
              history: [deepCloneFrames(frames)],
              historyIndex: 0,
              frameVersion: get().frameVersion + 1,
              lastUpdates: null
          })
      } catch (e) {
          console.error("Failed to load project", e)
      }
  },

  exportProject: () => {
      const { frames } = get()
      return JSON.stringify(frames.map(f => ({
          ...f,
          layers: f.layers.map(l => ({
              ...l,
              data: Array.from(l.data.entries())
          }))
      })))
  },

  copyToClipboard: (selection, mask) => {
    const { frames, activeFrameIndex, activeLayerId } = get()
    const frame = frames[activeFrameIndex]
    const layer = frame?.layers.find(l => l.id === activeLayerId)
    if (!layer) return

    const clipboard: {dx: number, dy: number, data: any}[] = []
    for (let y = 0; y < selection.h; y++) {
        for (let x = 0; x < selection.w; x++) {
            const gx = selection.x + x
            const gy = selection.y + y
            const key = `${gx},${gy}`
            if (mask && !mask.has(key)) continue

            const cell = layer.data.get(key)
            if (cell) {
                clipboard.push({ dx: x, dy: y, data: { ...cell } })
            }
        }
    }
    // We can't use useEditorStore directly here to avoid circular deps if any
    // Instead we will let the component call setClipboard
    // But for simplicity in this project's structure, we might need a better way
    // Let's assume the component will handle the store update
  },

  pasteFromClipboard: (_x, _y) => {
    // This will be handled by the component using the clipboard data from editorStore
    return null 
  },

  deleteSelection: (selection, mask) => {
    const { frames, activeFrameIndex, activeLayerId, batchUpdateCells, saveSnapshot } = get()
    const frame = frames[activeFrameIndex]
    const layer = frame?.layers.find(l => l.id === activeLayerId)
    if (!layer) return

    saveSnapshot()
    const updates: {x: number, y: number, data: any}[] = []
    for (let sy = 0; sy < selection.h; sy++) {
        for (let sx = 0; sx < selection.w; sx++) {
            const gx = selection.x + sx
            const gy = selection.y + sy
            const key = `${gx},${gy}`
            if (mask && !mask.has(key)) continue
            
            if (layer.data.has(key)) {
                updates.push({ x: gx, y: gy, data: { char: '', color: '' } })
            }
        }
    }
    batchUpdateCells(updates)
  }
}))
