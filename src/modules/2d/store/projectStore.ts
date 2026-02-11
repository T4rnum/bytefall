import { create } from 'zustand'
import { Frame, Layer, CellData } from '../types'

interface ProjectState {
  frames: Frame[]
  activeFrameIndex: number
  activeLayerId: string
  
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
  toggleLayerVisibility: (id: string) => void
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

export const useProjectStore = create<ProjectState>((set, get) => ({
  frames: initialFrames,
  activeFrameIndex: 0,
  activeLayerId: 'layer-1',
  width: 50,
  height: 50,
  
  history: [deepCloneFrames(initialFrames)],
  historyIndex: 0,

  setActiveLayerId: (id) => set({ activeLayerId: id }),

  setActiveFrameIndex: (index) => set({ activeFrameIndex: index }),

  setSize: (width, height) => set({ width, height }),

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
          activeFrameIndex: newFrames.length - 1 
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
          activeFrameIndex: index + 1
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
          activeFrameIndex: newActiveIndex
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
            historyIndex: newIndex
        })
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1
        set({
            frames: deepCloneFrames(history[newIndex]),
            historyIndex: newIndex
        })
    }
  },

  setCell: (x, y, cellData) => {
    const { frames, activeFrameIndex, activeLayerId } = get()
    
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
    
    set({ frames: newFrames })
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
    set({ frames: newFrames })
  },

  addLayer: (name) => {
    set(state => {
      const newFrames = state.frames.map(frame => ({
        ...frame,
        layers: [...frame.layers, {
          id: `layer-${Date.now()}`,
          name,
          visible: true,
          opacity: 1,
          data: new Map()
        }]
      }))
      
      // We should probably save snapshot after adding layer?
      // Or let user do it. Usually structure changes are also undoable.
      // For now, let's just update state. Caller can snapshot.
      return { frames: newFrames }
    })
  },
  
  toggleLayerVisibility: (id) => {
      set(state => {
          const newFrames = state.frames.map(frame => ({
              ...frame,
              layers: frame.layers.map(layer => 
                  layer.id === id ? { ...layer, visible: !layer.visible } : layer
              )
          }))
          return { frames: newFrames }
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
              historyIndex: 0
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
  }
}))
