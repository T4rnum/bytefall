import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { commitFloatingSelection, copySelection, cutSelection, deleteSelection, pasteSelection } from '../logic/selectionOps'

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || target.isContentEditable
}

export const useHotkeys = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      const { selection, selectionMask, selectionPath, setSelection, setSelectionMask, setSelectionPath, setFloatingSelection, setActiveTool, toggleShowFps } = useEditorStore.getState()
      const { width: projectWidth, height: projectHeight, undo, redo } = useProjectStore.getState()

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
          return
        }
        if (e.code === 'KeyY') {
          e.preventDefault()
          redo()
          return
        }
        if (e.code === 'KeyA') {
          e.preventDefault()
          const fullSelection = {
            x: -Math.floor(projectWidth / 2),
            y: -Math.floor(projectHeight / 2),
            w: projectWidth,
            h: projectHeight
          }
          setSelection(fullSelection)
          const newMask = new Set<string>()
          for (let y = 0; y < projectHeight; y++) {
            for (let x = 0; x < projectWidth; x++) {
              const gx = fullSelection.x + x
              const gy = fullSelection.y + y
              newMask.add(`${gx},${gy}`)
            }
          }
          setSelectionMask(newMask)
          setSelectionPath(null)
          return
        }
        if (e.code === 'KeyC') {
          e.preventDefault()
          copySelection()
          return
        }
        if (e.code === 'KeyX') {
          e.preventDefault()
          cutSelection()
          return
        }
        if (e.code === 'KeyV') {
          e.preventDefault()
          pasteSelection()
          return
        }
      }

      if (e.code === 'Escape') {
        e.preventDefault()
        commitFloatingSelection()
        setFloatingSelection(null)
        setSelection(null)
        setSelectionMask(null)
        setSelectionPath(null)
        return
      }

      if (e.code === 'Enter') {
        if (selection) {
          e.preventDefault()
          commitFloatingSelection()
        }
        return
      }

      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selection) {
          e.preventDefault()
          deleteSelection()
        }
        return
      }

      if (selection && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        e.preventDefault()
        const dx = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0
        const dy = e.code === 'ArrowUp' ? -1 : e.code === 'ArrowDown' ? 1 : 0
        setSelection({ ...selection, x: selection.x + dx, y: selection.y + dy })
        if (selectionMask) {
          const newMask = new Set<string>()
          selectionMask.forEach(k => {
            const [x, y] = k.split(',').map(Number)
            newMask.add(`${x + dx},${y + dy}`)
          })
          setSelectionMask(newMask)
        }
        if (selectionPath) {
          setSelectionPath(selectionPath.map(p => ({ x: p.x + dx, y: p.y + dy })))
        }
        return
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.code) {
          case 'KeyF': toggleShowFps(); break
          case 'KeyB': setActiveTool('brush'); break
          case 'KeyE': setActiveTool('eraser'); break
          case 'KeyG': setActiveTool('fill'); break
          case 'KeyH': setActiveTool('gradient'); break
          case 'KeyL': setActiveTool('line'); break
          case 'KeyR': setActiveTool('rectangle'); break
          case 'KeyC': setActiveTool('circle'); break
          case 'KeyI': setActiveTool('eyedropper'); break
          case 'KeyS': setActiveTool('select'); break
          case 'KeyV': setActiveTool('move'); break
          case 'KeyK': setActiveTool('lasso'); break
          case 'KeyW': setActiveTool('magicWand'); break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
