import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { Position } from '../types'
import styles from './CanvasRenderer.module.scss'

const GRID_SIZE = 20 // Pixel size of one grid cell
const FONT_SIZE = 16
// Removed constants GRID_COLS and GRID_ROWS in favor of store values

// Helper to interpolate colors
function interpolateColor(color1: string, color2: string, factor: number) {
    if (factor === 0) return color1
    if (factor === 1) return color2
    
    const c1 = hexToRgb(color1)
    const c2 = hexToRgb(color2)
    
    const r = Math.round(c1.r + (c2.r - c1.r) * factor)
    const g = Math.round(c1.g + (c2.g - c1.g) * factor)
    const b = Math.round(c1.b + (c2.b - c1.b) * factor)
    
    return `rgb(${r}, ${g}, ${b})`
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
}

function getLinePoints(x0: number, y0: number, x1: number, y1: number) {
    const points: {x: number, y: number}[] = []
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx - dy

    let x = x0
    let y = y0

    while (true) {
        points.push({ x, y })
        if (x === x1 && y === y1) break
        const e2 = 2 * err
        if (e2 > -dy) {
            err -= dy
            x += sx
        }
        if (e2 < dx) {
            err += dx
            y += sy
        }
    }
    return points
}

function getRectPoints(x0: number, y0: number, x1: number, y1: number) {
    const points: {x: number, y: number}[] = []
    const minX = Math.min(x0, x1)
    const maxX = Math.max(x0, x1)
    const minY = Math.min(y0, y1)
    const maxY = Math.max(y0, y1)

    // Top and Bottom
    for (let x = minX; x <= maxX; x++) {
        points.push({ x, y: minY })
        points.push({ x, y: maxY })
    }
    // Left and Right
    for (let y = minY + 1; y < maxY; y++) {
        points.push({ x: minX, y })
        points.push({ x: maxX, y })
    }
    return points
}

function getCirclePoints(x0: number, y0: number, x1: number, y1: number) {
    const points: {x: number, y: number}[] = []
    const r = Math.round(Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2)))
    let x = r
    let y = 0
    let radiusError = 1 - x

    const added = new Set<string>()
    const addPoint = (px: number, py: number) => {
        const key = `${px},${py}`
        if (!added.has(key)) {
            points.push({ x: px, y: py })
            added.add(key)
        }
    }

    while (x >= y) {
        addPoint(x + x0, y + y0)
        addPoint(y + x0, x + y0)
        addPoint(-x + x0, y + y0)
        addPoint(-y + x0, x + y0)
        addPoint(-x + x0, -y + y0)
        addPoint(-y + x0, -x + y0)
        addPoint(x + x0, -y + y0)
        addPoint(y + x0, -x + y0)
        y++
        
        if (radiusError < 0) {
            radiusError += 2 * y + 1
        } else {
            x--
            radiusError += 2 * (y - x + 1)
        }
    }
    return points
}

