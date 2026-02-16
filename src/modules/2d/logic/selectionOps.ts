import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'

export const commitFloatingSelection = () => {
  const { floatingSelection, selection, setFloatingSelection } = useEditorStore.getState()
  if (!floatingSelection || !selection) return
  const { saveSnapshot, batchUpdateCells } = useProjectStore.getState()
  saveSnapshot()
  const updates = floatingSelection.map(item => ({
    x: selection.x + item.dx,
    y: selection.y + item.dy,
    data: item.data
  }))
  batchUpdateCells(updates)
  setFloatingSelection(null)
}

export const liftSelection = () => {
  const { selection, selectionMask, setFloatingSelection } = useEditorStore.getState()
  if (!selection) return null
  const { frames, activeFrameIndex, activeLayerId, saveSnapshot, batchUpdateCells } = useProjectStore.getState()
  saveSnapshot()
  const frame = frames[activeFrameIndex]
  const activeLayer = frame?.layers.find(l => l.id === activeLayerId)
  if (!activeLayer) return null

  const items: { dx: number; dy: number; data: any }[] = []
  const updates: { x: number; y: number; data: any }[] = []

  for (let y = 0; y < selection.h; y++) {
    for (let x = 0; x < selection.w; x++) {
      const gx = selection.x + x
      const gy = selection.y + y
      const key = `${gx},${gy}`
      if (selectionMask && !selectionMask.has(key)) continue
      const cell = activeLayer.data.get(key)
      if (cell && (cell.char || cell.bgColor)) {
        items.push({ dx: x, dy: y, data: { ...cell } })
        updates.push({ x: gx, y: gy, data: { char: '', color: '' } })
      }
    }
  }

  if (updates.length > 0) {
    batchUpdateCells(updates)
  }
  setFloatingSelection(items)
  return items
}

export const copySelection = () => {
  const { selection, selectionMask, floatingSelection, setClipboard } = useEditorStore.getState()
  if (!selection) return
  const { frames, activeFrameIndex, activeLayerId } = useProjectStore.getState()
  const data: { x: number; y: number; data: any }[] = []

  if (floatingSelection) {
    floatingSelection.forEach(item => data.push({ x: item.dx, y: item.dy, data: item.data }))
  } else {
    const frame = frames[activeFrameIndex]
    const activeLayer = frame?.layers.find(l => l.id === activeLayerId)
    if (activeLayer) {
      for (let y = 0; y < selection.h; y++) {
        for (let x = 0; x < selection.w; x++) {
          const key = `${selection.x + x},${selection.y + y}`
          if (selectionMask && !selectionMask.has(key)) continue
          const cell = activeLayer.data.get(key)
          if (cell) data.push({ x, y, data: { ...cell } })
        }
      }
    }
  }
  setClipboard({ width: selection.w, height: selection.h, data })
}

export const cutSelection = () => {
  const { selection, floatingSelection, setFloatingSelection, setClipboard } = useEditorStore.getState()
  if (!selection) return

  let data: { x: number; y: number; data: any }[] = []
  if (floatingSelection) {
    data = floatingSelection.map(item => ({ x: item.dx, y: item.dy, data: item.data }))
    setFloatingSelection(null)
  } else {
    const items = liftSelection()
    if (items) data = items.map(item => ({ x: item.dx, y: item.dy, data: item.data }))
    setFloatingSelection(null)
  }

  setClipboard({ width: selection.w, height: selection.h, data })
}

export const pasteSelection = () => {
  const { clipboard, floatingSelection, selection, setFloatingSelection, setSelection, setSelectionMask, setSelectionPath, cursorPos } = useEditorStore.getState()
  if (!clipboard) return
  if (floatingSelection && selection) {
    commitFloatingSelection()
  }

  const newFloating = clipboard.data.map(item => ({
    dx: item.x,
    dy: item.y,
    data: item.data
  }))

  const targetX = cursorPos?.x ?? 0
  const targetY = cursorPos?.y ?? 0
  setSelection({ x: targetX, y: targetY, w: clipboard.width, h: clipboard.height })
  setSelectionMask(null)
  setSelectionPath(null)
  setFloatingSelection(newFloating)
}

export const deleteSelection = () => {
  const { selection, selectionMask, floatingSelection, setFloatingSelection, setSelection, setSelectionMask, setSelectionPath } = useEditorStore.getState()
  if (!selection) return
  if (floatingSelection) {
    setFloatingSelection(null)
    setSelection(null)
    setSelectionMask(null)
    setSelectionPath(null)
    return
  }
  const { deleteSelection: deleteSelectionAction } = useProjectStore.getState()
  deleteSelectionAction(selection, selectionMask)
  setSelection(null)
  setSelectionMask(null)
  setSelectionPath(null)
}
