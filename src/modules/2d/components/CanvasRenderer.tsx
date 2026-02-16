import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
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
    
    return rgbToHex(r, g, b)
}

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
}

function rgbToHex(r: number, g: number, b: number) {
    const toHex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
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
    const r = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0))
    const added = new Set<string>()
    const addPoint = (px: number, py: number) => {
        const key = `${px},${py}`
        if (!added.has(key)) {
            points.push({ x: px, y: py })
            added.add(key)
        }
    }
    if (r < 0.5) {
        addPoint(x0, y0)
        return points
    }

    const thr = 0.45
    const rMin = Math.max(0, r - thr)
    const rMax = r + thr
    const minX = Math.floor(x0 - rMax)
    const maxX = Math.ceil(x0 + rMax)
    const minY = Math.floor(y0 - rMax)
    const maxY = Math.ceil(y0 + rMax)

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const dx = x - x0
            const dy = y - y0
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist >= rMin && dist <= rMax) addPoint(x, y)
        }
    }
    return points
}

export function CanvasRenderer({ mode = 'full', className, inputOnly }: { mode?: 'full' | 'overlay', className?: string, inputOnly?: boolean }) {
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
  const setCursorPos = useEditorStore(state => state.setCursorPos)
  const setOverlayDraft = useEditorStore(state => state.setOverlayDraft)
  const activeTab = useEditorStore(state => state.activeTab)
  const cameraState3D = useEditorStore(state => state.cameraState3D)
  const setCameraState3D = useEditorStore(state => state.setCameraState3D)
  const setAutoRotate3D = useEditorStore(state => state.setAutoRotate3D)
  
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

  const { frames, activeFrameIndex, activeLayerId, setCell, batchUpdateCells, saveSnapshot, width: projectWidth, height: projectHeight } = useProjectStore()
  
  const lastMousePos = useRef({ x: 0, y: 0 })
  const lastEventRef = useRef<React.MouseEvent | KeyboardEvent | null>(null)
  const isRightClick = useRef(false)
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null)
  const [startPos, setLocalStartPos] = useState<{x: number, y: number} | null>(null)
  const startPosRef = useRef<{x: number, y: number} | null>(null)

  const setIsDraggingStore = useEditorStore(state => state.setIsDragging)
  const setDragStartPosStore = useEditorStore(state => state.setDragStartPos)

  const setStartPos = (pos: {x: number, y: number} | null) => {
    setLocalStartPos(pos)
    startPosRef.current = pos
    setDragStartPosStore(pos)
  }

  const [isDragging, setIsDragging] = useState(false)
  
  useEffect(() => {
    setIsDraggingStore(isDragging)
  }, [isDragging])

  const isDraggingRef = useRef(false)
  useEffect(() => { isDraggingRef.current = isDragging }, [isDragging])

  const nav3DRef = useRef<null | {
    mode: 'orbit' | 'pan'
    startClientX: number
    startClientY: number
    startPos: [number, number, number]
    startTarget: [number, number, number]
  }>(null)

  // Track modifiers for reactive preview
  const [modifiers, setModifiers] = useState({ shift: false, alt: false })
  const [tempMask, setTempMask] = useState<Set<string> | null>(null)

  // Floating Selection is now global
  const [isMovingSelection, setIsMovingSelection] = useState(false)
  const dragOffset = useEditorStore(state => state.dragOffset)
  const setDragOffset = useEditorStore(state => state.setDragOffset)
  const setSelectionMoveOffset = useEditorStore(state => state.setSelectionMoveOffset)
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null)
  const selectionPathRef = useRef<typeof selectionPath>(null)
  const selectionMoveOffsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (floatingSelection && selection) {
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
            } else if (selection) {
                 setSelection(null)
                 setSelectionMask(null)
            }
        }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [floatingSelection, selection, saveSnapshot, batchUpdateCells, setFloatingSelection, setSelection, setSelectionMask])

  useEffect(() => {
    selectionPathRef.current = selectionPath
  }, [selectionPath])

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
    if (!selection) return true

    if (selectionMask) {
        return selectionMask.has(`${x},${y}`)
    }
    
    return x >= selection.x && x < selection.x + selection.w &&
           y >= selection.y && y < selection.y + selection.h
  }, [selection, selectionMask])

  const updateFloatingSelectionCells = useCallback((updates: { x: number; y: number; data: any }[]) => {
    if (!floatingSelection || !selection) return false
    const map = new Map<string, { dx: number; dy: number; data: any }>()
    floatingSelection.forEach(item => {
      map.set(`${item.dx},${item.dy}`, { ...item, data: { ...item.data } })
    })
    updates.forEach(({ x, y, data }) => {
      const dx = x - selection.x
      const dy = y - selection.y
      if (dx < 0 || dy < 0 || dx >= selection.w || dy >= selection.h) return
      const key = `${dx},${dy}`
      const existing = map.get(key)
      const nextData = { ...(existing?.data || {}), ...data }
      if (nextData.char === '' && !nextData.bgColor) {
        map.delete(key)
      } else {
        map.set(key, { dx, dy, data: nextData })
      }
    })
    setFloatingSelection(Array.from(map.values()))
    return true
  }, [floatingSelection, selection, setFloatingSelection])

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
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
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
  }, [isDragging])


  const handleWheel = (e: React.WheelEvent) => {
    const container = containerRef.current
    const delta = -Math.sign(e.deltaY)
    const factor = 0.05
    const nextZoom = Math.max(0.1, Math.min(10, zoom + delta * factor))
    if (!container || nextZoom === zoom) {
      setZoom(nextZoom)
      return
    }

    const rect = container.getBoundingClientRect()
    const cursorX = e.clientX - rect.left - rect.width / 2
    const cursorY = e.clientY - rect.top - rect.height / 2

    const worldX = (cursorX - pan.x) / zoom
    const worldY = (cursorY - pan.y) / zoom

    const nextPan = {
      x: cursorX - worldX * nextZoom,
      y: cursorY - worldY * nextZoom
    }

    setPan(nextPan)
    setZoom(nextZoom)
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
    let queueIndex = 0
    const visited = new Set([startKey])
    const updates: {x: number, y: number, data: any}[] = []

    while (queueIndex < queue.length) {
        const [x, y] = queue[queueIndex]!
        queueIndex += 1
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
            if (!isInBounds(nx, ny)) continue
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
    
    // Apply transformation
    ctx.save()
    ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2)
    ctx.scale(zoom, zoom)

    if (!inputOnly) {
        if (mode === 'full') {
          // Fill the background of the entire viewport with workspace color
          ctx.fillStyle = workspaceColor
          ctx.fillRect(-canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
          // Draw Grid and Content handled by ThreeStage
        }

        if (mode === 'overlay') {
          if (showGrid) {
            drawGrid(ctx)
          }
          if (showCenterGuide) {
            drawCenterGuide(ctx)
          }
          if (onionSkinEnabled && activeFrameIndex > 0) {
            drawOnionSkin(ctx)
          }
        }
    }
    
    // Draw Preview for Line/Rectangle
    if (isDragging && startPos && hoverPos && activeTool !== 'select') {
       drawPreview(ctx)
    }

    // Draw Selection Rect (Only during drag to avoid double render with ThreeStage)
    if (isDragging && startPos && (activeTool === 'select' || activeTool === 'lasso')) {
        drawSelectionRect(ctx)
    }

    // Draw Cursor/Highlight
    if (hoverPos) {
      drawCursor(ctx, hoverPos.x, hoverPos.y)
    }

    ctx.restore()
  }, [mode, pan, zoom, workspaceColor, showGrid, showCenterGuide, onionSkinEnabled, activeFrameIndex, frames, activeLayerId, floatingSelection, selection, selectionMask, selectionPath, isDragging, startPos, hoverPos, activeTool, canvasBgColor, projectWidth, projectHeight, secondaryChar, brushChar, secondaryColor, brushColor, inputOnly])

    const drawRequestRef = useRef<number | null>(null)
    const scheduleDraw = useCallback(() => {
      if (inputOnly) return
      if (drawRequestRef.current !== null) return
      drawRequestRef.current = requestAnimationFrame(() => {
        drawRequestRef.current = null
        draw()
      })
    }, [draw, inputOnly])

    useEffect(() => {
      if (!inputOnly) scheduleDraw()
      return () => {
        if (drawRequestRef.current !== null) {
          cancelAnimationFrame(drawRequestRef.current)
          drawRequestRef.current = null
        }
      }
    }, [scheduleDraw, mode, pan, zoom, workspaceColor, showGrid, showCenterGuide, onionSkinEnabled, activeFrameIndex, frames, activeLayerId, floatingSelection, selection, selectionMask, selectionPath, isDragging, startPos, hoverPos, activeTool, canvasBgColor, projectWidth, projectHeight, secondaryChar, brushChar, secondaryColor, brushColor, inputOnly])

  const drawCenterGuide = (ctx: CanvasRenderingContext2D) => {
    const width = projectWidth * GRID_SIZE
    const height = projectHeight * GRID_SIZE
    const halfWidth = Math.floor(projectWidth / 2)
    const halfHeight = Math.floor(projectHeight / 2)
    const startX = (-halfWidth - 0.5) * GRID_SIZE
    const startY = (-halfHeight - 0.5) * GRID_SIZE
    ctx.strokeStyle = '#ffd54a'
    ctx.lineWidth = 2 / Math.max(1, zoom)
    ctx.beginPath()
    // Vertical
    ctx.moveTo(0, startY)
    ctx.lineTo(0, startY + height)
    // Horizontal
    ctx.moveTo(startX, 0)
    ctx.lineTo(startX + width, 0)
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
    const halfWidth = Math.floor(projectWidth / 2)
    const halfHeight = Math.floor(projectHeight / 2)
    const startX = (-halfWidth - 0.5) * GRID_SIZE
    const startY = (-halfHeight - 0.5) * GRID_SIZE

    ctx.strokeStyle = '#4a4a4a'
    ctx.lineWidth = 1 / Math.max(1, zoom)

    ctx.beginPath()
    // Vertical lines
    for (let i = Math.max(0, viewportMinX + halfWidth + 1); i <= Math.min(projectWidth, viewportMaxX + halfWidth + 1); i++) {
      const x = startX + i * GRID_SIZE
      ctx.moveTo(x, startY)
      ctx.lineTo(x, startY + height)
    }
    // Horizontal lines
    for (let i = Math.max(0, viewportMinY + halfHeight + 1); i <= Math.min(projectHeight, viewportMaxY + halfHeight + 1); i++) {
      const y = startY + i * GRID_SIZE
      ctx.moveTo(startX, y)
      ctx.lineTo(startX + width, y)
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

        const px = x * GRID_SIZE
        const py = y * GRID_SIZE

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

  /* removed unused drawContent */

  const getBounds = () => {
    const halfW = Math.floor(projectWidth / 2)
    const halfH = Math.floor(projectHeight / 2)
    const minX = -halfW
    const maxX = projectWidth - halfW - 1
    const minY = -halfH
    const maxY = projectHeight - halfH - 1
    return { minX, maxX, minY, maxY }
  }

  const isInBounds = (x: number, y: number) => {
    const { minX, maxX, minY, maxY } = getBounds()
    return x >= minX && x <= maxX && y >= minY && y <= maxY
  }

  const drawSelectionRect = (ctx: CanvasRenderingContext2D) => {
      const mask = selectionMask
      let rect = selection
      
      const currentMode = (modifiers.shift && modifiers.alt) ? 'intersect' : 
                          (modifiers.shift ? 'add' : 
                          (modifiers.alt ? 'subtract' : 
                          (lastEventRef.current?.ctrlKey ? 'new' : selectionMode)))

      const modeStyle = currentMode === 'add'
        ? { stroke: '#7cff9a', fill: 'rgba(124, 255, 154, 0.12)' }
        : currentMode === 'subtract'
        ? { stroke: '#ff7a7a', fill: 'rgba(255, 122, 122, 0.12)' }
        : currentMode === 'intersect'
        ? { stroke: '#ffd27a', fill: 'rgba(255, 210, 122, 0.12)' }
        : { stroke: '#7fd3ff', fill: 'rgba(127, 211, 255, 0.12)' }

      const modeLabel = currentMode === 'add'
        ? 'ADD'
        : currentMode === 'subtract'
        ? 'SUB'
        : currentMode === 'intersect'
        ? 'INT'
        : 'NEW'

      const drawModeTag = (x: number, y: number) => {
        const text = ` ${modeLabel} `
        ctx.save()
        ctx.font = `${Math.max(10, Math.round(10 / zoom))}px "Press Start 2P"`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const metrics = ctx.measureText(text)
        const pad = Math.max(2, Math.round(2 / zoom))
        const w = metrics.width + pad * 2
        const h = Math.max(10, Math.round(12 / zoom))
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = modeStyle.stroke
        ctx.lineWidth = 1 / zoom
        ctx.strokeRect(x, y, w, h)
        ctx.fillStyle = modeStyle.stroke
        ctx.fillText(text, x + pad, y + 1 / zoom)
        ctx.restore()
      }

      const getMaskBounds = (keys: Set<string>) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        keys.forEach(key => {
          const [x, y] = key.split(',').map(Number)
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        })
        if (!isFinite(minX) || !isFinite(minY)) return null
        return { minX, minY, maxX, maxY }
      }

      // Lasso Path Preview - Handled by ThreeStage
      // Rectangle selection preview - Handled by ThreeStage
      
      const moveOffset = isMovingSelection ? selectionMoveOffsetRef.current : { x: 0, y: 0 }
      if (rect || tempMask) {
          ctx.save()
          ctx.strokeStyle = modeStyle.stroke
          ctx.lineWidth = 2 / zoom
          ctx.setLineDash([])
          
          // 1. Draw existing selection
          // Visuals (fill/border) are now handled by ThreeStage for better performance and effects.
          // We only draw the mode tag here.
          if (mask) {
              const bounds = getMaskBounds(mask)
              if (bounds) {
                const tagX = (bounds.minX + moveOffset.x) * GRID_SIZE - GRID_SIZE / 2
                const tagY = (bounds.minY + moveOffset.y) * GRID_SIZE - GRID_SIZE / 2 - 16 / zoom
                drawModeTag(tagX, tagY)
              }
          } else if (rect) {
              const px = rect.x * GRID_SIZE - GRID_SIZE / 2
              const py = rect.y * GRID_SIZE - GRID_SIZE / 2
              drawModeTag(px, py - 16 / zoom)
          }

          // 2. Draw preview of what's being dragged (Temp Mask)
          if (tempMask) {
              ctx.fillStyle = modeStyle.fill

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
          
          let { minX, maxX, minY, maxY } = getBounds()

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

                  if (lenSq === 0) {
                      factor = 0
                  } else if (gradientType === 'linear') {
                      const px = x - x0
                      const py = y - y0
                      const dot = px * dx + py * dy
                      factor = dot / lenSq
                  } else {
                      const dist = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2)
                      factor = dist / radius
                  }

                  factor = Math.max(0, Math.min(1, factor))
                  const color = interpolateColor(gradientColorStart, gradientColorEnd, factor)

                  const px = x * GRID_SIZE
                  const py = y * GRID_SIZE
                  
                  ctx.fillStyle = color
                  ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
              }
          }
          
          // Draw direction line on top
          ctx.beginPath()
          ctx.moveTo(x0 * GRID_SIZE, y0 * GRID_SIZE)
          ctx.lineTo(x1 * GRID_SIZE, y1 * GRID_SIZE)
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
          if (!isInBounds(p.x, p.y)) return

          if (!isPointInSelection(p.x, p.y)) return

          const px = p.x * GRID_SIZE
          const py = p.y * GRID_SIZE
          
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
    const isOutOfBounds = !isInBounds(x, y)
    if (isOutOfBounds && activeTool !== 'select') return

    const px = x * GRID_SIZE
    const py = y * GRID_SIZE
    
    ctx.strokeStyle = 'rgba(190, 190, 190, 0.85)'
    ctx.lineWidth = 1.5 / zoom
    ctx.strokeRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
    
    // If drawing, show preview of what will be placed
    if (activeTool === 'brush') {
        ctx.save()
        ctx.globalAlpha = 0.6
        const char = isRightClick.current ? secondaryChar : brushChar
        const color = isRightClick.current ? secondaryColor : brushColor
        
        ctx.font = `${FONT_SIZE}px "Press Start 2P"`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color
        ctx.fillText(char, px, py + 2)
        ctx.restore()
    }
  }

  // Mouse Handlers
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    // Using Math.floor for grid alignment
    const { minX, maxX, minY, maxY } = getBounds()
    let x = Math.floor((e.clientX - rect.left - rect.width / 2 - pan.x) / (zoom * GRID_SIZE) + 0.5)
    let y = Math.floor((e.clientY - rect.top - rect.height / 2 - pan.y) / (zoom * GRID_SIZE) + 0.5)
    x = Math.max(minX, Math.min(maxX, x))
    y = Math.max(minY, Math.min(maxY, y))
    
    return { x, y }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    lastEventRef.current = e
    if (activeTab === '3D') {
      e.preventDefault()
      setAutoRotate3D(false)
      const radius = Math.max(10, Math.max(projectWidth, projectHeight))
      const baseState =
        cameraState3D ?? { position: [radius, radius * 0.6, radius] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
      if (!cameraState3D) setCameraState3D(baseState)
      nav3DRef.current = {
        mode: e.button === 2 || e.button === 1 ? 'pan' : 'orbit',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPos: baseState.position,
        startTarget: baseState.target,
      }
      return
    }
    if (e.button === 1) { // Middle click for panning
      setIsDragging(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      return
    }

    const pos = getMousePos(e)
    isRightClick.current = e.button === 2
    
    // Check Bounds
    const isOutOfBounds = !isInBounds(pos.x, pos.y)
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
                    selectionMoveOffsetRef.current = { x: 0, y: 0 }
                    setSelectionMoveOffset({ x: 0, y: 0 })
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
                        selectionMoveOffsetRef.current = { x: 0, y: 0 }
                        setSelectionMoveOffset({ x: 0, y: 0 })
                        setDragOffset({ x: pos.x - selection.x, y: pos.y - selection.y })
                    } else {
                        const items = liftSelection()
                        if (items) {
                            setIsMovingSelection(true)
                            selectionMoveOffsetRef.current = { x: 0, y: 0 }
                            setSelectionMoveOffset({ x: 0, y: 0 })
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
            
            layer.data.forEach((_, key) => {
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
            selectionMoveOffsetRef.current = { x: 0, y: 0 }
            setSelectionMoveOffset({ x: 0, y: 0 })
            setDragOffset({ x: pos.x - minX, y: pos.y - minY })
        } else if (layer) {
            // Layer is empty, but we might want to "start dragging" to avoid errors
            // or just do nothing. To avoid errors in handleMouseMove, we don't set isMovingSelection
        }
            }
            return
        }

        // Selection logic (if not moving)
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
                const applied = updateFloatingSelectionCells([{
                    x: pos.x,
                    y: pos.y,
                    data: { char, color }
                }])
                if (!applied) {
                    setCell(pos.x, pos.y, { 
                        char, 
                        color, 
                        bgColor: current?.bgColor || '' 
                    })
                }
                lastDrawPos.current = { x: pos.x, y: pos.y }
            }
        } else if (activeTool === 'eraser') {
            if (isPointInSelection(pos.x, pos.y)) {
                const applied = updateFloatingSelectionCells([{
                    x: pos.x,
                    y: pos.y,
                    data: { char: '', color: '' }
                }])
                if (!applied) {
                    setCell(pos.x, pos.y, { char: '', color: '' })
                }
                lastDrawPos.current = { x: pos.x, y: pos.y }
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
    if (activeTab === '3D') {
      const nav = nav3DRef.current
      if (!nav || e.buttons === 0) return
      e.preventDefault()
      setAutoRotate3D(false)

      const dx = e.clientX - nav.startClientX
      const dy = e.clientY - nav.startClientY

      const startPos = new THREE.Vector3(...nav.startPos)
      const startTarget = new THREE.Vector3(...nav.startTarget)

      if (nav.mode === 'orbit') {
        const offset = startPos.clone().sub(startTarget)
        const spherical = new THREE.Spherical()
        spherical.setFromVector3(offset)

        const rotateSpeed = 0.005
        spherical.theta -= dx * rotateSpeed
        spherical.phi -= dy * rotateSpeed
        spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi))

        const nextPos = new THREE.Vector3().setFromSpherical(spherical).add(startTarget)
        setCameraState3D({
          position: [nextPos.x, nextPos.y, nextPos.z],
          target: [startTarget.x, startTarget.y, startTarget.z],
        })
        return
      }

      const container = containerRef.current
      const rect = container?.getBoundingClientRect()
      const h = Math.max(1, rect?.height ?? 1)
      const fov = 45 * (Math.PI / 180)
      const dist = Math.max(1e-6, startPos.distanceTo(startTarget))
      const worldPerPixel = (2 * dist * Math.tan(fov * 0.5)) / h

      const dir = startPos.clone().sub(startTarget).normalize()
      const up = new THREE.Vector3(0, 1, 0)
      const right = new THREE.Vector3().crossVectors(up, dir).normalize()
      const camUp = new THREE.Vector3().crossVectors(dir, right).normalize()

      const panOffset = right.multiplyScalar(-dx * worldPerPixel).add(camUp.multiplyScalar(dy * worldPerPixel))
      const nextPos = startPos.clone().add(panOffset)
      const nextTarget = startTarget.clone().add(panOffset)

      setCameraState3D({
        position: [nextPos.x, nextPos.y, nextPos.z],
        target: [nextTarget.x, nextTarget.y, nextTarget.z],
      })
      return
    }
    if (isDragging && e.buttons === 4) { // Panning
      const dx = e.clientX - lastMousePos.current.x
      const dy = e.clientY - lastMousePos.current.y
      setPan({ x: pan.x + dx, y: pan.y + dy })
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      return
    }

    const pos = getMousePos(e)
    setHoverPos(pos)
    setCursorPos(pos)

    if (isDragging) {
        if (startPos && (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle')) {
            let points: {x: number, y: number}[] = []
            if (activeTool === 'line') {
                points = getLinePoints(startPos.x, startPos.y, pos.x, pos.y)
            } else if (activeTool === 'rectangle') {
                points = getRectPoints(startPos.x, startPos.y, pos.x, pos.y)
            } else {
                points = getCirclePoints(startPos.x, startPos.y, pos.x, pos.y)
            }
            setOverlayDraft({ type: activeTool, points })
        } else if (startPos && activeTool === 'gradient') {
            setOverlayDraft({ type: 'gradient', dir: { x0: startPos.x, y0: startPos.y, x1: pos.x, y1: pos.y } })
        }
        // Drawing logic with clipping
        const isOutOfBounds = !isInBounds(pos.x, pos.y)
        
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

        // Handle Lasso Path recording
        if (activeTool === 'lasso' && !isMovingSelection) {
            const currentPath = selectionPathRef.current
            if (!currentPath || currentPath.length === 0) return
            const lastPos = currentPath[currentPath.length - 1]
            if (lastPos.x === pos.x && lastPos.y === pos.y) return
            const newPath = [...currentPath, pos]
            const newTemp = new Set<string>()
            newPath.forEach(p => newTemp.add(`${p.x},${p.y}`))
            for (let i = 0; i < newPath.length - 1; i++) {
                const line = getLinePoints(newPath[i].x, newPath[i].y, newPath[i + 1].x, newPath[i + 1].y)
                line.forEach(p => newTemp.add(`${p.x},${p.y}`))
            }
            setTempMask(newTemp)
            setSelectionPath(newPath)
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
                selectionMoveOffsetRef.current = { 
                    x: selectionMoveOffsetRef.current.x + dx, 
                    y: selectionMoveOffsetRef.current.y + dy 
                }
                setSelectionMoveOffset(selectionMoveOffsetRef.current)
            }
            return
        }

        // Handle Gradient Preview
        if (activeTool === 'gradient' && !isMovingSelection && startPos) {
             const x0 = startPos.x
             const y0 = startPos.y
             const x1 = pos.x
             const y1 = pos.y
             
             let { minX, maxX, minY, maxY } = getBounds()

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

             const char = isRightClick.current ? secondaryChar : brushChar
             const useBg = !char || char === ' '
             const frame = frames[activeFrameIndex]
             const layer = frame?.layers.find(l => l.id === activeLayerId)

             const cells: { x: number; y: number; color: string; char: string }[] = []

             for (let y = minY; y <= maxY; y++) {
               for (let x = minX; x <= maxX; x++) {
                   if (!isPointInSelection(x, y)) continue
                   
                   let factor = 0
                    if (lenSq === 0) {
                        factor = 0
                    } else if (gradientType === 'linear') {
                        const px = x - x0
                        const py = y - y0
                        const dot = px * dx + py * dy
                        factor = dot / lenSq
                    } else {
                        const dist = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2)
                        factor = dist / radius
                    }

                    factor = Math.max(0, Math.min(1, factor))
                    const gradColor = interpolateColor(gradientColorStart, gradientColorEnd, factor)
                    
                    const current = layer?.data.get(`${x},${y}`)
                    cells.push({
                        x, y,
                        color: gradColor, // Preview only shows color for now
                        char: useBg ? (current?.char || '') : char
                    })
                }
             }
             setOverlayDraft({ type: 'gradient', dir: { x0, y0, x1, y1 }, cells })
             return
        }

        if (isOutOfBounds) return

        if (activeTool === 'brush' || activeTool === 'eraser') {
            const char = isRightClick.current ? secondaryChar : brushChar
            const color = isRightClick.current ? secondaryColor : brushColor
            const frame = frames[activeFrameIndex]
            const layer = frame?.layers.find(l => l.id === activeLayerId)
            const floatingActive = Boolean(floatingSelection && selection)

            const from = lastDrawPos.current ?? pos
            const points = getLinePoints(from.x, from.y, pos.x, pos.y)
            const updates: { x: number; y: number; data: any }[] = []

            points.forEach(p => {
                if (!isInBounds(p.x, p.y)) return
                if (!isPointInSelection(p.x, p.y)) return
                if (activeTool === 'brush') {
                    if (floatingActive) {
                        updates.push({
                            x: p.x,
                            y: p.y,
                            data: { char, color }
                        })
                    } else {
                        const current = layer?.data.get(`${p.x},${p.y}`)
                        updates.push({
                            x: p.x,
                            y: p.y,
                            data: { char, color, bgColor: current?.bgColor || '' }
                        })
                    }
                } else {
                    updates.push({ x: p.x, y: p.y, data: { char: '', color: '', bgColor: '' } })
                }
            })

            if (updates.length > 0) {
                const applied = updateFloatingSelectionCells(updates)
                if (!applied) {
                    batchUpdateCells(updates)
                }
            }
            lastDrawPos.current = { x: pos.x, y: pos.y }
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
    if (activeTab === '3D') {
      if (e.buttons !== 0) return
      nav3DRef.current = null
      return
    }
    lastDrawPos.current = null
    const endPos = getMousePos(e)
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
    setOverlayDraft(null)
    
    if (isMovingSelection) {
        // Stop moving, but KEEP floating selection active
        setIsMovingSelection(false)
        const offset = selectionMoveOffsetRef.current
        if ((offset.x !== 0 || offset.y !== 0) && selectionMask) {
            const newMask = new Set<string>()
            selectionMask.forEach(key => {
                const [x, y] = key.split(',').map(Number)
                newMask.add(`${x + offset.x},${y + offset.y}`)
            })
            setSelectionMask(newMask)
        }
        if ((offset.x !== 0 || offset.y !== 0) && selectionPath) {
            const newPath = selectionPath.map(p => ({
                x: p.x + offset.x,
                y: p.y + offset.y
            }))
            setSelectionPath(newPath)
        }
        selectionMoveOffsetRef.current = { x: 0, y: 0 }
        setSelectionMoveOffset({ x: 0, y: 0 })
        isRightClick.current = false
        return
    }

    if ((activeTool === 'select' || activeTool === 'lasso' || activeTool === 'magicWand') && startPos) {
        if (activeTool === 'select') {
            // Finalize selection rect
            const minX = Math.min(startPos.x, endPos.x)
            const maxX = Math.max(startPos.x, endPos.x)
            const minY = Math.min(startPos.y, endPos.y)
            const maxY = Math.max(startPos.y, endPos.y)
            
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

                const effectiveMode = (modifiers.shift && modifiers.alt) ? 'intersect' : 
                                       (modifiers.shift ? 'add' : 
                                       (modifiers.alt ? 'subtract' : 
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
            const effectiveMode = (modifiers.shift && modifiers.alt) ? 'intersect' : 
                                       (modifiers.shift ? 'add' : 
                                       (modifiers.alt ? 'subtract' : 
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
        const frame = frames[activeFrameIndex]
        const layer = frame?.layers.find(l => l.id === activeLayerId)
        if (!layer) {
            setStartPos(null)
            return
        }
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
             
             let { minX, maxX, minY, maxY } = getBounds()

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
                    if (lenSq === 0) {
                        factor = 0
                    } else if (gradientType === 'linear') {
                        const px = x - x0
                        const py = y - y0
                        const dot = px * dx + py * dy
                        factor = dot / lenSq
                    } else {
                        const dist = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2)
                        factor = dist / radius
                    }

                    factor = Math.max(0, Math.min(1, factor))
                    const gradColor = interpolateColor(gradientColorStart, gradientColorEnd, factor)
                    
                    const current = layer.data.get(`${x},${y}`)

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
                if (!isInBounds(p.x, p.y)) return
                
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
      className={`${styles.canvasContainer} ${mode === 'overlay' ? styles.overlayContainer : ''} ${className ?? ''}`}
      style={{ pointerEvents: activeTab === '3D' ? 'none' : 'auto' }}
      onMouseDown={activeTab === '3D' ? undefined : handleMouseDown}
      onMouseMove={activeTab === '3D' ? undefined : handleMouseMove}
      onMouseUp={activeTab === '3D' ? undefined : handleMouseUp}
      onMouseLeave={activeTab === '3D' ? undefined : handleMouseUp}
      onContextMenu={activeTab === '3D' ? undefined : (e) => e.preventDefault()}
      ref={containerRef}
    >
      <canvas 
        ref={canvasRef}
        onWheel={activeTab === '3D' ? undefined : handleWheel}
      />
      <div className={styles.overlay}>
        {hoverPos && <span>X: {hoverPos.x} Y: {hoverPos.y}</span>}
        <span style={{ marginLeft: 10 }}>Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