export function CanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const zoom = useEditorStore(state => state.zoom)
  const setZoom = useEditorStore(state => state.setZoom)
  const pan = useEditorStore(state => state.pan)
  const setPan = useEditorStore(state => state.setPan)
  const activeTool = useEditorStore(state => state.activeTool)
  const brushChar = useEditorStore(state => state.brushChar)
  const brushColor = useEditorStore(state => state.brushColor)
  const secondaryChar = useEditorStore(state => state.secondaryChar)
  const secondaryColor = useEditorStore(state => state.secondaryColor)
  const onionSkinEnabled = useEditorStore(state => state.onionSkinEnabled)
  const gradientType = useEditorStore(state => state.gradientType)
  const gradientColorStart = useEditorStore(state => state.gradientColorStart)
  const gradientColorEnd = useEditorStore(state => state.gradientColorEnd)
  const canvasBgColor = useEditorStore(state => state.canvasBgColor)
  const showGrid = useEditorStore(state => state.showGrid)
  const showCenterGuide = useEditorStore(state => state.showCenterGuide)
  const workspaceColor = useEditorStore(state => state.workspaceColor)
  const setClipboard = useEditorStore(state => state.setClipboard)
  
  // Magic Wand settings
  const wandMode = useEditorStore(state => state.wandMode)
  const wandTolerance = useEditorStore(state => state.wandTolerance)
  
  // Selection from Store
  const selection = useEditorStore(state => state.selection)
  const setSelection = useEditorStore(state => state.setSelection)
  const selectionPath = useEditorStore(state => state.selectionPath)
  const setSelectionPath = useEditorStore(state => state.setSelectionPath)
  const selectionMask = useEditorStore(state => state.selectionMask)
  const setSelectionMask = useEditorStore(state => state.setSelectionMask)
  const selectionTransform = useEditorStore(state => state.selectionTransform)
  const setSelectionTransform = useEditorStore(state => state.setSelectionTransform)
  const selectionMode = useEditorStore(state => state.selectionMode)
  const floatingSelection = useEditorStore(state => state.floatingSelection)
  const setFloatingSelection = useEditorStore(state => state.setFloatingSelection)

  const { frames, activeFrameIndex, activeLayerId, setCell, batchUpdateCells, saveSnapshot, undo, redo, width: projectWidth, height: projectHeight, deleteSelection } = useProjectStore()
  const clipboard = useEditorStore(state => state.clipboard)
  
  const [isDragging, setIsDragging] = useState(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const lastEventRef = useRef<React.MouseEvent | KeyboardEvent | null>(null)
  const isRightClick = useRef(false)
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null)
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null)

  // Track modifiers for reactive preview
  const [modifiers, setModifiers] = useState({ shift: false, alt: false })
  const [tempMask, setTempMask] = useState<Set<string> | null>(null)

  // Floating Selection is now global
  const [isMovingSelection, setIsMovingSelection] = useState(false)
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0})

  const updateSelectionBounds = (mask: Set<string>) => {
    if (mask.size === 0) {
      setSelection(null)
      return
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    mask.forEach(key => {
      const [x, y] = key.split(',').map(Number)
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    })
    setSelection({
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1
    })
  }

  // Commit floating selection when switching active tool
  useEffect(() => {
    if (floatingSelection && selection && activeTool !== 'select' && activeTool !== 'lasso' && activeTool !== 'magicWand') {
      saveSnapshot()
      const updates = floatingSelection.map(item => ({
          x: selection.x + item.dx,
          y: selection.y + item.dy,
          data: item.data
      }))
      batchUpdateCells(updates)
      setFloatingSelection(null)
    }
  }, [activeTool])

  const isPointInSelection = useCallback((x: number, y: number) => {
    // If we are currently moving selection, only allows editing what's inside the moving part
    // But usually while moving we don't allow drawing.
    if (isMovingSelection) return false

    if (!selection) return true // No selection means everything is editable
    
    if (selectionMask) {
        return selectionMask.has(`${x},${y}`)
    }
    
    return x >= selection.x && x < selection.x + selection.w &&
           y >= selection.y && y < selection.y + selection.h
  }, [selection, selectionMask])

  // Helper to lift selection from canvas to floating state
  const liftSelection = () => {
    if (!selection) return null
    
    saveSnapshot()
    
    const frame = frames[activeFrameIndex]
    const activeLayer = frame?.layers.find(l => l.id === activeLayerId)
    
    const items: {dx: number, dy: number, data: any}[] = []
    const updates: {x: number, y: number, data: any}[] = []

    if (activeLayer) {
        for(let y = 0; y < selection.h; y++) {
            for(let x = 0; x < selection.w; x++) {
                const gx = selection.x + x
                const gy = selection.y + y
                const key = `${gx},${gy}`
                
                // If we have a mask (Lasso/Wand), check it
                if (selectionMask && !selectionMask.has(key)) continue

                const cell = activeLayer.data.get(key)
                
                if (cell && (cell.char || cell.bgColor)) {
                    items.push({
                        dx: x,
                        dy: y,
                        data: { ...cell }
                    })
                    updates.push({ x: gx, y: gy, data: { char: '', color: '' } })
                }
            }
        }
    }
    
    batchUpdateCells(updates)
    setFloatingSelection(items)
    return items
  }

  // Handle Selection Transform (Rotate, Flip)
  useEffect(() => {
      if (!selectionTransform || !selection) return

      let currentFloating = floatingSelection
      
      // If not floating yet, lift it
      if (!currentFloating) {
          currentFloating = liftSelection()
      }

      if (!currentFloating) {
          setSelectionTransform(null)
          return
      }

      // Perform Transform
      const { w, h } = selection
      let newW = w
      let newH = h
      let newFloating = []

      if (selectionTransform === 'rotate') {
          // Rotate 90 deg clockwise
          newW = h
          newH = w
          newFloating = currentFloating.map(item => ({
              dx: newW - 1 - item.dy, // x' = h - 1 - y
              dy: item.dx,            // y' = x
              data: item.data
          }))
      } else if (selectionTransform === 'flipH') {
          // Flip Horizontal
          newFloating = currentFloating.map(item => ({
              dx: w - 1 - item.dx,
              dy: item.dy,
              data: item.data
          }))
      } else if (selectionTransform === 'flipV') {
          // Flip Vertical
          newFloating = currentFloating.map(item => ({
              dx: item.dx,
              dy: h - 1 - item.dy,
              data: item.data
          }))
      } else {
          newFloating = currentFloating
      }

      setFloatingSelection(newFloating)
      setSelection({
          ...selection,
          w: newW,
          h: newH
      })
      setSelectionTransform(null)

  }, [selectionTransform, selection, floatingSelection, frames, activeFrameIndex, activeLayerId, liftSelection])


  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const updateSize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      draw()
    }

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)
    updateSize()

    return () => resizeObserver.disconnect()
  }, [])

  // Keyboard and Global Mouse Listeners
  useEffect(() => {
    const handleMouseLeave = () => {
        setIsDragging(false)
        setTempMask(null)
        setStartPos(null)
        setIsMovingSelection(false)
    }

    const container = containerRef.current
    if (container) {
        container.addEventListener('mouseleave', handleMouseLeave)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        lastEventRef.current = e
        setModifiers({ shift: e.shiftKey, alt: e.altKey })

        // Ignore if typing in an input
        if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
            return
        }

        // Select All: Ctrl+A or Ctrl+Ф
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyA' || e.key === 'a' || e.key === 'ф' || e.key === 'Ф')) {
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

        // Copy: Ctrl+C or Ctrl+С
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.key === 'c' || e.key === 'с' || e.key === 'С')) {
            e.preventDefault()
            if (!selection) return

            let data: {x: number, y: number, data: any}[] = []
            let width = selection.w
            let height = selection.h

            if (floatingSelection) {
                // Copy floating selection
                data = floatingSelection.map(item => ({
                    x: item.dx,
                    y: item.dy,
                    data: item.data
                }))
            } else {
                // Copy from canvas
                const frame = frames[activeFrameIndex]
                const activeLayer = frame?.layers.find(l => l.id === activeLayerId)
                if (activeLayer) {
                    for(let y = 0; y < selection.h; y++) {
                        for(let x = 0; x < selection.w; x++) {
                            const key = `${selection.x + x},${selection.y + y}`
                            if (selectionMask && !selectionMask.has(key)) continue
                            const cell = activeLayer.data.get(key)
                            if (cell) {
                                data.push({
                                    x, y,
                                    data: { ...cell }
                                })
                            }
                        }
                    }
                }
            }
            setClipboard({ width, height, data })
            return
        }

        // Cut: Ctrl+X or Ctrl+Ч
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyX' || e.key === 'x' || e.key === 'ч' || e.key === 'Ч')) {
            e.preventDefault()
            if (!selection) return

            let data: {x: number, y: number, data: any}[] = []
            let width = selection.w
            let height = selection.h

            if (floatingSelection) {
                data = floatingSelection.map(item => ({
                    x: item.dx, y: item.dy, data: item.data
                }))
                setFloatingSelection(null) // Clear floating
            } else {
                // Reuse lift logic but for cutting (don't set floating, just get items)
                const items = liftSelection()
                if (items) {
                    data = items.map(item => ({ x: item.dx, y: item.dy, data: item.data }))
                    setFloatingSelection(null)
                }
            }
            setClipboard({ width, height, data })
            return
        }

        // Paste: Ctrl+V or Ctrl+М
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v' || e.key === 'м' || e.key === 'М')) {
            e.preventDefault()
            const currentClipboard = useEditorStore.getState().clipboard
            if (!currentClipboard) return

            const performPaste = () => {
                 // Commit existing floating selection if any
                if (floatingSelection && selection) {
                    saveSnapshot()
                    const updates = floatingSelection.map(item => ({
                        x: selection.x + item.dx,
                        y: selection.y + item.dy,
                        data: item.data
                    }))
                    batchUpdateCells(updates)
                }

                // Create new floating selection from clipboard
                const newFloating = currentClipboard.data.map(item => ({
                    dx: item.x,
                    dy: item.y,
                    data: item.data
                }))

                // Position at mouse cursor or center of screen
                const targetX = hoverPos ? hoverPos.x : 0
                const targetY = hoverPos ? hoverPos.y : 0

                setSelection({
                    x: targetX,
                    y: targetY,
                    w: currentClipboard.width,
                    h: currentClipboard.height
                })
                setSelectionMask(null)
                setSelectionPath(null)
                setFloatingSelection(newFloating)
            }

            if (activeTool !== 'select') {
                useEditorStore.getState().setActiveTool('select')
                setTimeout(performPaste, 50)
            } else {
                performPaste()
            }
            return
        }
        
        // Enter / Esc: Commit
        if (e.key === 'Escape' || e.code === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            
            if (floatingSelection && selection) {
                // Commit floating selection
                saveSnapshot()
                const updates = floatingSelection.map(item => ({
                    x: selection.x + item.dx,
                    y: selection.y + item.dy,
                    data: item.data
                }))
                batchUpdateCells(updates)
                setFloatingSelection(null)
            }
            
            setSelection(null)
            setSelectionPath(null)
            setSelectionMask(null)
            setIsMovingSelection(false)
            return
        }

        if (e.key === 'Enter' || e.code === 'Enter') {
             if (floatingSelection && selection) {
                e.preventDefault()
                e.stopPropagation()
                // Enter: Commit
                saveSnapshot()
                const updates = floatingSelection.map(item => ({
                    x: selection.x + item.dx,
                    y: selection.y + item.dy,
                    data: item.data
                }))
                batchUpdateCells(updates)
                setFloatingSelection(null)
             }
             return
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault()
            if (e.shiftKey) {
                redo()
            } else {
                undo()
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault()
            redo()
        } else if (e.code === 'Delete' || e.code === 'Backspace') {
            if (selection && !isMovingSelection) {
                // Delete selection content
                e.preventDefault()
                
                if (floatingSelection) {
                    setFloatingSelection(null)
                    setSelection(null)
                    setSelectionMask(null)
                } else {
                    saveSnapshot()
                    
                    const updates = []
                    if (selectionMask) {
                        selectionMask.forEach(key => {
                            const [x, y] = key.split(',').map(Number)
                            updates.push({ x, y, data: { char: '', color: '' } })
                        })
                    } else {
                        for(let y = 0; y < selection.h; y++) {
                            for(let x = 0; x < selection.w; x++) {
                                updates.push({
                                    x: selection.x + x,
                                    y: selection.y + y,
                                    data: { char: '', color: '' }
                                })
                            }
                        }
                    }
                    batchUpdateCells(updates)
                    setSelection(null)
                    setSelectionMask(null)
                    setStartPos(null)
                    setIsDragging(false)
                }
            } else if (activeTool === 'brush') {
                // Set secondary char to empty (Eraser analog for RMB)
                useEditorStore.getState().setSecondaryChar('')
            }
        } else {
            // Tool Shortcuts - Using e.code for layout-agnostic hotkeys
        switch(e.code) {
            case 'ArrowLeft':
                if (selection) {
                    e.preventDefault()
                    const dx = -1, dy = 0
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
                }
                break
            case 'ArrowRight':
                if (selection) {
                    e.preventDefault()
                    const dx = 1, dy = 0
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
                }
                break
            case 'ArrowUp':
                if (selection) {
                    e.preventDefault()
                    const dx = 0, dy = -1
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
                }
                break
            case 'ArrowDown':
                if (selection) {
                    e.preventDefault()
                    const dx = 0, dy = 1
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
                }
                break
            case 'KeyB': useEditorStore.getState().setActiveTool('brush'); break;
                case 'KeyE': useEditorStore.getState().setActiveTool('eraser'); break;
                case 'KeyG': useEditorStore.getState().setActiveTool('fill'); break;
                case 'KeyH': useEditorStore.getState().setActiveTool('gradient'); break;
                case 'KeyL': useEditorStore.getState().setActiveTool('line'); break;
                case 'KeyR': useEditorStore.getState().setActiveTool('rectangle'); break;
                case 'KeyC': useEditorStore.getState().setActiveTool('circle'); break;
                case 'KeyI': useEditorStore.getState().setActiveTool('eyedropper'); break;
                case 'KeyS': useEditorStore.getState().setActiveTool('select'); break;
            case 'KeyV': useEditorStore.getState().setActiveTool('move'); break;
            case 'KeyK': useEditorStore.getState().setActiveTool('lasso'); break;
                case 'KeyW': useEditorStore.getState().setActiveTool('magicWand'); break;
            }
        }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
        setModifiers({ shift: e.shiftKey, alt: e.altKey })
    }

    const handleGlobalMouseUp = () => {
        if (isDragging) {
            setIsDragging(false)
            setStartPos(null)
        }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    
    return () => {
        if (container) {
            container.removeEventListener('mouseleave', handleMouseLeave)
        }
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
        window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [undo, redo, activeTool, selection, selectionMask, isMovingSelection, isDragging, saveSnapshot, batchUpdateCells, frames, activeFrameIndex, activeLayerId, floatingSelection, hoverPos, setSelection, setClipboard, liftSelection, projectWidth, projectHeight])


  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        // e.preventDefault() // React SyntheticEvent doesn't support preventing default on wheel for zoom sometimes, handled in useEffect usually
        // But for passive listeners it's complex.
    }
    // Simple zoom logic
    const delta = -Math.sign(e.deltaY)
    const factor = 0.1
    const newZoom = Math.max(0.1, Math.min(10, zoom + delta * factor))
    setZoom(newZoom)
  }

  const floodFill = (startX: number, startY: number, newChar: string, newColor: string) => {
    const frame = frames[activeFrameIndex]
    const layer = frame?.layers.find(l => l.id === activeLayerId)
    if (!layer) return

    const startKey = `${startX},${startY}`
    const startCell = layer.data.get(startKey)
    const targetChar = startCell?.char || ''
    const targetColor = startCell?.color || ''

    if (targetChar === newChar && targetColor === newColor) return

    const queue: [number, number][] = [[startX, startY]]
    const visited = new Set([startKey])
    const updates: {x: number, y: number, data: any}[] = []

    while (queue.length > 0) {
        const [x, y] = queue.shift()!
        const key = `${x},${y}`
        
        // Skip if not in selection
        if (!isPointInSelection(x, y)) {
            continue
        }

        const current = layer.data.get(key)
        
        updates.push({ 
            x, y, 
            data: { 
                char: newChar, 
                color: newColor,
                bgColor: current?.bgColor || ''
            } 
        })

        const neighbors = [
            [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
        ]

        for (const [nx, ny] of neighbors) {
            const key = `${nx},${ny}`
            if (nx < -projectWidth / 2 || nx >= projectWidth / 2 || ny < -projectHeight / 2 || ny >= projectHeight / 2) continue
            if (visited.has(key)) continue

            const cell = layer.data.get(key)
            const char = cell?.char || ''
            const color = cell?.color || ''

            if (char === targetChar && color === targetColor) {
                visited.add(key)
                queue.push([nx, ny] as [number, number])
            }
        }
    }

    saveSnapshot()
    batchUpdateCells(updates)
  }

  // Draw Function
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas (the whole window area)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Fill the background of the entire viewport with workspace color
    ctx.fillStyle = workspaceColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply transformation
    ctx.save()
    ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2)
    ctx.scale(zoom, zoom)

    // Draw the actual Canvas/Project area
    const width = projectWidth * GRID_SIZE
    const height = projectHeight * GRID_SIZE
    ctx.fillStyle = canvasBgColor
    ctx.fillRect(-width / 2, -height / 2, width, height)

    // Draw Grid and Content
    if (showGrid) {
        drawGrid(ctx)
    }
    
    // Draw Center Guide
    if (showCenterGuide) {
        drawCenterGuide(ctx)
    }
    
    // Draw Onion Skin (Previous Frame)
    if (onionSkinEnabled && activeFrameIndex > 0) {
        drawOnionSkin(ctx)
    }

    drawContent(ctx)
    
    // Draw Floating Selection
    if (floatingSelection && selection) {
        drawFloatingSelection(ctx)
    }

    // Draw Preview for Line/Rectangle
    if (isDragging && startPos && hoverPos && activeTool !== 'select') {
       drawPreview(ctx)
    }

    // Draw Selection Rect
    if (selection || (isDragging && startPos && (activeTool === 'select' || activeTool === 'lasso'))) {
        drawSelectionRect(ctx)
    }

    // Draw Cursor/Highlight
    if (hoverPos) {
      drawCursor(ctx, hoverPos.x, hoverPos.y)
    }

    ctx.restore()
  }, [pan, zoom, workspaceColor, showGrid, showCenterGuide, onionSkinEnabled, activeFrameIndex, frames, activeLayerId, floatingSelection, selection, selectionMask, selectionPath, isDragging, startPos, hoverPos, activeTool, canvasBgColor, projectWidth, projectHeight, secondaryChar, brushChar, secondaryColor, brushColor])

    // Request Animation Frame for smooth rendering
    useEffect(() => {
      let animationFrameId: number
  
      const render = () => {
        draw()
        animationFrameId = requestAnimationFrame(render)
      }
      
      render()
      return () => cancelAnimationFrame(animationFrameId)
    }, [draw])

  const drawCenterGuide = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#ffcc00'
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    // Vertical
    ctx.moveTo(0, -projectHeight * GRID_SIZE / 2)
    ctx.lineTo(0, projectHeight * GRID_SIZE / 2)
    // Horizontal
    ctx.moveTo(-projectWidth * GRID_SIZE / 2, 0)
    ctx.lineTo(projectWidth * GRID_SIZE / 2, 0)
    ctx.stroke()
  }

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Calculate viewport bounds in grid coordinates
    const viewportMinX = Math.floor((-canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const viewportMaxX = Math.ceil((canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const viewportMinY = Math.floor((-canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))
    const viewportMaxY = Math.ceil((canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))

    const width = projectWidth * GRID_SIZE
    const height = projectHeight * GRID_SIZE

    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1 / zoom

    ctx.beginPath()
    // Vertical lines
    for (let i = Math.max(0, viewportMinX + projectWidth / 2); i <= Math.min(projectWidth, viewportMaxX + projectWidth / 2); i++) {
      const x = -width / 2 + i * GRID_SIZE
      ctx.moveTo(x, -height / 2)
      ctx.lineTo(x, height / 2)
    }
    // Horizontal lines
    for (let i = Math.max(0, viewportMinY + projectHeight / 2); i <= Math.min(projectHeight, viewportMaxY + projectHeight / 2); i++) {
      const y = -height / 2 + i * GRID_SIZE
      ctx.moveTo(-width / 2, y)
      ctx.lineTo(width / 2, y)
    }
    ctx.stroke()
  }

  const drawOnionSkin = (ctx: CanvasRenderingContext2D) => {
    const prevFrame = frames[activeFrameIndex - 1]
    if (!prevFrame) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Calculate viewport bounds in grid coordinates to optimize drawing
    const viewportMinX = Math.floor((-canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const viewportMaxX = Math.ceil((canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const viewportMinY = Math.floor((-canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))
    const viewportMaxY = Math.ceil((canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))

    ctx.save()
    ctx.globalAlpha = 0.3 // Low opacity for onion skin
    
    // Font settings
    ctx.font = `${FONT_SIZE}px "Press Start 2P"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    prevFrame.layers.forEach(layer => {
      if (!layer.visible) return
      
      for (const [key, cell] of layer.data.entries()) {
        const [x, y] = key.split(',').map(Number)
        
        // Culling: Only draw if within viewport
        if (x < viewportMinX || x > viewportMaxX || y < viewportMinY || y > viewportMaxY) {
            continue
        }

        const px = x * GRID_SIZE + GRID_SIZE / 2
        const py = y * GRID_SIZE + GRID_SIZE / 2

        if (cell.bgColor) {
          ctx.fillStyle = cell.bgColor
          ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
        }

        if (cell.char) {
          ctx.fillStyle = cell.color
          ctx.fillText(cell.char, px, py + 2)
        }
      }
    })
    
    ctx.restore()
  }

  const drawContent = (ctx: CanvasRenderingContext2D) => {
    const frame = frames[activeFrameIndex]
    if (!frame) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Calculate viewport bounds in grid coordinates to optimize drawing
    const viewportMinX = Math.floor((-canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const viewportMaxX = Math.ceil((canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const viewportMinY = Math.floor((-canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))
    const viewportMaxY = Math.ceil((canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))

    // Font settings
    ctx.font = `${FONT_SIZE}px "Press Start 2P"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Iterate over layers (bottom to top)
    frame.layers.forEach(layer => {
      if (!layer.visible) return

      // Use Map iterator
      for (const [key, cell] of layer.data.entries()) {
        const [x, y] = key.split(',').map(Number)
        
        // Culling: Only draw if within viewport
        if (x < viewportMinX || x > viewportMaxX || y < viewportMinY || y > viewportMaxY) {
            continue
        }
        
        const px = x * GRID_SIZE + GRID_SIZE / 2
        const py = y * GRID_SIZE + GRID_SIZE / 2

        // Draw background if exists
        if (cell.bgColor) {
          ctx.fillStyle = cell.bgColor
          // Adjust rect position back to top-left for filling
          ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
        }

        // Draw character
        if (cell.char) {
          ctx.fillStyle = cell.color
          ctx.globalAlpha = layer.opacity
          
          if (cell.char === ' ') {
             // Draw Space Indicator (small dot)
             const size = 2 / zoom
             ctx.fillRect(px - size/2, py - size/2, size, size)
          } else {
             ctx.fillText(cell.char, px, py + 2) // +2 for visual alignment
          }
          
          ctx.globalAlpha = 1.0
        }
      }
    })
  }

  const drawFloatingSelection = (ctx: CanvasRenderingContext2D) => {
      if (!floatingSelection || !selection) return

      const canvas = canvasRef.current
      if (!canvas) return

      // Calculate viewport bounds in grid coordinates to optimize drawing
      const viewportMinX = Math.floor((-canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
      const viewportMaxX = Math.ceil((canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
      const viewportMinY = Math.floor((-canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))
      const viewportMaxY = Math.ceil((canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))

      ctx.font = `${FONT_SIZE}px "Press Start 2P"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      floatingSelection.forEach(item => {
          const x = selection.x + item.dx
          const y = selection.y + item.dy
          
          // Culling: Only draw if within viewport
          if (x < viewportMinX || x > viewportMaxX || y < viewportMinY || y > viewportMaxY) {
              return
          }

          const px = x * GRID_SIZE + GRID_SIZE / 2
          const py = y * GRID_SIZE + GRID_SIZE / 2

          if (item.data.bgColor) {
              ctx.fillStyle = item.data.bgColor
              ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
          }

          if (item.data.char) {
              ctx.fillStyle = item.data.color
              if (item.data.char === ' ') {
                 const size = 2 / zoom
                 ctx.fillRect(px - size/2, py - size/2, size, size)
              } else {
                 ctx.fillText(item.data.char, px, py + 2)
              }
          }
      })
  }

  const drawSelectionRect = (ctx: CanvasRenderingContext2D) => {
      const mask = selectionMask
      let rect = selection
      
      const currentMode = (modifiers.shift && modifiers.alt) ? 'intersect' : 
                          (modifiers.shift ? 'add' : 
                          (modifiers.alt ? 'subtract' : 
                          (lastEventRef.current?.ctrlKey ? 'new' : selectionMode)))

      // Lasso Path Preview
      if (activeTool === 'lasso' && isDragging && selectionPath && selectionPath.length > 0) {
          ctx.save()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1 / zoom
          ctx.setLineDash([5 / zoom, 5 / zoom])
          ctx.beginPath()
          selectionPath.forEach((p, i) => {
              const px = p.x * GRID_SIZE + GRID_SIZE / 2
              const py = p.y * GRID_SIZE + GRID_SIZE / 2
              if (i === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
          })
          
          // Connect to current hover position to show pending segment
          if (hoverPos) {
              const hpx = hoverPos.x * GRID_SIZE + GRID_SIZE / 2
              const hpy = hoverPos.y * GRID_SIZE + GRID_SIZE / 2
              ctx.lineTo(hpx, hpy)
          }
          
          ctx.stroke()
          
          // Draw small points at path vertices
          ctx.fillStyle = '#fff'
          selectionPath.forEach(p => {
              const px = p.x * GRID_SIZE + GRID_SIZE / 2
              const py = p.y * GRID_SIZE + GRID_SIZE / 2
              ctx.fillRect(px - 2/zoom, py - 2/zoom, 4/zoom, 4/zoom)
          })
          
          ctx.restore()
      }

      if (rect || tempMask) {
          ctx.save()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1 / zoom
          ctx.setLineDash([5 / zoom, 5 / zoom])
          
          // 1. Draw existing selection
          if (mask) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
              mask.forEach(key => {
                  const [x, y] = key.split(',').map(Number)
                  const px = x * GRID_SIZE
                  const py = y * GRID_SIZE
                  ctx.fillRect(px, py, GRID_SIZE, GRID_SIZE)
                  
                  const neighbors = [[1,0], [-1,0], [0,1], [0,-1]]
                  neighbors.forEach(([dx, dy]) => {
                      if (!mask!.has(`${x+dx},${y+dy}`)) {
                          ctx.beginPath()
                          if (dx === 1) { ctx.moveTo(px + GRID_SIZE, py); ctx.lineTo(px + GRID_SIZE, py + GRID_SIZE) }
                          if (dx === -1) { ctx.moveTo(px, py); ctx.lineTo(px, py + GRID_SIZE) }
                          if (dy === 1) { ctx.moveTo(px, py + GRID_SIZE); ctx.lineTo(px + GRID_SIZE, py + GRID_SIZE) }
                          if (dy === -1) { ctx.moveTo(px, py); ctx.lineTo(px + GRID_SIZE, py) }
                          ctx.stroke()
                      }
                  })
              })
          } else if (rect) {
              const px = rect.x * GRID_SIZE
              const py = rect.y * GRID_SIZE
              const pw = rect.w * GRID_SIZE
              const ph = rect.h * GRID_SIZE
              ctx.strokeRect(px, py, pw, ph)
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
              ctx.fillRect(px, py, pw, ph)
          }

          // 2. Draw preview of what's being dragged (Temp Mask)
          if (tempMask) {
              if (currentMode === 'add') {
                  ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'
              } else if (currentMode === 'subtract') {
                  ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
              } else if (currentMode === 'intersect') {
                  ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'
              } else {
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
              }

              tempMask.forEach(key => {
                  const [x, y] = key.split(',').map(Number)
                  ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE)
              })
          }
          
          ctx.restore()
      }
  }

  const drawPreview = (ctx: CanvasRenderingContext2D) => {
      if (!startPos || !hoverPos) return
      
      // Gradient Preview
      if (activeTool === 'gradient') {
          // Draw the gradient fill
          const x0 = startPos.x
          const y0 = startPos.y
          const x1 = hoverPos.x
          const y1 = hoverPos.y
          
          let minX = -projectWidth / 2
          let maxX = projectWidth / 2 - 1
          let minY = -projectHeight / 2
          let maxY = projectHeight / 2 - 1

          if (selection) {
              minX = selection.x
              maxX = selection.x + selection.w - 1
              minY = selection.y
              maxY = selection.y + selection.h - 1
          }

          const dx = x1 - x0
          const dy = y1 - y0
          const lenSq = dx * dx + dy * dy
          const radius = Math.sqrt(lenSq)
          
          ctx.save()
          // Iterate over the affected area
          for (let y = minY; y <= maxY; y++) {
               for (let x = minX; x <= maxX; x++) {
                   if (!isPointInSelection(x, y)) continue

                   let factor = 0

                  if (gradientType === 'linear') {
                      if (lenSq === 0) factor = 0
                      else {
                          const px = x - x0
                          const py = y - y0
                          const dot = px * dx + py * dy
                          factor = dot / lenSq
                      }
                  } else {
                      const dist = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2)
                      factor = dist / radius
                  }

                  factor = Math.max(0, Math.min(1, factor))
                  const color = interpolateColor(gradientColorStart, gradientColorEnd, factor)

                  const px = x * GRID_SIZE + GRID_SIZE / 2
                  const py = y * GRID_SIZE + GRID_SIZE / 2
                  
                  ctx.fillStyle = color
                  ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
              }
          }
          
          // Draw direction line on top
          ctx.beginPath()
          ctx.moveTo(x0 * GRID_SIZE + GRID_SIZE/2, y0 * GRID_SIZE + GRID_SIZE/2)
          ctx.lineTo(x1 * GRID_SIZE + GRID_SIZE/2, y1 * GRID_SIZE + GRID_SIZE/2)
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
          
          ctx.restore()
          return
      }

      let points: {x: number, y: number}[] = []
      
      if (activeTool === 'line') {
          points = getLinePoints(startPos.x, startPos.y, hoverPos.x, hoverPos.y)
      } else if (activeTool === 'rectangle') {
          points = getRectPoints(startPos.x, startPos.y, hoverPos.x, hoverPos.y)
      } else if (activeTool === 'circle') {
          points = getCirclePoints(startPos.x, startPos.y, hoverPos.x, hoverPos.y)
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = `${FONT_SIZE}px "Press Start 2P"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      points.forEach(p => {
          // Check bounds
          if (p.x < -projectWidth / 2 || p.x >= projectWidth / 2 || 
              p.y < -projectHeight / 2 || p.y >= projectHeight / 2) {
              return
          }

          if (!isPointInSelection(p.x, p.y)) return

          const px = p.x * GRID_SIZE + GRID_SIZE / 2
          const py = p.y * GRID_SIZE + GRID_SIZE / 2
          
          // Draw preview background
          ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
          
          // Draw preview char
          const pChar = isRightClick.current ? secondaryChar : brushChar
          const pColor = isRightClick.current ? secondaryColor : brushColor
          ctx.fillStyle = pColor
          ctx.fillText(pChar, px, py + 2)
      })
  }

  const drawCursor = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Only draw cursor if inside project bounds or using select tool
    const isOutOfBounds = x < -projectWidth / 2 || x >= projectWidth / 2 || y < -projectHeight / 2 || y >= projectHeight / 2
    if (isOutOfBounds && activeTool !== 'select') return

    const px = x * GRID_SIZE
    const py = y * GRID_SIZE
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1 / zoom
    ctx.strokeRect(px, py, GRID_SIZE, GRID_SIZE)
    
    // If drawing, show preview of what will be placed
    if (!isDragging && activeTool === 'brush') {
        ctx.save()
        ctx.globalAlpha = 0.5
        const char = brushChar
        const color = brushColor
        
        ctx.font = `${FONT_SIZE}px "Press Start 2P"`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.fillText(char, px + GRID_SIZE / 2, py + GRID_SIZE / 2 + 2)
        ctx.restore()
    }
  }

  // Mouse Handlers
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    // Using Math.floor for grid alignment
    const x = Math.floor((e.clientX - rect.left - canvas.width / 2 - pan.x) / (zoom * GRID_SIZE))
    const y = Math.floor((e.clientY - rect.top - canvas.height / 2 - pan.y) / (zoom * GRID_SIZE))
    
    return { x, y }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    lastEventRef.current = e
    if (e.button === 1) { // Middle click for panning
      setIsDragging(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      return
    }

    const pos = getMousePos(e)
    isRightClick.current = e.button === 2
    
    // Check Bounds
    const isOutOfBounds = pos.x < -projectWidth / 2 || pos.x >= projectWidth / 2 || pos.y < -projectHeight / 2 || pos.y >= projectHeight / 2
    if (isOutOfBounds && (activeTool === 'select' || activeTool === 'lasso' || activeTool === 'magicWand')) return

    if (activeTool === 'select' || activeTool === 'lasso' || activeTool === 'magicWand' || activeTool === 'move') {
        // Prevent Right Click from starting selection
        if (isRightClick.current) return

        // Check if clicking inside existing selection
        let clickedInside = false
        if (selection) {
            if (selectionMask) {
                clickedInside = selectionMask.has(`${pos.x},${pos.y}`)
            } else {
                clickedInside = pos.x >= selection.x && pos.x < selection.x + selection.w &&
                                pos.y >= selection.y && pos.y < selection.y + selection.h
            }
        }

        // Determine effective mode based on modifiers
        const isModifierActive = e.shiftKey || e.altKey || e.ctrlKey
        const isShiftAlt = e.shiftKey || e.altKey
        const effectiveMode = (e.shiftKey && e.altKey) ? 'intersect' : 
                               (e.shiftKey ? 'add' : 
                               (e.altKey ? 'subtract' : 
                               (e.ctrlKey ? 'new' : selectionMode)))

        // Move logic: 
        // 1. If 'move' tool is active, we move if there's a selection (clicked anywhere) or we move layer if no selection
        // 2. If selection tool is active, we only move if clicked inside and NO modifiers are held (except Ctrl which forces move/new)
        const shouldMove = (activeTool === 'move') || (clickedInside && selection && !isShiftAlt && (selectionMode === 'new' || e.ctrlKey))

        if (shouldMove) {
            setIsDragging(true)
            if (selection) {
                // Check for Alt key to duplicate (Copy instead of Lift)
                const isDuplicate = e.altKey

                if (floatingSelection) {
                    setIsMovingSelection(true)
                    setDragOffset({ x: pos.x - selection.x, y: pos.y - selection.y })
                } else {
                    if (isDuplicate) {
                        const frame = frames[activeFrameIndex]
                        const activeLayer = frame?.layers.find(l => l.id === activeLayerId)
                        const items: {dx: number, dy: number, data: any}[] = []
                        if (activeLayer) {
                            for(let y = 0; y < selection.h; y++) {
                                for(let x = 0; x < selection.w; x++) {
                                    const key = `${selection.x + x},${selection.y + y}`
                                    if (selectionMask && !selectionMask.has(key)) continue
                                    const cell = activeLayer.data.get(key)
                                    if (cell && (cell.char || cell.bgColor)) {
                                        items.push({ dx: x, dy: y, data: { ...cell } })
                                    }
                                }
                            }
                        }
                        setFloatingSelection(items)
                        setIsMovingSelection(true)
                        setDragOffset({ x: pos.x - selection.x, y: pos.y - selection.y })
                    } else {
                        const items = liftSelection()
                        if (items) {
                            setIsMovingSelection(true)
                            setDragOffset({ x: pos.x - selection.x, y: pos.y - selection.y })
                        }
                    }
                }
            } else if (activeTool === 'move') {
                // Move whole layer: lift EVERYTHING
        const frame = frames[activeFrameIndex]
        const layer = frame?.layers.find(l => l.id === activeLayerId)
        if (layer && layer.data.size > 0) {
            saveSnapshot()
            const items: {dx: number, dy: number, data: any}[] = []
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
            
            layer.data.forEach((cell, key) => {
                const [x, y] = key.split(',').map(Number)
                minX = Math.min(minX, x); minY = Math.min(minY, y)
                maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
            })

            layer.data.forEach((cell, key) => {
                const [x, y] = key.split(',').map(Number)
                items.push({ dx: x - minX, dy: y - minY, data: { ...cell } })
            })

            // Clear original layer data for lifting effect
            const emptyData = new Map()
            useProjectStore.getState().updateLayer(activeLayerId, { data: emptyData })
            
            const newSelection = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
            setSelection(newSelection)
            setFloatingSelection(items)
            setIsMovingSelection(true)
            setDragOffset({ x: pos.x - minX, y: pos.y - minY })
        } else if (layer) {
            // Layer is empty, but we might want to "start dragging" to avoid errors
            // or just do nothing. To avoid errors in handleMouseMove, we don't set isMovingSelection
        }
            }
            return
        }

        // Selection logic (if not moving)
        if (activeTool !== 'move') {
            // Commit previous floating if exists and we are starting a NEW selection action
            // or if we are clicking outside the current floating selection to drop it
            if (floatingSelection && selection && (effectiveMode === 'new' || !clickedInside)) {
                saveSnapshot()
                const updates = floatingSelection.map(item => ({
                    x: selection.x + item.dx,
                    y: selection.y + item.dy,
                    data: item.data
                }))
                batchUpdateCells(updates)
                setFloatingSelection(null)
                setSelection(null)
                setSelectionMask(null)
            }
            
            if (activeTool === 'magicWand') {
                const frame = frames[activeFrameIndex]
                const layer = frame?.layers.find(l => l.id === activeLayerId)
                if (layer) {
                    const startKey = `${pos.x},${pos.y}`
                    const startCell = layer.data.get(startKey)
                    const targetChar = startCell?.char || ''
                    const targetColor = startCell?.color || ''
                    
                    const mask = new Set<string>()
                    const queue: [number, number][] = [[pos.x, pos.y]]
                    mask.add(startKey)
                    
                    let minX = pos.x, maxX = pos.x, minY = pos.y, maxY = pos.y

                    while (queue.length > 0) {
                        const [x, y] = queue.shift()!
                        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
                        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
                        const neighbors = [[x+1, y], [x-1, y], [x, y+1], [x, y-1]]
                        for (const [nx, ny] of neighbors) {
                            const key = `${nx},${ny}`
                            if (nx < -projectWidth/2 || nx >= projectWidth/2 || ny < -projectHeight/2 || ny >= projectHeight/2) continue
                            if (mask.has(key)) continue
                            const cell = layer.data.get(key)
                            const currentChar = cell?.char || ''
                            const currentColor = cell?.color || ''
                            let isMatch = false
                            if (wandMode === 'char') {
                                isMatch = currentChar === targetChar
                            } else {
                                if (targetColor === currentColor) isMatch = true
                                else if (wandTolerance > 0 && targetColor && currentColor) {
                                    const c1 = hexToRgb(targetColor)
                                    const c2 = hexToRgb(currentColor)
                                    const dist = Math.sqrt(Math.pow(c1.r - c2.r, 2) + Math.pow(c1.g - c2.g, 2) + Math.pow(c1.b - c2.b, 2))
                                    isMatch = (dist / 441.67 * 100) <= wandTolerance
                                }
                            }
                            if (isMatch) { mask.add(key); queue.push([nx, ny]) }
                        }
                    }
                    
                    if (effectiveMode === 'new') {
                        setSelectionMask(mask)
                        setSelection({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 })
                    } else if (effectiveMode === 'add') {
                        const newMask = new Set(selectionMask || [])
                        mask.forEach(k => newMask.add(k))
                        setSelectionMask(newMask); updateSelectionBounds(newMask)
                    } else if (effectiveMode === 'subtract') {
                        const newMask = new Set(selectionMask || [])
                        mask.forEach(k => newMask.delete(k))
                        setSelectionMask(newMask); updateSelectionBounds(newMask)
                    } else if (effectiveMode === 'intersect') {
                        const currentMask = new Set<string>()
                        if (selectionMask) selectionMask.forEach(k => currentMask.add(k))
                        else if (selection) {
                            for (let sy = selection.y; sy < selection.y + selection.h; sy++)
                                for (let sx = selection.x; sx < selection.x + selection.w; sx++)
                                    currentMask.add(`${sx},${sy}`)
                        }
                        const newMask = new Set<string>()
                        mask.forEach(k => { if (currentMask.has(k)) newMask.add(k) })
                        setSelectionMask(newMask); updateSelectionBounds(newMask)
                    }
                }
            } else {
                // Rectangle or Lasso
                if (effectiveMode === 'new') {
                    setSelection(null)
                    setSelectionPath(null)
                    setSelectionMask(null)
                }
                setIsDragging(true)
                setStartPos(pos)
                if (activeTool === 'lasso') setSelectionPath([pos])
            }
        }
        return
    }

    setIsDragging(true)
    setStartPos(pos)
    
    if (!isOutOfBounds) {
        const char = isRightClick.current ? secondaryChar : brushChar
        const color = isRightClick.current ? secondaryColor : brushColor

        if (activeTool === 'brush') {
            const frame = frames[activeFrameIndex]
            const layer = frame?.layers.find(l => l.id === activeLayerId)
            const current = layer?.data.get(`${pos.x},${pos.y}`)
            
            if (isPointInSelection(pos.x, pos.y)) {
                setCell(pos.x, pos.y, { 
                    char, 
                    color, 
                    bgColor: current?.bgColor || '' 
                })
            }
        } else if (activeTool === 'eraser') {
            if (isPointInSelection(pos.x, pos.y)) {
                setCell(pos.x, pos.y, { char: '', color: '' })
            }
        } else if (activeTool === 'fill') {
            const char = isRightClick.current ? secondaryChar : brushChar
            const color = isRightClick.current ? secondaryColor : brushColor
            floodFill(pos.x, pos.y, char, color)
        } else if (activeTool === 'eyedropper') {
            const frame = frames[activeFrameIndex]
            const layer = frame?.layers.find(l => l.id === activeLayerId)
            const cell = layer?.data.get(`${pos.x},${pos.y}`)
            if (cell) {
                if (isRightClick.current) {
                    useEditorStore.getState().setSecondaryChar(cell.char)
                    useEditorStore.getState().setSecondaryColor(cell.color || '#ffffff')
                } else {
                    useEditorStore.getState().setBrushChar(cell.char)
                    useEditorStore.getState().setBrushColor(cell.color || '#ffffff')
                }
            }
        }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    lastEventRef.current = e
    if (isDragging && e.buttons === 4) { // Panning
      const dx = e.clientX - lastMousePos.current.x
      const dy = e.clientY - lastMousePos.current.y
      setPan({ x: pan.x + dx, y: pan.y + dy })
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      return
    }

    const pos = getMousePos(e)
    setHoverPos(pos)

    if (isDragging) {
        // Drawing logic with clipping
        const isOutOfBounds = pos.x < -projectWidth / 2 || pos.x >= projectWidth / 2 || pos.y < -projectHeight / 2 || pos.y >= projectHeight / 2
        
        // Selection preview color logic
        let previewColor = 'rgba(255, 255, 255, 0.3)' // Default for NEW
        if (e.shiftKey && e.altKey) {
            previewColor = 'rgba(255, 255, 0, 0.3)' // Yellow for INTERSECT
        } else if (e.shiftKey) {
            previewColor = 'rgba(0, 255, 0, 0.3)' // Green for ADD
        } else if (e.altKey) {
            previewColor = 'rgba(255, 0, 0, 0.3)' // Red for SUBTRACT
        }

        // Handle Temp Mask for selection tools (RECTANGLE ONLY)
        if (activeTool === 'select' && !isMovingSelection && startPos) {
            const minX = Math.min(startPos.x, pos.x)
            const maxX = Math.max(startPos.x, pos.x)
            const minY = Math.min(startPos.y, pos.y)
            const maxY = Math.max(startPos.y, pos.y)
            const newTemp = new Set<string>()
            for (let ty = minY; ty <= maxY; ty++) {
                for (let tx = minX; tx <= maxX; tx++) {
                    newTemp.add(`${tx},${ty}`)
                }
            }
            setTempMask(newTemp)
        }

        const isModifierActive = e.shiftKey || e.altKey || e.ctrlKey

        // Handle Lasso Path recording
        if (activeTool === 'lasso' && !isMovingSelection) {
            if (selectionPath) {
                const lastPos = selectionPath[selectionPath.length - 1]
                if (lastPos.x !== pos.x || lastPos.y !== pos.y) {
                    const newPath = [...selectionPath, pos]
                    setSelectionPath(newPath)
                    
                    // Update temp mask for lasso preview
                    const newTemp = new Set<string>()
                    newPath.forEach(p => newTemp.add(`${p.x},${p.y}`))
                    // For better preview, connect dots with lines
                    for (let i = 0; i < newPath.length - 1; i++) {
                        const line = getLinePoints(newPath[i].x, newPath[i].y, newPath[i+1].x, newPath[i+1].y)
                        line.forEach(p => newTemp.add(`${p.x},${p.y}`))
                    }
                    setTempMask(newTemp)
                }
            }
            return
        }

        // Handle Moving Selection
        if ((activeTool === 'select' || activeTool === 'lasso' || activeTool === 'magicWand' || activeTool === 'move') && isMovingSelection && selection) {
            const newX = pos.x - dragOffset.x
            const newY = pos.y - dragOffset.y
            const dx = newX - selection.x
            const dy = newY - selection.y
            
            if (dx !== 0 || dy !== 0) {
                setSelection({
                    ...selection,
                    x: newX,
                    y: newY
                })
                
                if (selectionMask) {
                    const newMask = new Set<string>()
                    selectionMask.forEach(key => {
                        const [x, y] = key.split(',').map(Number)
                        newMask.add(`${x + dx},${y + dy}`)
                    })
                    setSelectionMask(newMask)
                }

                if (selectionPath) {
                    const newPath = selectionPath.map(p => ({
                        x: p.x + dx,
                        y: p.y + dy
                    }))
                    setSelectionPath(newPath)
                }
            }
            return
        }

        if (isOutOfBounds) return

        if (activeTool === 'brush') {
            const char = isRightClick.current ? secondaryChar : brushChar
            const color = isRightClick.current ? secondaryColor : brushColor
            
            const frame = frames[activeFrameIndex]
            const layer = frame?.layers.find(l => l.id === activeLayerId)
            const current = layer?.data.get(`${pos.x},${pos.y}`)

            if (isPointInSelection(pos.x, pos.y)) {
                setCell(pos.x, pos.y, { 
                    char, 
                    color,
                    bgColor: current?.bgColor || ''
                })
            }
        } else if (activeTool === 'eraser') {
            if (isPointInSelection(pos.x, pos.y)) {
                setCell(pos.x, pos.y, { char: '', color: '' })
            }
        } else if (activeTool === 'eyedropper') {
            const frame = frames[activeFrameIndex]
            const layer = frame?.layers.find(l => l.id === activeLayerId)
            const cell = layer?.data.get(`${pos.x},${pos.y}`)
            if (cell) {
                if (isRightClick.current) {
                    useEditorStore.getState().setSecondaryChar(cell.char)
                    useEditorStore.getState().setSecondaryColor(cell.color || '#ffffff')
                } else {
                    useEditorStore.getState().setBrushChar(cell.char)
                    useEditorStore.getState().setBrushColor(cell.color || '#ffffff')
                }
            }
        }
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    lastEventRef.current = e
    // If buttons are still pressed (e.g. switching from L+R to just L), don't stop dragging
    if (e.buttons !== 0) {
        isRightClick.current = (e.buttons & 2) === 2
        return
    }

    if (activeTool === 'brush' || activeTool === 'eraser') {
        saveSnapshot()
    }

    setIsDragging(false)
    setTempMask(null)
    
    if (isMovingSelection) {
        // Stop moving, but KEEP floating selection active
        setIsMovingSelection(false)
        isRightClick.current = false
        return
    }

    if ((activeTool === 'select' || activeTool === 'lasso' || activeTool === 'magicWand') && startPos && hoverPos) {
        if (activeTool === 'select') {
            // Finalize selection rect
            const minX = Math.min(startPos.x, hoverPos.x)
            const maxX = Math.max(startPos.x, hoverPos.x)
            const minY = Math.min(startPos.y, hoverPos.y)
            const maxY = Math.max(startPos.y, hoverPos.y)
            
            // Clip to grid
            const clippedMinX = Math.max(minX, -projectWidth/2)
            const clippedMaxX = Math.min(maxX, projectWidth/2 - 1)
            const clippedMinY = Math.max(minY, -projectHeight/2)
            const clippedMaxY = Math.min(maxY, projectHeight/2 - 1)

            if (clippedMinX <= clippedMaxX && clippedMinY <= clippedMaxY) {
                const newRect = {
                    x: clippedMinX,
                    y: clippedMinY,
                    w: clippedMaxX - clippedMinX + 1,
                    h: clippedMaxY - clippedMinY + 1
                }

                const effectiveMode = (e.shiftKey && e.altKey) ? 'intersect' : 
                                       (e.shiftKey ? 'add' : 
                                       (e.altKey ? 'subtract' : 
                                       (e.ctrlKey ? 'new' : selectionMode)))

                if (effectiveMode === 'new') {
                    setSelectionMask(null)
                    setSelection(newRect)
                } else {
                    // Convert rect to mask and apply operation
                    const rectMask = new Set<string>()
                    for (let ry = newRect.y; ry < newRect.y + newRect.h; ry++) {
                        for (let rx = newRect.x; rx < newRect.x + newRect.w; rx++) {
                            rectMask.add(`${rx},${ry}`)
                        }
                    }

                    if (effectiveMode === 'add') {
                        const newMask = new Set(selectionMask || [])
                        // If no mask but we have a selection rect, add it first
                        if (!selectionMask && selection) {
                            for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
                                for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
                                    newMask.add(`${sx},${sy}`)
                                }
                            }
                        }
                        rectMask.forEach(k => newMask.add(k))
                        setSelectionMask(newMask)
                        updateSelectionBounds(newMask)
                    } else if (effectiveMode === 'subtract') {
                        const newMask = new Set(selectionMask || [])
                        if (!selectionMask && selection) {
                            for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
                                for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
                                    newMask.add(`${sx},${sy}`)
                                }
                            }
                        }
                        rectMask.forEach(k => newMask.delete(k))
                        setSelectionMask(newMask)
                        updateSelectionBounds(newMask)
                    } else if (effectiveMode === 'intersect') {
                        const currentMask = new Set<string>()
                        if (selectionMask) {
                            selectionMask.forEach(k => currentMask.add(k))
                        } else if (selection) {
                            for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
                                for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
                                    currentMask.add(`${sx},${sy}`)
                                }
                            }
                        }
                        
                        const newMask = new Set<string>()
                        rectMask.forEach(k => {
                            if (currentMask.has(k)) newMask.add(k)
                        })
                        setSelectionMask(newMask)
                        updateSelectionBounds(newMask)
                    }
                }
            } else if (selectionMode === 'new' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
                setSelection(null)
                setSelectionMask(null)
            }
            setStartPos(null)
            isRightClick.current = false
            return
        }

        if (activeTool === 'lasso' && selectionPath && selectionPath.length > 2) {
            // Convert path to mask using scanline or point-in-polygon
            const mask = new Set<string>()
            
            // Ray casting algorithm for point in polygon
            const isPointInPoly = (x: number, y: number, poly: {x: number, y: number}[]) => {
                let inside = false
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const xi = poly[i].x, yi = poly[i].y
                    const xj = poly[j].x, yj = poly[j].y
                    
                    // Line intersection check for the cell center
                    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
                    if (intersect) inside = !inside
                }
                return inside
            }

            // Aseprite-style lasso: 
            // 1. Mark EVERY cell the path touches (Supercover line algorithm)
            const markSupercover = (p1: Position, p2: Position) => {
                const hw = Math.floor(projectWidth / 2)
                const hh = Math.floor(projectHeight / 2)
                let x0 = p1.x + hw
                let y0 = p1.y + hh
                let x1 = p2.x + hw
                let y1 = p2.y + hh

                let dx = Math.abs(x1 - x0)
                let dy = Math.abs(y1 - y0)
                let x = Math.floor(x0)
                let y = Math.floor(y0)
                let n = 1
                let x_inc, y_inc
                let error

                if (dx === 0) {
                    x_inc = 0
                    error = Infinity
                } else if (x1 > x0) {
                    x_inc = 1
                    n += Math.floor(x1) - x
                    error = (Math.floor(x0) + 1 - x0) * dy
                } else {
                    x_inc = -1
                    n += x - Math.floor(x1)
                    error = (x0 - Math.floor(x0)) * dy
                }

                if (dy === 0) {
                    y_inc = 0
                    error -= Infinity
                } else if (y1 > y0) {
                    y_inc = 1
                    n += Math.floor(y1) - y
                    error -= (Math.floor(y0) + 1 - y0) * dx
                } else {
                    y_inc = -1
                    n += y - Math.floor(y1)
                    error -= (y0 - Math.floor(y0)) * dx
                }

                for (; n > 0; --n) {
                    if (x >= 0 && x < projectWidth && y >= 0 && y < projectHeight) {
                        grid[y][x] = true
                    }

                    if (error > 0) {
                        y += y_inc
                        error -= dx
                    } else if (error < 0) {
                        x += x_inc
                        error += dy
                    } else {
                        x += x_inc
                        y += y_inc
                        error += dy - dx
                        --n
                        if (x >= 0 && x < projectWidth && y >= 0 && y < projectHeight) {
                            grid[y][x] = true
                        }
                    }
                }
            }

            const grid: boolean[][] = Array.from({ length: projectHeight }, () => Array(projectWidth).fill(false))
            
            for (let i = 0; i < selectionPath.length; i++) {
                markSupercover(selectionPath[i], selectionPath[(i + 1) % selectionPath.length])
            }

            // 2. Fill the interior using isPointInPoly for centers
            for (let y = 0; y < projectHeight; y++) {
                for (let x = 0; x < projectWidth; x++) {
                    const cellX = x - Math.floor(projectWidth / 2)
                    const cellY = y - Math.floor(projectHeight / 2)
                    if (grid[y][x] || isPointInPoly(cellX + 0.5, cellY + 0.5, selectionPath)) {
                        mask.add(`${cellX},${cellY}`)
                    }
                }
            }

            if (mask.size > 0) {
                const effectiveMode = (e.shiftKey && e.altKey) ? 'intersect' : 
                                       (e.shiftKey ? 'add' : 
                                       (e.altKey ? 'subtract' : 
                                       (e.ctrlKey ? 'new' : selectionMode)))

                if (effectiveMode === 'new') {
                    setSelectionMask(mask)
                    updateSelectionBounds(mask)
                } else if (effectiveMode === 'add') {
                    const newMask = new Set(selectionMask || [])
                    if (!selectionMask && selection) {
                        for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
                            for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
                                newMask.add(`${sx},${sy}`)
                            }
                        }
                    }
                    mask.forEach(k => newMask.add(k))
                    setSelectionMask(newMask)
                    updateSelectionBounds(newMask)
                } else if (effectiveMode === 'subtract') {
                    const newMask = new Set(selectionMask || [])
                    if (!selectionMask && selection) {
                        for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
                            for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
                                newMask.add(`${sx},${sy}`)
                            }
                        }
                    }
                    mask.forEach(k => newMask.delete(k))
                    setSelectionMask(newMask)
                    updateSelectionBounds(newMask)
                } else if (effectiveMode === 'intersect') {
                    const currentMask = new Set<string>()
                    if (selectionMask) {
                        selectionMask.forEach(k => currentMask.add(k))
                    } else if (selection) {
                        for (let sy = selection.y; sy < selection.y + selection.h; sy++) {
                            for (let sx = selection.x; sx < selection.x + selection.w; sx++) {
                                currentMask.add(`${sx},${sy}`)
                            }
                        }
                    }
                    const newMask = new Set<string>()
                    mask.forEach(k => {
                        if (currentMask.has(k)) newMask.add(k)
                    })
                    setSelectionMask(newMask)
                    updateSelectionBounds(newMask)
                }
            } else if (e.shiftKey || e.altKey || e.ctrlKey) {
                // Keep existing selection if just a single click with modifier
            } else if (selectionMode === 'new') {
                setSelectionMask(null)
                setSelection(null)
            }
            setSelectionPath(null)
            setStartPos(null)
            return
        }
    }

    if (activeTool === 'magicWand' && startPos) {
        // Handled in handleMouseDown
        setStartPos(null)
        return
    }

    // Apply Shape Tools
    if ((activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'gradient') && startPos && hoverPos) {
        saveSnapshot()
        const updates: {x: number, y: number, data: any}[] = []

        const char = isRightClick.current ? secondaryChar : brushChar
        const color = isRightClick.current ? secondaryColor : brushColor // Not used for gradient interpolation but for shape color

        if (activeTool === 'gradient') {
             // ... Gradient Apply Logic ...
             const x0 = startPos.x
             const y0 = startPos.y
             const x1 = hoverPos.x
             const y1 = hoverPos.y
             
             let minX = -projectWidth / 2
             let maxX = projectWidth / 2 - 1
             let minY = -projectHeight / 2
             let maxY = projectHeight / 2 - 1

             if (selection) {
                 minX = selection.x
                 maxX = selection.x + selection.w - 1
                 minY = selection.y
                 maxY = selection.y + selection.h - 1
             }

             const dx = x1 - x0
             const dy = y1 - y0
             const lenSq = dx * dx + dy * dy
             const radius = Math.sqrt(lenSq)

             // Check if we should fill Background or Character
             // If char is empty or space, fill background
             const useBg = !char || char === ' '

             for (let y = minY; y <= maxY; y++) {
               for (let x = minX; x <= maxX; x++) {
                   if (!isPointInSelection(x, y)) continue
                   
                   let factor = 0
                    if (gradientType === 'linear') {
                        if (lenSq === 0) factor = 0
                        else {
                            const px = x - x0
                            const py = y - y0
                            const dot = px * dx + py * dy
                            factor = dot / lenSq
                        }
                    } else {
                        const dist = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2)
                        factor = dist / radius
                    }

                    factor = Math.max(0, Math.min(1, factor))
                    const gradColor = interpolateColor(gradientColorStart, gradientColorEnd, factor)
                    
                    const frame = frames[activeFrameIndex]
                    const layer = frame?.layers.find(l => l.id === activeLayerId)
                    const current = layer?.data.get(`${x},${y}`)

                    updates.push({
                         x, y,
                         data: useBg 
                             ? { char: current?.char || '', color: current?.color || '', bgColor: gradColor } 
                             : { char: char, color: gradColor, bgColor: current?.bgColor || '' }
                     })
                }
             }

        } else {
            // Line / Rect / Circle
            let points: {x: number, y: number}[] = []
            if (activeTool === 'line') {
                points = getLinePoints(startPos.x, startPos.y, hoverPos.x, hoverPos.y)
            } else if (activeTool === 'rectangle') {
                points = getRectPoints(startPos.x, startPos.y, hoverPos.x, hoverPos.y)
            } else if (activeTool === 'circle') {
                points = getCirclePoints(startPos.x, startPos.y, hoverPos.x, hoverPos.y)
            }

            const frame = frames[activeFrameIndex]
            const layer = frame?.layers.find(l => l.id === activeLayerId)

            points.forEach(p => {
                if (p.x < -projectWidth / 2 || p.x >= projectWidth / 2 || 
                    p.y < -projectHeight / 2 || p.y >= projectHeight / 2) return
                
                if (!isPointInSelection(p.x, p.y)) return

                const current = layer?.data.get(`${p.x},${p.y}`)
                updates.push({
                    x: p.x,
                    y: p.y,
                    data: { 
                        char: char, 
                        color: color,
                        bgColor: current?.bgColor || ''
                    }
                })
            })
        }
        
        batchUpdateCells(updates)
        setStartPos(null)
    }
    isRightClick.current = false
  }

  return (
    <div 
      className={styles.canvasContainer}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      ref={containerRef}
    >
      <canvas 
        ref={canvasRef}
        onWheel={handleWheel}
      />
      <div className={styles.overlay}>
        {hoverPos && <span>X: {hoverPos.x} Y: {hoverPos.y}</span>}
        <span style={{ marginLeft: 10 }}>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
