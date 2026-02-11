import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
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
  const setClipboard = useEditorStore(state => state.setClipboard)
  
  // Selection from Store
  const selection = useEditorStore(state => state.selection)
  const setSelection = useEditorStore(state => state.setSelection)
  const selectionTransform = useEditorStore(state => state.selectionTransform)
  const setSelectionTransform = useEditorStore(state => state.setSelectionTransform)

  const { frames, activeFrameIndex, activeLayerId, setCell, batchUpdateCells, saveSnapshot, undo, redo, width: projectWidth, height: projectHeight } = useProjectStore()
  
  const [isDragging, setIsDragging] = useState(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const isRightClick = useRef(false)
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null)
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null)

  // Floating Selection remains local as it holds heavy pixel data
  const [floatingSelection, setFloatingSelection] = useState<{dx: number, dy: number, data: any}[] | null>(null)
  const [isMovingSelection, setIsMovingSelection] = useState(false)
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0})

  // Clear selection when tool changes
  useEffect(() => {
    setSelection(null)
    setFloatingSelection(null)
    setIsDragging(false)
    setIsMovingSelection(false)
  }, [activeTool, setSelection])

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

  // Keyboard Shortcuts (Undo/Redo/Delete/Copy/Cut/Paste)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Copy: Ctrl+C
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
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

        // Cut: Ctrl+X
        if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
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
                // Actually liftSelection sets floating. We can just lift then clear floating.
                const items = liftSelection()
                if (items) {
                    data = items.map(item => ({ x: item.dx, y: item.dy, data: item.data }))
                    setFloatingSelection(null)
                }
            }
            setClipboard({ width, height, data })
            return
        }

        // Paste: Ctrl+V
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
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
        if (e.key === 'Enter' || e.code === 'Enter' || e.key === 'Escape') {
             if (activeTool === 'select' && floatingSelection && selection) {
                e.preventDefault()
                e.stopPropagation()
                
                if (e.key === 'Escape') {
                    setFloatingSelection(null)
                    setSelection(null) 
                } else {
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
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool === 'select' && selection && !isMovingSelection) {
            // Delete selection content
            e.preventDefault()
            
            if (floatingSelection) {
                setFloatingSelection(null)
            } else {
                saveSnapshot()
                
                const updates = []
                for(let y = 0; y < selection.h; y++) {
                    for(let x = 0; x < selection.w; x++) {
                        updates.push({
                            x: selection.x + x,
                            y: selection.y + y,
                            data: { char: '', color: '' }
                        })
                    }
                }
                batchUpdateCells(updates)
            }
        }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, activeTool, selection, isMovingSelection, saveSnapshot, batchUpdateCells, frames, activeFrameIndex, activeLayerId, floatingSelection, hoverPos, setSelection, setClipboard])


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

  // Draw Function
  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Apply transformation
    ctx.save()
    ctx.translate(pan.x + canvas.width / 2, pan.y + canvas.height / 2)
    ctx.scale(zoom, zoom)

    // Draw Grid and Content
    drawGrid(ctx)
    
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
    if (activeTool === 'select') {
        drawSelectionRect(ctx)
    }

    // Draw Cursor/Highlight
    if (hoverPos) {
      drawCursor(ctx, hoverPos.x, hoverPos.y)
    }

    ctx.restore()
  }

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const width = projectWidth * GRID_SIZE
    const height = projectHeight * GRID_SIZE

    // Draw Background of the grid area
    ctx.fillStyle = '#1a1918'
    ctx.fillRect(-width / 2, -height / 2, width, height)

    // Draw Lines
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1 / zoom

    ctx.beginPath()
    // Vertical lines
    for (let i = 0; i <= projectWidth; i++) {
      const x = -width / 2 + i * GRID_SIZE
      ctx.moveTo(x, -height / 2)
      ctx.lineTo(x, height / 2)
    }
    // Horizontal lines
    for (let i = 0; i <= projectHeight; i++) {
      const y = -height / 2 + i * GRID_SIZE
      ctx.moveTo(-width / 2, y)
      ctx.lineTo(width / 2, y)
    }
    ctx.stroke()

    // Draw Center Marker
    ctx.strokeStyle = '#ffcc00'
    ctx.lineWidth = 2 / zoom
    ctx.beginPath()
    ctx.moveTo(-10, 0)
    ctx.lineTo(10, 0)
    ctx.moveTo(0, -10)
    ctx.lineTo(0, 10)
    ctx.stroke()
  }

  const drawOnionSkin = (ctx: CanvasRenderingContext2D) => {
    const prevFrame = frames[activeFrameIndex - 1]
    if (!prevFrame) return

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
          ctx.fillText(cell.char, px, py + 2) // +2 for visual alignment
          ctx.globalAlpha = 1.0
        }
      }
    })
  }

  const drawFloatingSelection = (ctx: CanvasRenderingContext2D) => {
      if (!floatingSelection || !selection) return

      ctx.font = `${FONT_SIZE}px "Press Start 2P"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      floatingSelection.forEach(item => {
          const x = selection.x + item.dx
          const y = selection.y + item.dy
          
          const px = x * GRID_SIZE + GRID_SIZE / 2
          const py = y * GRID_SIZE + GRID_SIZE / 2

          if (item.data.bgColor) {
              ctx.fillStyle = item.data.bgColor
              ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
          }

          if (item.data.char) {
              ctx.fillStyle = item.data.color
              ctx.fillText(item.data.char, px, py + 2)
          }
      })
  }

  const drawSelectionRect = (ctx: CanvasRenderingContext2D) => {
      let rect = selection

      // If dragging to select, calculate temporary rect
      if (isDragging && !isMovingSelection && startPos && hoverPos) {
          const minX = Math.min(startPos.x, hoverPos.x)
          const maxX = Math.max(startPos.x, hoverPos.x)
          const minY = Math.min(startPos.y, hoverPos.y)
          const maxY = Math.max(startPos.y, hoverPos.y)
          rect = {
              x: minX,
              y: minY,
              w: maxX - minX + 1,
              h: maxY - minY + 1
          }
      }

      if (rect) {
          const px = rect.x * GRID_SIZE
          const py = rect.y * GRID_SIZE
          const pw = rect.w * GRID_SIZE
          const ph = rect.h * GRID_SIZE

          ctx.save()
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 1 / zoom
          ctx.setLineDash([5 / zoom, 5 / zoom])
          ctx.strokeRect(px, py, pw, ph)
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
          ctx.fillRect(px, py, pw, ph)
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

          const px = p.x * GRID_SIZE + GRID_SIZE / 2
          const py = p.y * GRID_SIZE + GRID_SIZE / 2
          
          // Draw preview background
          ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
          
          // Draw preview char
          ctx.fillStyle = brushColor
          ctx.fillText(brushChar, px, py + 2)
      })
  }

  const drawCursor = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Check if cursor is within grid bounds
    if (x < -projectWidth / 2 || x >= projectWidth / 2 || y < -projectHeight / 2 || y >= projectHeight / 2) return

    const px = x * GRID_SIZE
    const py = y * GRID_SIZE

    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2 / zoom
    ctx.strokeRect(px, py, GRID_SIZE, GRID_SIZE)
  }

  // Mouse Handlers
  const getMousePos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - canvas.width / 2 - pan.x) / zoom
    const y = (e.clientY - rect.top - canvas.height / 2 - pan.y) / zoom
    
    return {
      x: Math.floor(x / GRID_SIZE),
      y: Math.floor(y / GRID_SIZE)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle click for panning
      setIsDragging(true)
      lastMousePos.current = { x: e.clientX, y: e.clientY }
      return
    }

    const pos = getMousePos(e)
    isRightClick.current = e.button === 2
    
    // Check Bounds
    const isOutOfBounds = pos.x < -projectWidth / 2 || pos.x >= projectWidth / 2 || pos.y < -projectHeight / 2 || pos.y >= projectHeight / 2
    if (isOutOfBounds && activeTool !== 'select') return

    if (activeTool === 'select') {
        // Prevent Right Click from starting selection
        if (isRightClick.current) return

        // Check if clicking inside existing selection
        let clickedInside = false
        if (selection) {
            clickedInside = pos.x >= selection.x && pos.x < selection.x + selection.w &&
                            pos.y >= selection.y && pos.y < selection.y + selection.h
        }

        if (clickedInside && selection) {
            if (floatingSelection) {
                // Already floating, just grab it
                setIsMovingSelection(true)
                setDragOffset({
                    x: pos.x - selection.x,
                    y: pos.y - selection.y
                })
            } else {
                // Lift selection from canvas
                const items = liftSelection()
                if (items) {
                    setIsMovingSelection(true)
                    setDragOffset({
                        x: pos.x - selection.x,
                        y: pos.y - selection.y
                    })
                }
            }
        } else {
            // New selection start
            // Commit previous floating if exists
            if (floatingSelection && selection) {
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
            setIsDragging(true)
            setStartPos(pos)
        }
        return
    }

    setIsDragging(true)
    setStartPos(pos)
    
    if (!isOutOfBounds) {
        const char = isRightClick.current ? secondaryChar : brushChar
        const color = isRightClick.current ? secondaryColor : brushColor

        if (activeTool === 'brush') {
            setCell(pos.x, pos.y, { char, color })
        } else if (activeTool === 'eraser') {
            setCell(pos.x, pos.y, { char: '', color: '' })
        } else if (activeTool === 'fill') {
            // Flood Fill placeholder
            saveSnapshot()
        } else if (activeTool === 'eyedropper') {
             // ...
        }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
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
        // Handle Moving Selection
        if (activeTool === 'select' && isMovingSelection && selection) {
            setSelection({
                ...selection,
                x: pos.x - dragOffset.x,
                y: pos.y - dragOffset.y
            })
            return
        }

        const isOutOfBounds = pos.x < -projectWidth / 2 || pos.x >= projectWidth / 2 || pos.y < -projectHeight / 2 || pos.y >= projectHeight / 2
        if (isOutOfBounds) return

        if (activeTool === 'brush') {
            const char = isRightClick.current ? secondaryChar : brushChar
            const color = isRightClick.current ? secondaryColor : brushColor
            setCell(pos.x, pos.y, { char, color })
        } else if (activeTool === 'eraser') {
            setCell(pos.x, pos.y, { char: '', color: '' })
        }
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    
    if (isMovingSelection) {
        // Stop moving, but KEEP floating selection active
        setIsMovingSelection(false)
        isRightClick.current = false
        return
    }

    if (activeTool === 'select' && startPos && hoverPos) {
        // Finalize selection rect
        const minX = Math.min(startPos.x, hoverPos.x)
        const maxX = Math.max(startPos.x, hoverPos.x)
        const minY = Math.min(startPos.y, hoverPos.y)
        const maxY = Math.max(startPos.y, hoverPos.y)
        
        // Ensure within grid?
        // Let's clip to grid
        const clippedMinX = Math.max(minX, -projectWidth/2)
        const clippedMaxX = Math.min(maxX, projectWidth/2 - 1)
        const clippedMinY = Math.max(minY, -projectHeight/2)
        const clippedMaxY = Math.min(maxY, projectHeight/2 - 1)

        if (clippedMinX <= clippedMaxX && clippedMinY <= clippedMaxY) {
            setSelection({
                x: clippedMinX,
                y: clippedMinY,
                w: clippedMaxX - clippedMinX + 1,
                h: clippedMaxY - clippedMinY + 1
            })
        } else {
            setSelection(null)
        }
        setStartPos(null)
        isRightClick.current = false
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
                    
                    updates.push({
                         x, y,
                         data: useBg 
                             ? { char: '', color: '', bgColor: gradColor } 
                             : { char: char, color: gradColor, bgColor: '' }
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

            points.forEach(p => {
                if (p.x < -projectWidth / 2 || p.x >= projectWidth / 2 || 
                    p.y < -projectHeight / 2 || p.y >= projectHeight / 2) return
                
                updates.push({
                    x: p.x,
                    y: p.y,
                    data: { char: char, color: color }
                })
            })
        }
        
        batchUpdateCells(updates)
        setStartPos(null)
    }
    isRightClick.current = false
  }

  // Animation Loop
  useEffect(() => {
    let animationFrameId: number
    
    const render = () => {
      draw()
      animationFrameId = requestAnimationFrame(render)
    }
    
    render()
    
    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [
      zoom, pan, activeTool, brushChar, brushColor, onionSkinEnabled, 
      frames, activeFrameIndex, hoverPos, startPos, isDragging, 
      selection, floatingSelection, isMovingSelection, gradientType, gradientColorStart, gradientColorEnd
    ])

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
