import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js'
import { useProjectStore } from '../2d/store/projectStore'
import { useEditorStore } from '../2d/store/editorStore'
import { SymbolInstancedRenderer } from './symbols/SymbolInstancedRenderer'
import { GlyphAtlas } from './atlas/GlyphAtlas'
import { createSymbolMSDFMaterial } from './materials/SymbolMSDFMaterial'
import { createSelectionMaterials } from './materials/SelectionMaterials'

export function ThreeStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.Camera | null>(null)
  const orthoRef = useRef<THREE.OrthographicCamera | null>(null)
  const perspRef = useRef<THREE.PerspectiveCamera | null>(null)
  const ortho3DRef = useRef<THREE.OrthographicCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const controlsChangeHandlerRef = useRef<(() => void) | null>(null)
  const controlsEndHandlerRef = useRef<(() => void) | null>(null)
  const syncingControlsRef = useRef(false)
  const effectRef = useRef<AsciiEffect | null>(null)
  const gridGroupRef = useRef<THREE.Group | null>(null)
  const canvasBgRef = useRef<THREE.Mesh | null>(null)
  const centerGuideRef = useRef<THREE.Group | null>(null)
  const selectionGroupRef = useRef<THREE.Group | null>(null)
  const hoverGroupRef = useRef<THREE.Group | null>(null)
  const pathGroupRef = useRef<THREE.Group | null>(null)
  const maskGroupRef = useRef<THREE.Group | null>(null)
  const previewGroupRef = useRef<THREE.Group | null>(null)
  const floatingGroupRef = useRef<THREE.Group | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const symbolsRef = useRef<SymbolInstancedRenderer | null>(null)
  const onionRef = useRef<SymbolInstancedRenderer | null>(null)
  const overlayMaterialsRef = useRef<ReturnType<typeof createSelectionMaterials> | null>(null)
  const maskMaterialsRef = useRef<ReturnType<typeof createSelectionMaterials> | null>(null)
  const selectionFillMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const previewFillMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const maskFillMatRef = useRef<THREE.ShaderMaterial | null>(null)
  const rafRef = useRef<number | null>(null)
  const zoomRef = useRef(1)
  const panRef = useRef<{x: number; y: number}>({ x: 0, y: 0 })
  const PIXELS_PER_CELL = 20

  const width = useProjectStore(state => state.width)
  const height = useProjectStore(state => state.height)
  const frames = useProjectStore(state => state.frames)
  const activeFrameIndex = useProjectStore(state => state.activeFrameIndex)
  const frameVersion = useProjectStore(state => state.frameVersion)
  const lastUpdates = useProjectStore(state => state.lastUpdates)
  const showGrid = useEditorStore(state => state.showGrid)
  const canvasBgColor = useEditorStore(state => state.canvasBgColor)
  const workspaceColor = useEditorStore(state => state.workspaceColor)
  const onionSkinEnabled = useEditorStore(state => state.onionSkinEnabled)
  const showCenterGuide = useEditorStore(state => state.showCenterGuide)
  const selection = useEditorStore(state => state.selection)
  const selectionMode = useEditorStore(state => state.selectionMode)
  const cursorPos = useEditorStore(state => state.cursorPos)
  const selectionPath = useEditorStore(state => state.selectionPath)
  const selectionMask = useEditorStore(state => state.selectionMask)
  const floatingSelection = useEditorStore(state => state.floatingSelection)
  const overlayDraft = useEditorStore(state => state.overlayDraft)
  const activeTool = useEditorStore(state => state.activeTool)
  const brushChar = useEditorStore(state => state.brushChar)
  const brushColor = useEditorStore(state => state.brushColor)
  const secondaryChar = useEditorStore(state => state.secondaryChar)
  const secondaryColor = useEditorStore(state => state.secondaryColor)
  const zoom = useEditorStore(state => state.zoom)
  const pan = useEditorStore(state => state.pan)
  const activeTab = useEditorStore(state => state.activeTab)
  const autoRotate3D = useEditorStore(state => state.autoRotate3D)
  const renderMode3D = useEditorStore(state => state.renderMode3D)
  const asciiMode3D = useEditorStore(state => state.asciiMode3D)
  const asciiFontSize = useEditorStore(state => state.asciiFontSize)
  const asciiFillBackground3D = useEditorStore(state => state.asciiFillBackground3D)
  const cameraType3D = useEditorStore(state => state.cameraType3D)
  const cameraZoom3D = useEditorStore(state => state.cameraZoom3D)
  const layerDepth3D = useEditorStore(state => state.layerDepth3D)
  const cameraState3D = useEditorStore(state => state.cameraState3D)
  const isDragging = useEditorStore(state => state.isDragging)
  const dragStartPos = useEditorStore(state => state.dragStartPos)
  const selectionMoveOffset = useEditorStore(state => state.selectionMoveOffset)
  
  const COLOR_YELLOW = 0xffd54a
  const COLOR_GREEN = 0x4aff4a
  const COLOR_RED = 0xff4a4a
  const COLOR_BLUE = 0x4a4aff
  const COLOR_DARK_GREY = 0x333333

  const renderActive = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    if (contextLostRef.current) return
    if (activeTab === '3D' && asciiMode3D && effectRef.current) {
      effectRef.current.render(sceneRef.current, cameraRef.current)
      return
    }
    rendererRef.current.render(sceneRef.current, cameraRef.current)
  }

  // 2D camera mode removed; 2D tab always uses Orthographic camera
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  const modifiersRef = useRef({ shift: false, alt: false, ctrl: false })
  const [modifierVersion, setModifierVersion] = useState(0)
  const [cameraRevision, setCameraRevision] = useState(0)
  const last3DCameraKeyRef = useRef<string>('')
  const contextLostRef = useRef(false)
  const controlsClockRef = useRef(new THREE.Clock())

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') { modifiersRef.current.shift = true; setModifierVersion(v => v + 1) }
      if (e.key === 'Alt') { modifiersRef.current.alt = true; setModifierVersion(v => v + 1) }
      if (e.key === 'Control') { modifiersRef.current.ctrl = true; setModifierVersion(v => v + 1) }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') { modifiersRef.current.shift = false; setModifierVersion(v => v + 1) }
      if (e.key === 'Alt') { modifiersRef.current.alt = false; setModifierVersion(v => v + 1) }
      if (e.key === 'Control') { modifiersRef.current.ctrl = false; setModifierVersion(v => v + 1) }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(workspaceColor || '#111')
    sceneRef.current = scene

    overlayMaterialsRef.current = createSelectionMaterials()
    maskMaterialsRef.current = createSelectionMaterials()
    maskMaterialsRef.current.fillMat.uniforms.uColor.value.set(COLOR_DARK_GREY)
    maskMaterialsRef.current.fillMat.uniforms.uSecondaryColor.value.set(COLOR_DARK_GREY)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.domElement.dataset.bytefallThreeStage = 'true'
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const handleContextLost = (e: Event) => {
      e.preventDefault()
      contextLostRef.current = true
    }

    const handleContextRestored = () => {
      contextLostRef.current = false
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(container.clientWidth, container.clientHeight)
      setCameraRevision(v => v + 1)
      renderOnce()
    }

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, { passive: false } as any)
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored)

    const makeCamera = () => {
      const halfW = container.clientWidth / (PIXELS_PER_CELL * 2)
      const halfH = container.clientHeight / (PIXELS_PER_CELL * 2)
      const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -100, 100)
      camera.position.set(0, 0, 10)
      camera.lookAt(0, 0, 0)
      return camera
    }

    const camera = makeCamera()
    cameraRef.current = camera
    orthoRef.current = camera

    const buildGrid = () => {
      if (gridGroupRef.current) {
        scene.remove(gridGroupRef.current)
        gridGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        gridGroupRef.current = null
      }
      const gridGroup = new THREE.Group()
      const sizeX = width
      const sizeY = height

      const vertMaterial = new THREE.LineBasicMaterial({ color: 0x444444 })
      const halfSizeX = Math.floor(sizeX / 2)
      const halfSizeY = Math.floor(sizeY / 2)

      for (let i = 0; i <= sizeX; i++) {
        const x = i - halfSizeX - 0.5
        const points = [new THREE.Vector3(x, -sizeY / 2, 0), new THREE.Vector3(x, sizeY / 2, 0)]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const line = new THREE.Line(geometry, vertMaterial)
        gridGroup.add(line)
      }

      const horizMaterial = new THREE.LineBasicMaterial({ color: 0x444444 })
      for (let i = 0; i <= sizeY; i++) {
        const y = i - halfSizeY - 0.5
        const points = [new THREE.Vector3(-sizeX / 2, y, 0), new THREE.Vector3(sizeX / 2, y, 0)]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const line = new THREE.Line(geometry, horizMaterial)
        gridGroup.add(line)
      }

      gridGroup.visible = showGrid
      scene.add(gridGroup)
      gridGroupRef.current = gridGroup
    }
    const buildCanvasBg = () => {
      if (canvasBgRef.current) {
        scene.remove(canvasBgRef.current)
        canvasBgRef.current.geometry.dispose()
        if (Array.isArray(canvasBgRef.current.material)) {
          canvasBgRef.current.material.forEach(m => m.dispose())
        } else {
          canvasBgRef.current.material.dispose()
        }
        canvasBgRef.current = null
      }
      const geom = new THREE.PlaneGeometry(width, height)
      const mat = new THREE.MeshBasicMaterial({ color: canvasBgColor || '#1a1918' })
      const mesh = new THREE.Mesh(geom, mat)
      // Center correction for even/odd dimensions logic in SymbolInstancedRenderer
      // X: -halfW .. width-halfW. Center is -0.5 (for even width).
      // Y: -halfH .. height-halfH. Pos is inverted. Center is 0.5 (for even height).
      // Ideally we should calculate it dynamically:
      const halfW = Math.floor(width / 2)
      const halfH = Math.floor(height / 2)
      // Range X: [-halfW, width-halfW-1]. Center X = (-halfW + width-halfW-1)/2 = (width - 2*halfW - 1)/2.
      // If width=10, halfW=5. Center = (10-10-1)/2 = -0.5.
      // If width=11, halfW=5. Center = (11-10-1)/2 = 0.
      const cx = (width - 2 * halfW - 1) / 2
      
      // Range Y (indices): [-halfH, height-halfH-1]. 
      // Pos Y = -index. Range: [-(height-halfH-1), halfH].
      // Center Y = (halfH - (height-halfH-1))/2 = (2*halfH - height + 1)/2.
      // If height=10, halfH=5. Center = (10-10+1)/2 = 0.5.
      // If height=11, halfH=5. Center = (10-11+1)/2 = 0.
      const cy = (2 * halfH - height + 1) / 2
      
      mesh.position.set(cx, cy, -0.5)
      scene.add(mesh)
      canvasBgRef.current = mesh
    }

    const buildCenterGuide = () => {
      if (centerGuideRef.current) {
        scene.remove(centerGuideRef.current)
        centerGuideRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        centerGuideRef.current = null
      }
      const group = new THREE.Group()
      const material = new THREE.LineBasicMaterial({ color: 0xffd54a })
      const vLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -height / 2 - 1, 0),
        new THREE.Vector3(0, height / 2 + 1, 0)
      ]), material)
      const hLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width / 2 - 1, 0, 0),
        new THREE.Vector3(width / 2 + 1, 0, 0)
      ]), material)
      group.add(vLine, hLine)
      group.visible = showCenterGuide
      scene.add(group)
      centerGuideRef.current = group
    }

    const buildHoverOverlay = () => {
      if (hoverGroupRef.current) {
        scene.remove(hoverGroupRef.current)
        hoverGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        hoverGroupRef.current = null
      }
      if (!cursorPos) return
      const group = new THREE.Group()
      const mat = new THREE.LineBasicMaterial({ color: 0xbbbbbb })
      const x0 = cursorPos.x - 0.5
      const y0 = -cursorPos.y + 0.5
      const x1 = x0 + 1
      const y1 = y0 - 1
      const points = [
        new THREE.Vector3(x0, y0, 0),
        new THREE.Vector3(x1, y0, 0),
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(x0, y1, 0),
        new THREE.Vector3(x0, y0, 0),
      ]
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat)
      group.add(line)
      scene.add(group)
      hoverGroupRef.current = group
    }

    const buildSelectionPath = () => {
      if (pathGroupRef.current) {
        scene.remove(pathGroupRef.current)
        pathGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        pathGroupRef.current = null
      }
      if (!selectionPath || selectionPath.length === 0) return
      const group = new THREE.Group()
      const mat = overlayMaterialsRef.current?.borderMat || new THREE.LineDashedMaterial({ color: 0xffd54a, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 1 })
      const pts: THREE.Vector3[] = []
      const shapePts: THREE.Vector2[] = []
      for (const p of selectionPath) {
        const x = p.x - 0.5
        const y = -p.y + 0.5
        pts.push(new THREE.Vector3(x, y, 0))
        shapePts.push(new THREE.Vector2(x, y))
      }
      if (pts.length > 1) pts.push(pts[0].clone())
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat)
      ;(line as any).computeLineDistances?.()
      
      if (shapePts.length > 2) {
        const shape = new THREE.Shape(shapePts)
        const shapeGeom = new THREE.ShapeGeometry(shape)
        const fillMat = overlayMaterialsRef.current?.fillMat || new THREE.MeshBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.2 })
        const fillMesh = new THREE.Mesh(shapeGeom, fillMat)
        fillMesh.position.z = -0.01
        group.add(fillMesh)
      }
      
      group.add(line)
      scene.add(group)
      pathGroupRef.current = group
    }

    const buildSelectionMask = () => {
      if (maskGroupRef.current) {
        scene.remove(maskGroupRef.current)
        maskGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          // Do not dispose shared materials from maskMaterialsRef
          if ((mesh as any).material && (mesh as any).material !== maskMaterialsRef.current?.fillMat && (mesh as any).material !== maskMaterialsRef.current?.borderMat) {
            (mesh as any).material.dispose()
          }
        })
        maskGroupRef.current = null
      }
      if (!selectionMask || selectionMask.size === 0) {
        return
      }
      // Ensure no rectangular overlay remains when mask is active
      if (selectionGroupRef.current) {
        scene.remove(selectionGroupRef.current)
        selectionGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material && (mesh as any).material !== overlayMaterialsRef.current?.fillMat && (mesh as any).material !== overlayMaterialsRef.current?.borderMat) {
            (mesh as any).material.dispose()
          }
        })
        selectionGroupRef.current = null
      }
      const group = new THREE.Group()
      
      const mat = maskMaterialsRef.current?.borderMat || new THREE.LineDashedMaterial({ color: 0xffd54a, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 1 })
      const fillMat = maskMaterialsRef.current?.fillMat || new THREE.MeshBasicMaterial({ color: 0x4a4a4a, transparent: true, opacity: 0.2 })

      const fillGeom = new THREE.PlaneGeometry(1, 1)
      const fillMesh = new THREE.InstancedMesh(fillGeom, fillMat, selectionMask.size)
      const fillDummy = new THREE.Object3D()
      const segments: number[] = []
      let fillIndex = 0
      selectionMask.forEach(key => {
        const [sx, sy] = key.split(',').map(Number)
        
        fillDummy.position.set(sx, -sy, -0.01)
        fillDummy.updateMatrix()
        fillMesh.setMatrixAt(fillIndex, fillDummy.matrix)
        fillIndex += 1

        const x0 = sx - 0.5
        const y0 = -sy + 0.5
        const x1 = x0 + 1
        const y1 = y0 - 1

        // Top edge (neighbor sy-1)
        if (!selectionMask.has(`${sx},${sy - 1}`)) {
          segments.push(x0, y0, 0, x1, y0, 0)
        }
        // Bottom edge (neighbor sy+1)
        if (!selectionMask.has(`${sx},${sy + 1}`)) {
          segments.push(x0, y1, 0, x1, y1, 0)
        }
        // Left edge (neighbor sx-1)
        if (!selectionMask.has(`${sx - 1},${sy}`)) {
          segments.push(x0, y0, 0, x0, y1, 0)
        }
        // Right edge (neighbor sx+1)
        if (!selectionMask.has(`${sx + 1},${sy}`)) {
          segments.push(x1, y0, 0, x1, y1, 0)
        }
      })
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
      const lines = new THREE.LineSegments(geometry, mat)
      ;(lines as any).computeLineDistances?.()
      fillMesh.instanceMatrix.needsUpdate = true
      group.add(fillMesh, lines)
      scene.add(group)
      maskGroupRef.current = group
    }

    const renderOnce = () => {
      renderActive()
    }

    const worldPanX = -panRef.current.x / (PIXELS_PER_CELL * Math.max(0.1, zoomRef.current))
    const worldPanY = panRef.current.y / (PIXELS_PER_CELL * Math.max(0.1, zoomRef.current))
    camera.position.set(worldPanX, worldPanY, 10)
    camera.zoom = Math.max(0.1, zoomRef.current)
    camera.lookAt(worldPanX, worldPanY, 0)
    camera.updateProjectionMatrix()

    const handleResize = () => {
      if (!container || !rendererRef.current) return
      rendererRef.current.setPixelRatio(window.devicePixelRatio)
      rendererRef.current.setSize(container.clientWidth, container.clientHeight)
      if (effectRef.current) {
        const fs = useEditorStore.getState().asciiFontSize
        effectRef.current.setSize(container.clientWidth, container.clientHeight)
        const el = effectRef.current.domElement
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.pointerEvents = 'all'
        el.style.userSelect = 'none'
        el.style.fontSize = `${fs}px`
        el.style.lineHeight = `${fs}px`
      }
      const currentTab = useEditorStore.getState().activeTab
      if (orthoRef.current) {
        const halfW = container.clientWidth / (PIXELS_PER_CELL * 2)
        const halfH = container.clientHeight / (PIXELS_PER_CELL * 2)
        orthoRef.current.left = -halfW
        orthoRef.current.right = halfW
        orthoRef.current.top = halfH
        orthoRef.current.bottom = -halfH
        orthoRef.current.updateProjectionMatrix()
      }
      if (orthoRef.current && currentTab !== '3D') {
        const worldPanX = -panRef.current.x / (PIXELS_PER_CELL * Math.max(0.1, zoomRef.current))
        const worldPanY = panRef.current.y / (PIXELS_PER_CELL * Math.max(0.1, zoomRef.current))
        const halfW = (orthoRef.current.right - orthoRef.current.left) / (2 * orthoRef.current.zoom)
        const halfH = (orthoRef.current.top - orthoRef.current.bottom) / (2 * orthoRef.current.zoom)
        const margin = 2
        const viewRect = {
          minX: worldPanX - halfW - margin,
          maxX: worldPanX + halfW + margin,
          minY: worldPanY - halfH - margin,
          maxY: worldPanY + halfH + margin,
        }
        symbolsRef.current?.setViewRect(viewRect)
        onionRef.current?.setViewRect(viewRect)
      } else {
        symbolsRef.current?.setViewRect(null)
        onionRef.current?.setViewRect(null)
      }
      if (currentTab !== '3D') renderOnce()
    }

    buildCanvasBg()
    buildGrid()
    buildCenterGuide()
    buildHoverOverlay()
    buildSelectionPath()
    buildSelectionMask()
    ;(async () => {
      const symbols = new SymbolInstancedRenderer()
      symbols.setScene(scene)
      symbols.setRenderMode(useEditorStore.getState().activeTab === '3D' && useEditorStore.getState().renderMode3D === 'voxel' ? 'voxel' : 'plane')
      symbols.setLayerSpacingZ(useEditorStore.getState().activeTab === '3D' ? useEditorStore.getState().layerDepth3D : 0.001)
      symbolsRef.current = symbols
      const frame = useProjectStore.getState().frames[useProjectStore.getState().activeFrameIndex] ?? null
      await symbols.buildFromFrame(frame || null, width, height)
      // Force render after async build
      renderOnce()
      if (onionSkinEnabled) {
        const onion = new SymbolInstancedRenderer()
        onion.setScene(scene)
        onion.setOpacity(0.3)
        onion.setRenderMode(useEditorStore.getState().activeTab === '3D' && useEditorStore.getState().renderMode3D === 'voxel' ? 'voxel' : 'plane')
        onion.setLayerSpacingZ(useEditorStore.getState().activeTab === '3D' ? useEditorStore.getState().layerDepth3D : 0.001)
        onionRef.current = onion
        const prev = useProjectStore.getState().frames[Math.max(0, useProjectStore.getState().activeFrameIndex - 1)] ?? null
        await onion.buildFromFrame(prev || null, width, height)
      }
      renderOnce()
    })()

    const ro = new ResizeObserver(handleResize)
    ro.observe(container)
    resizeObserverRef.current = ro
    // В режиме overlay ввод обрабатывает CanvasRenderer; здесь ничего не навешиваем

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
      if (symbolsRef.current) {
        symbolsRef.current.dispose()
        symbolsRef.current = null
      }
      if (onionRef.current) {
        onionRef.current.dispose()
        onionRef.current = null
      }
      if (gridGroupRef.current) {
        gridGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
      }
      if (centerGuideRef.current) {
        centerGuideRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
      }
      if (canvasBgRef.current) {
        canvasBgRef.current.geometry.dispose()
        if (Array.isArray(canvasBgRef.current.material)) {
          canvasBgRef.current.material.forEach(m => m.dispose())
        } else {
          canvasBgRef.current.material.dispose()
        }
      }
      if (rendererRef.current) {
        const canvas = rendererRef.current.domElement
        canvas.removeEventListener('webglcontextlost', handleContextLost as any)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored as any)
        canvas.remove()
        rendererRef.current.dispose()
      }
      if (controlsRef.current) {
        if (controlsChangeHandlerRef.current) {
          controlsRef.current.removeEventListener('change', controlsChangeHandlerRef.current)
        }
        if (controlsEndHandlerRef.current) {
          controlsRef.current.removeEventListener('end', controlsEndHandlerRef.current)
        }
        controlsRef.current.dispose()
        controlsRef.current = null
        controlsChangeHandlerRef.current = null
        controlsEndHandlerRef.current = null
      }
      if (effectRef.current) {
        effectRef.current.domElement.remove()
        effectRef.current = null
      }
      if (selectionGroupRef.current) {
        selectionGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
      }
      if (hoverGroupRef.current) {
        hoverGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
      }
      if (floatingGroupRef.current) {
        floatingGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
      }
      sceneRef.current = null
      cameraRef.current = null
      rendererRef.current = null
      gridGroupRef.current = null
      floatingGroupRef.current = null
      canvasBgRef.current = null
      centerGuideRef.current = null
      selectionGroupRef.current = null
      hoverGroupRef.current = null
      pathGroupRef.current = null
      maskGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.background = new THREE.Color(workspaceColor || '#111')
    if (canvasBgRef.current) {
      const mat = canvasBgRef.current.material as THREE.MeshBasicMaterial
      mat.color.set(canvasBgColor || '#1a1918')
    }
    if (gridGroupRef.current) gridGroupRef.current.visible = showGrid
    if (centerGuideRef.current) centerGuideRef.current.visible = showCenterGuide
    renderActive()
  }, [workspaceColor, canvasBgColor, showGrid, showCenterGuide])

  useEffect(() => {
    if (!sceneRef.current) return
    const scene = sceneRef.current
    const asciiActive = activeTab === '3D' && asciiMode3D
    if (asciiActive) {
      scene.background = new THREE.Color('#000')
      rendererRef.current?.setClearColor(0x000000, 1)
      if (canvasBgRef.current) canvasBgRef.current.visible = false
      if (gridGroupRef.current) gridGroupRef.current.visible = false
      if (centerGuideRef.current) centerGuideRef.current.visible = false
    } else {
      scene.background = new THREE.Color(workspaceColor || '#111')
      rendererRef.current?.setClearColor(new THREE.Color(workspaceColor || '#111'), 1)
      if (canvasBgRef.current) canvasBgRef.current.visible = true
      if (gridGroupRef.current) gridGroupRef.current.visible = showGrid
      if (centerGuideRef.current) centerGuideRef.current.visible = showCenterGuide
    }
    renderActive()
  }, [activeTab, asciiMode3D, asciiFillBackground3D, workspaceColor, showGrid, showCenterGuide, width, height])

  useEffect(() => {
    const container = containerRef.current
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!container || !renderer || !camera) return

    if (activeTab !== '3D') {
      renderer.domElement.style.display = 'block'
      if (effectRef.current) effectRef.current.domElement.style.display = 'none'
      if (controlsRef.current) {
        if (controlsChangeHandlerRef.current) {
          controlsRef.current.removeEventListener('change', controlsChangeHandlerRef.current)
        }
        if (controlsEndHandlerRef.current) {
          controlsRef.current.removeEventListener('end', controlsEndHandlerRef.current)
        }
        controlsRef.current.dispose()
        controlsRef.current = null
        controlsChangeHandlerRef.current = null
        controlsEndHandlerRef.current = null
      }
      renderActive()
      return
    }

    let domElement: HTMLElement = renderer.domElement
    if (asciiMode3D) {
      const chars = asciiFillBackground3D ? '@%#*+=-:. ' : ' .:-=+*#%@'
      const needNewEffect = !effectRef.current || (effectRef.current as any)._bytefallChars !== chars
      if (needNewEffect) {
        if (effectRef.current?.domElement?.parentElement) effectRef.current.domElement.parentElement.removeChild(effectRef.current.domElement)
        effectRef.current = new AsciiEffect(renderer, chars, { invert: false })
        ;(effectRef.current as any)._bytefallChars = chars
      }
      const effect = effectRef.current
      if (!effect) return
      const el = effect.domElement
      if (el.parentElement !== container) {
        container.appendChild(el)
      }
      el.style.width = '100%'
      el.style.height = '100%'
      el.style.pointerEvents = 'all'
      el.style.userSelect = 'none'
      el.style.backgroundColor = 'black'
      el.style.fontSize = `${asciiFontSize}px`
      el.style.lineHeight = `${asciiFontSize}px`
      effect.setSize(container.clientWidth, container.clientHeight)
      renderer.domElement.style.display = 'none'
      el.style.display = 'block'
      domElement = el
    } else {
      renderer.domElement.style.display = 'block'
      if (effectRef.current) effectRef.current.domElement.style.display = 'none'
      domElement = renderer.domElement
    }

    const needNewControls =
      !controlsRef.current ||
      (controlsRef.current.object as any) !== camera ||
      (controlsRef.current.domElement as any) !== domElement

    if (needNewControls) {
      const oldTarget = controlsRef.current?.target.clone()
      if (controlsRef.current) {
        if (controlsChangeHandlerRef.current) {
          controlsRef.current.removeEventListener('change', controlsChangeHandlerRef.current)
        }
        if (controlsEndHandlerRef.current) {
          controlsRef.current.removeEventListener('end', controlsEndHandlerRef.current)
        }
        controlsRef.current.dispose()
      }

      const controls = new OrbitControls(camera as any, domElement)
      controls.enableDamping = false
      controls.autoRotate = autoRotate3D

      const store = useEditorStore.getState()
      const stored = store.cameraState3D
      if (oldTarget) controls.target.copy(oldTarget)
      else if (stored?.target) controls.target.set(stored.target[0], stored.target[1], stored.target[2])

      const onChange = () => {
        if (syncingControlsRef.current) return
        renderActive()
      }

      const onEnd = () => {
        if (syncingControlsRef.current) return
        const cam = cameraRef.current
        if (!cam) return
        const state = useEditorStore.getState()
        const t = controls.target
        const next = {
          position: [cam.position.x, cam.position.y, cam.position.z] as [number, number, number],
          target: [t.x, t.y, t.z] as [number, number, number],
        }
        const prev = state.cameraState3D
        const eps = 1e-4
        const same =
          Boolean(prev) &&
          Math.abs(prev!.position[0] - next.position[0]) < eps &&
          Math.abs(prev!.position[1] - next.position[1]) < eps &&
          Math.abs(prev!.position[2] - next.position[2]) < eps &&
          Math.abs(prev!.target[0] - next.target[0]) < eps &&
          Math.abs(prev!.target[1] - next.target[1]) < eps &&
          Math.abs(prev!.target[2] - next.target[2]) < eps
        if (!same) state.setCameraState3D(next)
        if (cam instanceof THREE.OrthographicCamera) {
          const zSame = Math.abs(state.cameraZoom3D - cam.zoom) < eps
          if (!zSame) state.setCameraZoom3D(cam.zoom)
        }
      }

      controls.addEventListener('change', onChange)
      controls.addEventListener('end', onEnd)
      controlsRef.current = controls
      controlsChangeHandlerRef.current = onChange
      controlsEndHandlerRef.current = onEnd
      controls.update()
    } else if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate3D
      controlsRef.current.update()
    }

    renderActive()
  }, [activeTab, asciiMode3D, asciiFillBackground3D, asciiFontSize, autoRotate3D, cameraRevision])

  useEffect(() => {
    if (activeTab !== '3D') return
    if (!asciiMode3D) return
    if (!effectRef.current || !containerRef.current) return
    const container = containerRef.current
    const el = effectRef.current.domElement
    el.style.fontSize = `${asciiFontSize}px`
    el.style.lineHeight = `${asciiFontSize}px`
    effectRef.current.setSize(container.clientWidth, container.clientHeight)
    renderActive()
  }, [activeTab, asciiMode3D, asciiFontSize])

  // 1. Confirmed Selection Rendering (Always Yellow, Solid, Low Opacity)
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    if (!selectionGroupRef.current && !selection) return
    const scene = sceneRef.current
    const build = () => {
      if (selectionGroupRef.current) {
        scene.remove(selectionGroupRef.current)
        selectionGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material && (mesh as any).material !== overlayMaterialsRef.current?.fillMat && (mesh as any).material !== overlayMaterialsRef.current?.borderMat) {
            (mesh as any).material.dispose()
          }
        })
        selectionGroupRef.current = null
      }
      selectionFillMatRef.current = null
      
      if (!selection) return
      if (selectionMask && selectionMask.size > 0) return
      if (selectionPath && selectionPath.length > 0) return
      
      // If we are dragging a NEW selection (select/lasso), we might want to hide the OLD selection if mode is 'new'
      // But typically we keep showing it until the new one is confirmed.
      // However, if we are moving the selection itself, we handle that via dragOffset on this group.
      
      const group = new THREE.Group()
      
      // Confirmed Selection Style: Yellow, Solid, Low Opacity
      const color = COLOR_YELLOW
      
      // Update shared material uniforms for this render pass?
      // Issue: Shared material means if we render Preview (Green) and Confirmed (Yellow) same frame, one wins.
      // Solution: Create separate material instances or clone.
      // Since we want specific "Yellow lines + Dark Grey", we need to clone or set uniforms.
      // Cloning ShaderMaterial is cheap-ish.
      
      let fillMat = overlayMaterialsRef.current?.fillMat.clone()
      if (fillMat) {
        fillMat.uniforms.uColor.value.set(color)
        fillMat.uniforms.uSecondaryColor.value.set(COLOR_DARK_GREY)
        fillMat.uniforms.uOpacity.value = 0.1
        selectionFillMatRef.current = fillMat
      } else {
        fillMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.1 }) as any
      }

      // Solid Border
      const borderMat = new THREE.LineBasicMaterial({ color: color })

      const x0 = selection.x - 0.5
      const y0 = -selection.y + 0.5
      const x1 = x0 + selection.w
      const y1 = y0 - selection.h
      const points = [
        new THREE.Vector3(x0, y0, 0),
        new THREE.Vector3(x1, y0, 0),
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(x0, y1, 0),
        new THREE.Vector3(x0, y0, 0),
      ]
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), borderMat)
      
      const rectShape = new THREE.Shape([
        new THREE.Vector2(x0, y0),
        new THREE.Vector2(x1, y0),
        new THREE.Vector2(x1, y1),
        new THREE.Vector2(x0, y1),
        new THREE.Vector2(x0, y0),
      ])
      const fillGeom = new THREE.ShapeGeometry(rectShape)
      const fill = new THREE.Mesh(fillGeom, fillMat)
      fill.position.set(0, 0, -0.01)
      
      group.add(fill, line)
      scene.add(group)
      selectionGroupRef.current = group
    }
    build()
    renderActive()
  }, [selection, selectionMask, selectionPath, activeTab])

  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    const build = async () => {
      if (hoverGroupRef.current) {
        scene.remove(hoverGroupRef.current)
        hoverGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        hoverGroupRef.current = null
      }
      if (!cursorPos) return
      const group = new THREE.Group()
      const mat = new THREE.LineBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.9 })
      const x0 = cursorPos.x - 0.5
      const y0 = -cursorPos.y + 0.5
      const x1 = x0 + 1
      const y1 = y0 - 1
      const points = [
        new THREE.Vector3(x0, y0, 0),
        new THREE.Vector3(x1, y0, 0),
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(x0, y1, 0),
        new THREE.Vector3(x0, y0, 0),
      ]
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat)
      group.add(line)
      // No glyph preview here: Canvas overlay handles RMB/LMB-specific glyph preview
      scene.add(group)
      hoverGroupRef.current = group
    }
    build()
    renderActive()
    return () => {}
  }, [cursorPos, activeTool, brushChar, brushColor, secondaryChar, secondaryColor, width, height])

  // 2. Preview Rendering (Dashed, Colored, High Opacity)
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    
    // Clear previous preview
    if (previewGroupRef.current) {
      scene.remove(previewGroupRef.current)
      previewGroupRef.current.traverse(obj => {
        const mesh = obj as THREE.Line
        if ((mesh as any).geometry) (mesh as any).geometry.dispose()
        if ((mesh as any).material) (mesh as any).material.dispose()
      })
      previewGroupRef.current = null
    }
    previewFillMatRef.current = null

    if (!isDragging) return
    if (activeTool !== 'select' && activeTool !== 'lasso') return

    // Determine Mode Color (live modifiers override)
    let effectiveMode = selectionMode
    if (modifiersRef.current.ctrl) effectiveMode = 'new'
    else if (modifiersRef.current.shift && modifiersRef.current.alt) effectiveMode = 'intersect'
    else if (modifiersRef.current.shift) effectiveMode = 'add'
    else if (modifiersRef.current.alt) effectiveMode = 'subtract'

    let color = COLOR_YELLOW
    if (effectiveMode === 'add') color = COLOR_GREEN
    if (effectiveMode === 'subtract') color = COLOR_RED
    if (effectiveMode === 'intersect') color = COLOR_BLUE

    const group = new THREE.Group()
    
    // Fill Material (Cloned)
    let fillMat = overlayMaterialsRef.current?.fillMat.clone()
    if (fillMat) {
      fillMat.uniforms.uColor.value.set(color)
      fillMat.uniforms.uSecondaryColor.value.set(COLOR_DARK_GREY)
      fillMat.uniforms.uOpacity.value = 0.2
      previewFillMatRef.current = fillMat
    } else {
      fillMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.2 }) as any
      previewFillMatRef.current = null
    }

    // Border Material (Dashed)
    const borderMat = new THREE.LineDashedMaterial({ 
      color: color, 
      dashSize: 0.6, 
      gapSize: 0.4, 
      transparent: true, 
      opacity: 1.0 
    })

    if (activeTool === 'select' && dragStartPos && cursorPos) {
      const minX = Math.min(dragStartPos.x, cursorPos.x)
      const maxX = Math.max(dragStartPos.x, cursorPos.x)
      const minY = Math.min(dragStartPos.y, cursorPos.y)
      const maxY = Math.max(dragStartPos.y, cursorPos.y)
      const w = maxX - minX + 1
      const h = maxY - minY + 1
      
      const x0 = minX - 0.5
      const y0 = -minY + 0.5
      const x1 = x0 + w
      const y1 = y0 - h
      
      const points = [
        new THREE.Vector3(x0, y0, 0),
        new THREE.Vector3(x1, y0, 0),
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(x0, y1, 0),
        new THREE.Vector3(x0, y0, 0),
      ]
      
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), borderMat)
      ;(line as any).computeLineDistances?.()
      
      const rectShape = new THREE.Shape([
        new THREE.Vector2(x0, y0),
        new THREE.Vector2(x1, y0),
        new THREE.Vector2(x1, y1),
        new THREE.Vector2(x0, y1),
        new THREE.Vector2(x0, y0),
      ])
      const fillGeom = new THREE.ShapeGeometry(rectShape)
      const fill = new THREE.Mesh(fillGeom, fillMat)
      fill.position.set(0, 0, -0.01)
      
      group.add(fill, line)
    } else if (activeTool === 'lasso' && selectionPath && selectionPath.length > 0) {
      const pts: THREE.Vector3[] = []
      const shapePts: THREE.Vector2[] = []
      for (const p of selectionPath) {
        const x = p.x - 0.5
        const y = -p.y + 0.5
        pts.push(new THREE.Vector3(x, y, 0))
        shapePts.push(new THREE.Vector2(x, y))
      }
      // Connect to cursor if needed, or just path
      if (cursorPos) {
        const x = cursorPos.x - 0.5
        const y = -cursorPos.y + 0.5
        pts.push(new THREE.Vector3(x, y, 0))
        shapePts.push(new THREE.Vector2(x, y))
      }

      if (pts.length > 0) {
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pts)
        const line = new THREE.Line(lineGeom, borderMat)
        ;(line as any).computeLineDistances?.()
        group.add(line)
        
        if (shapePts.length > 2) {
          const shape = new THREE.Shape(shapePts)
          const shapeGeom = new THREE.ShapeGeometry(shape)
          const fillMesh = new THREE.Mesh(shapeGeom, fillMat)
          fillMesh.position.z = -0.01
          group.add(fillMesh)
        }
      }
    }

    scene.add(group)
    previewGroupRef.current = group
    renderActive()
  }, [isDragging, dragStartPos, cursorPos, activeTool, selectionMode, selectionPath, activeTab, modifierVersion])

  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    const rebuild = () => {
      if (maskGroupRef.current) {
        scene.remove(maskGroupRef.current)
        maskGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material && (mesh as any).material !== maskMaterialsRef.current?.fillMat && (mesh as any).material !== maskMaterialsRef.current?.borderMat) {
            (mesh as any).material.dispose()
          }
        })
        maskGroupRef.current = null
      }
      maskFillMatRef.current = null
      if (!selectionMask || selectionMask.size === 0) return
      const group = new THREE.Group()
      
      const color = COLOR_YELLOW
      
      let fillMat = overlayMaterialsRef.current?.fillMat.clone()
      if (fillMat) {
        fillMat.uniforms.uColor.value.set(color)
        fillMat.uniforms.uSecondaryColor.value.set(COLOR_DARK_GREY)
        fillMat.uniforms.uOpacity.value = 0.1
        maskFillMatRef.current = fillMat
      } else {
        fillMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.1 }) as any
        maskFillMatRef.current = null
      }
      
      const mat = new THREE.LineBasicMaterial({ color: color })

      const fillGeom = new THREE.PlaneGeometry(1, 1)
      const fillMesh = selectionMask.size > 0 ? new THREE.InstancedMesh(fillGeom, fillMat, selectionMask.size) : null
      const fillDummy = new THREE.Object3D()
      const segments: number[] = []
      let fillIndex = 0
      
      selectionMask.forEach(key => {
        const [sx, sy] = key.split(',').map(Number)
        
        if (fillMesh) {
          fillDummy.position.set(sx, -sy, -0.01)
          fillDummy.updateMatrix()
          fillMesh.setMatrixAt(fillIndex, fillDummy.matrix)
          fillIndex += 1
        }

        const x0 = sx - 0.5
        const y0 = -sy + 0.5
        const x1 = x0 + 1
        const y1 = y0 - 1

        if (!selectionMask.has(`${sx},${sy - 1}`)) segments.push(x0, y0, 0, x1, y0, 0)
        if (!selectionMask.has(`${sx},${sy + 1}`)) segments.push(x0, y1, 0, x1, y1, 0)
        if (!selectionMask.has(`${sx - 1},${sy}`)) segments.push(x0, y0, 0, x0, y1, 0)
        if (!selectionMask.has(`${sx + 1},${sy}`)) segments.push(x1, y0, 0, x1, y1, 0)
      })
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
      const lines = new THREE.LineSegments(geometry, mat)
      
      if (fillMesh) {
        fillMesh.instanceMatrix.needsUpdate = true
        group.add(fillMesh)
      }
      group.add(lines)
      scene.add(group)
      maskGroupRef.current = group
    }
    rebuild()
    renderActive()
  }, [selectionMask, activeTab])

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
    const dx = selectionMoveOffset.x
    const dy = -selectionMoveOffset.y
    if (maskGroupRef.current) maskGroupRef.current.position.set(dx, dy, 0)
    if (pathGroupRef.current) pathGroupRef.current.position.set(dx, dy, 0)
    renderActive()
  }, [selectionMoveOffset, activeTab])
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    const rebuild = async () => {
      if (floatingGroupRef.current) {
        scene.remove(floatingGroupRef.current)
        floatingGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Mesh
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        floatingGroupRef.current = null
      }
      if (!floatingSelection || !selection || floatingSelection.length === 0) return
      const atlas = await GlyphAtlas.loadShared('/msdf')
      if (!atlas.texture) return
      const group = new THREE.Group()
      const count = floatingSelection.length
      const geom = new THREE.PlaneGeometry(1, 1)
      const uvOffset = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
      const uvScale = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
      const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
      const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
      ;(geom as any).setAttribute('instanceUvOffset', uvOffset)
      ;(geom as any).setAttribute('instanceUvScale', uvScale)
      ;(geom as any).setAttribute('instanceTint', tint)
      ;(geom as any).setAttribute('instanceAlpha', alpha)
      const mat = createSymbolMSDFMaterial(atlas.texture, atlas.pxRange)
      mat.uniforms.useMSDF.value = atlas.useMSDF ? 1 : 0
      const mesh = new THREE.InstancedMesh(geom, mat, count)
      mesh.frustumCulled = false
      const dummy = new THREE.Object3D()
      floatingSelection.forEach((item, i) => {
        const char = typeof item.data?.char === 'string' ? item.data.char : ''
        const hasChar = char.trim().length > 0
        dummy.position.set(item.dx, -item.dy, 0.1)
        if (hasChar) {
          dummy.scale.set(1, 1, 1)
          const g = atlas.getGlyph(char[0]) || atlas.getGlyph('#')
          if (g) {
            uvOffset.setXY(i, g.u0, g.v0)
            uvScale.setXY(i, g.u1 - g.u0, g.v1 - g.v0)
          }
          const color = new THREE.Color(item.data?.color || '#ffffff')
          tint.setXYZ(i, color.r, color.g, color.b)
          alpha.setX(i, 1.0)
        } else {
          dummy.scale.set(0, 0, 0)
          alpha.setX(i, 0.0)
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
      uvOffset.needsUpdate = true
      uvScale.needsUpdate = true
      tint.needsUpdate = true
      alpha.needsUpdate = true
      group.add(mesh)
      group.position.set(selection.x, -selection.y, 0)
      scene.add(group)
      floatingGroupRef.current = group
    }
    rebuild()
    renderActive()
  }, [floatingSelection, selection?.w, selection?.h])

  useEffect(() => {
    if (!floatingGroupRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return
    if (!selection) return
    floatingGroupRef.current.position.set(selection.x, -selection.y, 0)
    renderActive()
  }, [selection?.x, selection?.y, activeTab])
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    let cancelled = false
    const rebuild = async () => {
      if (previewGroupRef.current) {
        scene.remove(previewGroupRef.current)
        previewGroupRef.current.traverse(obj => {
          const mesh = obj as THREE.Line
          if ((mesh as any).geometry) (mesh as any).geometry.dispose()
          if ((mesh as any).material) (mesh as any).material.dispose()
        })
        previewGroupRef.current = null
      }
      if (!overlayDraft) {
        renderActive()
        return
      }
      const group = new THREE.Group()
      if (overlayDraft.points && overlayDraft.points.length > 0) {
        const atlas = await GlyphAtlas.loadShared('/msdf')
        if (cancelled) return
        if (atlas.texture) {
          const count = overlayDraft.points.length
          const geom = new THREE.PlaneGeometry(1, 1)
          const uvOffset = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
          const uvScale = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
          const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
          const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
          ;(geom as any).setAttribute('instanceUvOffset', uvOffset)
          ;(geom as any).setAttribute('instanceUvScale', uvScale)
          ;(geom as any).setAttribute('instanceTint', tint)
          ;(geom as any).setAttribute('instanceAlpha', alpha)
          const mat = createSymbolMSDFMaterial(atlas.texture, atlas.pxRange)
          mat.uniforms.useMSDF.value = atlas.useMSDF ? 1 : 0
          mat.uniforms.opacity.value = 0.75
          const mesh = new THREE.InstancedMesh(geom, mat, count)
          mesh.frustumCulled = false
          const dummy = new THREE.Object3D()
          const char = (brushChar || '#').trim()
          const hasChar = char.length > 0
          const g = hasChar ? (atlas.getGlyph(char[0]) || atlas.getGlyph('#')) : null
          const color = new THREE.Color(brushColor || '#ffffff')
          overlayDraft.points.forEach((p, i) => {
            dummy.position.set(p.x, -p.y, 0.1)
            if (g) {
              dummy.scale.set(1, 1, 1)
              uvOffset.setXY(i, g.u0, g.v0)
              uvScale.setXY(i, g.u1 - g.u0, g.v1 - g.v0)
              tint.setXYZ(i, color.r, color.g, color.b)
              alpha.setX(i, 1.0)
            } else {
              dummy.scale.set(0, 0, 0)
              uvOffset.setXY(i, 0, 0)
              uvScale.setXY(i, 0, 0)
              tint.setXYZ(i, 0, 0, 0)
              alpha.setX(i, 0.0)
            }
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
          })
          mesh.instanceMatrix.needsUpdate = true
          uvOffset.needsUpdate = true
          uvScale.needsUpdate = true
          tint.needsUpdate = true
          alpha.needsUpdate = true
          group.add(mesh)
        } else {
          const mat = new THREE.LineBasicMaterial({ color: 0xffffff })
          const segments: number[] = []
          overlayDraft.points.forEach(p => {
            const x0 = p.x - 0.5
            const y0 = -p.y + 0.5
            const x1 = x0 + 1
            const y1 = y0 - 1
            segments.push(
              x0, y0, 0,  x1, y0, 0,
              x1, y0, 0,  x1, y1, 0,
              x1, y1, 0,  x0, y1, 0,
              x0, y1, 0,  x0, y0, 0
            )
          })
          if (segments.length > 0) {
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3))
            group.add(new THREE.LineSegments(geometry, mat))
          }
        }
      } else if (overlayDraft.cells && overlayDraft.cells.length > 0) {
        const fillMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 })
        const fillGeom = new THREE.PlaneGeometry(1, 1)
        const fillMesh = new THREE.InstancedMesh(fillGeom, fillMat, overlayDraft.cells.length)
        const dummy = new THREE.Object3D()
        overlayDraft.cells.forEach((cell, i) => {
          dummy.position.set(cell.x, -cell.y, 0.2)
          dummy.updateMatrix()
          fillMesh.setMatrixAt(i, dummy.matrix)
          fillMesh.setColorAt(i, new THREE.Color(cell.color))
        })
        fillMesh.instanceMatrix.needsUpdate = true
        if (fillMesh.instanceColor) fillMesh.instanceColor.needsUpdate = true
        group.add(fillMesh)

        const atlas = await GlyphAtlas.loadShared('/msdf')
        if (cancelled) return
        if (atlas.texture) {
          const count = overlayDraft.cells.length
          const geom = new THREE.PlaneGeometry(1, 1)
          const uvOffset = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
          const uvScale = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2)
          const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
          const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
          ;(geom as any).setAttribute('instanceUvOffset', uvOffset)
          ;(geom as any).setAttribute('instanceUvScale', uvScale)
          ;(geom as any).setAttribute('instanceTint', tint)
          ;(geom as any).setAttribute('instanceAlpha', alpha)
          const mat = createSymbolMSDFMaterial(atlas.texture, atlas.pxRange)
          mat.uniforms.useMSDF.value = atlas.useMSDF ? 1 : 0
          mat.uniforms.opacity.value = 0.85
          const mesh = new THREE.InstancedMesh(geom, mat, count)
          mesh.frustumCulled = false
          overlayDraft.cells.forEach((cell, i) => {
            const char = (cell.char || '').trim()
            const g = char.length > 0 ? (atlas.getGlyph(char[0]) || atlas.getGlyph('#')) : null
            dummy.position.set(cell.x, -cell.y, 0.3)
            if (g) {
              dummy.scale.set(1, 1, 1)
              uvOffset.setXY(i, g.u0, g.v0)
              uvScale.setXY(i, g.u1 - g.u0, g.v1 - g.v0)
              const c = new THREE.Color(cell.color)
              tint.setXYZ(i, c.r, c.g, c.b)
              alpha.setX(i, 1.0)
            } else {
              dummy.scale.set(0, 0, 0)
              uvOffset.setXY(i, 0, 0)
              uvScale.setXY(i, 0, 0)
              tint.setXYZ(i, 0, 0, 0)
              alpha.setX(i, 0.0)
            }
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
          })
          mesh.instanceMatrix.needsUpdate = true
          uvOffset.needsUpdate = true
          uvScale.needsUpdate = true
          tint.needsUpdate = true
          alpha.needsUpdate = true
          group.add(mesh)
        }

        if (overlayDraft.dir) {
          const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff })
          const { x0, y0, x1, y1 } = overlayDraft.dir
          const p0 = new THREE.Vector3(x0, -y0, 0.4)
          const p1 = new THREE.Vector3(x1, -y1, 0.4)
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, p1]), lineMat)
          group.add(line)

          const s = 0.25
          const crossPoints = [
            new THREE.Vector3(p0.x - s, p0.y, p0.z), new THREE.Vector3(p0.x + s, p0.y, p0.z),
            new THREE.Vector3(p0.x, p0.y - s, p0.z), new THREE.Vector3(p0.x, p0.y + s, p0.z),
            new THREE.Vector3(p1.x - s, p1.y, p1.z), new THREE.Vector3(p1.x + s, p1.y, p1.z),
            new THREE.Vector3(p1.x, p1.y - s, p1.z), new THREE.Vector3(p1.x, p1.y + s, p1.z)
          ]
          const crossGeom = new THREE.BufferGeometry().setFromPoints(crossPoints)
          group.add(new THREE.LineSegments(crossGeom, lineMat))
        }
      } else if (overlayDraft.dir) {
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff })
        const { x0, y0, x1, y1 } = overlayDraft.dir
        const p0 = new THREE.Vector3(x0, -y0, 0)
        const p1 = new THREE.Vector3(x1, -y1, 0)
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, p1]), mat)
        group.add(line)
      }
      scene.add(group)
      previewGroupRef.current = group
      renderActive()
    }
    rebuild()
    return () => {
      cancelled = true
    }
  }, [overlayDraft, brushChar, brushColor, width, height])
  useEffect(() => {
    if (activeTab === '3D') return
    const cam = orthoRef.current
    if (!cam || !rendererRef.current || !sceneRef.current) return
    cameraRef.current = cam

    const worldPanX = -pan.x / (PIXELS_PER_CELL * Math.max(0.1, zoom))
    const worldPanY = pan.y / (PIXELS_PER_CELL * Math.max(0.1, zoom))
    cam.position.set(worldPanX, worldPanY, 10)
    cam.zoom = Math.max(0.1, zoom)
    cam.lookAt(worldPanX, worldPanY, 0)
    cam.updateProjectionMatrix()

    const halfW = (cam.right - cam.left) / (2 * cam.zoom)
    const halfH = (cam.top - cam.bottom) / (2 * cam.zoom)
    const margin = 2
    const viewRect = {
      minX: worldPanX - halfW - margin,
      maxX: worldPanX + halfW + margin,
      minY: worldPanY - halfH - margin,
      maxY: worldPanY + halfH + margin,
    }
    symbolsRef.current?.setViewRect(viewRect)
    onionRef.current?.setViewRect(viewRect)
    renderActive()
  }, [zoom, pan, activeTab])

  useEffect(() => {
    if (!containerRef.current) return
    if (!sceneRef.current || !rendererRef.current) return
    const container = containerRef.current

    if (activeTab === '3D') {
      const aspect = Math.max(1e-6, container.clientWidth / Math.max(1, container.clientHeight))
      const radius = Math.max(10, Math.max(width, height))
      const editor = useEditorStore.getState()
      const baseState =
        editor.cameraState3D ?? { position: [radius, radius * 0.6, radius] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
      if (!editor.cameraState3D) editor.setCameraState3D(baseState)
      const state = useEditorStore.getState().cameraState3D ?? baseState

      if (cameraType3D === 'persp') {
        if (!perspRef.current) {
          perspRef.current = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000)
        }
        perspRef.current.aspect = aspect
        perspRef.current.updateProjectionMatrix()
        perspRef.current.position.set(state.position[0], state.position[1], state.position[2])
        if (controlsRef.current && (controlsRef.current.object as any) === perspRef.current) {
          syncingControlsRef.current = true
          controlsRef.current.target.set(state.target[0], state.target[1], state.target[2])
          controlsRef.current.update()
          syncingControlsRef.current = false
        } else {
          perspRef.current.lookAt(state.target[0], state.target[1], state.target[2])
        }
        cameraRef.current = perspRef.current
      } else {
        const base = Math.max(width, height) * 0.6 + 2
        const halfW = base * aspect
        const halfH = base
        if (!ortho3DRef.current) {
          ortho3DRef.current = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 5000)
        } else {
          ortho3DRef.current.left = -halfW
          ortho3DRef.current.right = halfW
          ortho3DRef.current.top = halfH
          ortho3DRef.current.bottom = -halfH
        }
        ortho3DRef.current.zoom = cameraZoom3D
        ortho3DRef.current.updateProjectionMatrix()
        ortho3DRef.current.position.set(state.position[0], state.position[1], state.position[2])
        if (controlsRef.current && (controlsRef.current.object as any) === ortho3DRef.current) {
          syncingControlsRef.current = true
          controlsRef.current.target.set(state.target[0], state.target[1], state.target[2])
          controlsRef.current.update()
          syncingControlsRef.current = false
        } else {
          ortho3DRef.current.lookAt(state.target[0], state.target[1], state.target[2])
        }
        cameraRef.current = ortho3DRef.current
      }

      symbolsRef.current?.setViewRect(null)
      onionRef.current?.setViewRect(null)
      renderActive()
      return
    }

    if (orthoRef.current) {
      cameraRef.current = orthoRef.current
      renderActive()
    }
  }, [activeTab, width, height, cameraType3D, cameraZoom3D, cameraState3D])

  useEffect(() => {
    if (activeTab !== '3D') return
    const key = `${cameraType3D}:${width}x${height}`
    if (key === last3DCameraKeyRef.current) return
    last3DCameraKeyRef.current = key
    setCameraRevision(v => v + 1)
  }, [activeTab, cameraType3D, width, height])

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current) return

    const animate2D = activeTab !== '3D' && Boolean(selection || selectionMask || selectionPath || overlayDraft)
    const animate3D = activeTab === '3D' && autoRotate3D
    if (!animate2D && !animate3D) return
    if (animate3D) controlsClockRef.current = new THREE.Clock()

    const tick = () => {
      const t = performance.now() / 1000
      const setTime = (mat: THREE.Material | null | undefined) => {
        const anyMat = mat as any
        if (!anyMat?.uniforms?.uTime) return
        anyMat.uniforms.uTime.value = t
      }
      setTime(overlayMaterialsRef.current?.fillMat)
      setTime(maskMaterialsRef.current?.fillMat)
      setTime(selectionFillMatRef.current)
      setTime(previewFillMatRef.current)
      setTime(maskFillMatRef.current)

      const updateDash = (group: THREE.Group | null) => {
        if (!group) return
        group.traverse(obj => {
          const anyMat = (obj as any).material
          if (anyMat && typeof anyMat.dashOffset === 'number') {
            anyMat.dashOffset = -t * 1.2
          }
        })
      }
      updateDash(selectionGroupRef.current)
      updateDash(previewGroupRef.current)
      updateDash(pathGroupRef.current)
      updateDash(maskGroupRef.current)

      if (animate3D) {
        const dt = controlsClockRef.current.getDelta()
        ;(controlsRef.current as any)?.update?.(dt)
        renderActive()
      } else if (animate2D && orthoRef.current) {
        renderActive()
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [activeTab, autoRotate3D, width, height, selection, selectionMask, selectionPath, overlayDraft])

  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current || !containerRef.current) return
    // Rebuild camera and grid on size change
    const container = containerRef.current
    const halfW = container.clientWidth / (PIXELS_PER_CELL * 2)
    const halfH = container.clientHeight / (PIXELS_PER_CELL * 2)
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -100, 100)
    const worldPanX = -panRef.current.x / (PIXELS_PER_CELL * Math.max(0.1, zoomRef.current))
    const worldPanY = panRef.current.y / (PIXELS_PER_CELL * Math.max(0.1, zoomRef.current))
    camera.position.set(worldPanX, worldPanY, 10)
    camera.zoom = Math.max(0.1, zoomRef.current)
    camera.lookAt(worldPanX, worldPanY, 0)
    orthoRef.current = camera
    if (activeTab !== '3D') {
      cameraRef.current = camera
    }

    const scene = sceneRef.current
    if (canvasBgRef.current) {
      scene.remove(canvasBgRef.current)
      canvasBgRef.current.geometry.dispose()
      if (Array.isArray(canvasBgRef.current.material)) {
        canvasBgRef.current.material.forEach(m => m.dispose())
      } else {
        canvasBgRef.current.material.dispose()
      }
      canvasBgRef.current = null
    }
    const bgGeom = new THREE.PlaneGeometry(width, height)
    const bgMat = new THREE.MeshBasicMaterial({ color: canvasBgColor || '#1a1918' })
    const bgMesh = new THREE.Mesh(bgGeom, bgMat)
    
    // Center correction for even/odd dimensions
    const projHalfW = Math.floor(width / 2)
    const projHalfH = Math.floor(height / 2)
    const cx = (width - 2 * projHalfW - 1) / 2
    const cy = (2 * projHalfH - height + 1) / 2
    
    bgMesh.position.set(cx, cy, -0.5)
    scene.add(bgMesh)
    canvasBgRef.current = bgMesh

    // Rebuild grid
    if (gridGroupRef.current) {
      scene.remove(gridGroupRef.current)
      gridGroupRef.current.traverse(obj => {
        const mesh = obj as THREE.Line
        if ((mesh as any).geometry) (mesh as any).geometry.dispose()
        if ((mesh as any).material) (mesh as any).material.dispose()
      })
      gridGroupRef.current = null
    }

    const gridGroup = new THREE.Group()
    const sizeX = width
    const sizeY = height
    const vertMaterial = new THREE.LineBasicMaterial({ color: 0x444444 })
    const halfSizeX = Math.floor(sizeX / 2)
    const halfSizeY = Math.floor(sizeY / 2)
    
    for (let i = 0; i <= sizeX; i++) {
      const x = i - halfSizeX - 0.5
      const points = [new THREE.Vector3(x, -sizeY / 2, 0), new THREE.Vector3(x, sizeY / 2, 0)]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, vertMaterial)
      gridGroup.add(line)
    }
    const horizMaterial = new THREE.LineBasicMaterial({ color: 0x444444 })
    for (let i = 0; i <= sizeY; i++) {
      const y = i - halfSizeY - 0.5
      const points = [new THREE.Vector3(-sizeX / 2, y, 0), new THREE.Vector3(sizeX / 2, y, 0)]
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geometry, horizMaterial)
      gridGroup.add(line)
    }
    gridGroup.visible = showGrid
    scene.add(gridGroup)
    gridGroupRef.current = gridGroup

    rendererRef.current.setPixelRatio(window.devicePixelRatio)
    rendererRef.current.setSize(container.clientWidth, container.clientHeight)
    renderActive()
  }, [width, height])

  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    const frame = useProjectStore.getState().frames[useProjectStore.getState().activeFrameIndex] ?? null
    ;(async () => {
      if (symbolsRef.current) {
        symbolsRef.current.setScene(scene)
        symbolsRef.current.setRenderMode(activeTab === '3D' && renderMode3D === 'voxel' ? 'voxel' : 'plane')
        symbolsRef.current.setLayerSpacingZ(activeTab === '3D' ? layerDepth3D : 0.001)
        await symbolsRef.current.buildFromFrame(frame, width, height)
      }
      renderActive()
    })()
  }, [frameVersion, activeFrameIndex, width, height, activeTab, renderMode3D, layerDepth3D])

  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    if (activeTab !== '3D') return
    const scene = sceneRef.current
    const frame = useProjectStore.getState().frames[useProjectStore.getState().activeFrameIndex] ?? null
    ;(async () => {
      if (symbolsRef.current) {
        symbolsRef.current.setScene(scene)
        symbolsRef.current.setRenderMode(renderMode3D === 'voxel' ? 'voxel' : 'plane')
        symbolsRef.current.setLayerSpacingZ(layerDepth3D)
        await symbolsRef.current.buildFromFrame(frame, width, height)
      }
      if (onionSkinEnabled && onionRef.current) {
        onionRef.current.setScene(scene)
        onionRef.current.setRenderMode(renderMode3D === 'voxel' ? 'voxel' : 'plane')
        onionRef.current.setLayerSpacingZ(layerDepth3D)
        const prev = useProjectStore.getState().frames[Math.max(0, useProjectStore.getState().activeFrameIndex - 1)] ?? null
        await onionRef.current.buildFromFrame(prev || null, width, height)
      }
      renderActive()
    })()
  }, [renderMode3D, layerDepth3D, activeTab, width, height, onionSkinEnabled])

  useEffect(() => {
    if (!lastUpdates) return
    const state = useProjectStore.getState()
    if (state.activeFrameIndex !== lastUpdates.frameIndex) return
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    const scene = sceneRef.current
    const frame = state.frames[state.activeFrameIndex] ?? null
    ;(async () => {
      if (symbolsRef.current) {
        symbolsRef.current.setScene(scene)
        symbolsRef.current.setRenderMode(activeTab === '3D' && renderMode3D === 'voxel' ? 'voxel' : 'plane')
        symbolsRef.current.setLayerSpacingZ(activeTab === '3D' ? layerDepth3D : 0.001)
        const layer = frame?.layers.find(l => l.id === lastUpdates.layerId)
        const ok = layer
          ? symbolsRef.current.applyUpdates(
              lastUpdates.updates,
              width,
              height,
              lastUpdates.layerId,
              typeof layer.opacity === 'number' ? layer.opacity : 1.0,
              Boolean(layer.visible)
            )
          : false
        if (!ok) {
          await symbolsRef.current.buildFromFrame(frame, width, height)
        }
      }
      renderActive()
    })()
  }, [lastUpdates, width, height, activeTab, renderMode3D, layerDepth3D])

  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return
    if (!onionSkinEnabled) {
      if (onionRef.current) {
        onionRef.current.setScene(null)
        onionRef.current.dispose()
        onionRef.current = null
        renderActive()
      }
      return
    }
    ;(async () => {
      if (!onionRef.current) {
        const onion = new SymbolInstancedRenderer()
        onion.setScene(sceneRef.current!)
        onion.setOpacity(0.3)
        onionRef.current = onion
      }
      onionRef.current!.setRenderMode(activeTab === '3D' && renderMode3D === 'voxel' ? 'voxel' : 'plane')
      onionRef.current!.setLayerSpacingZ(activeTab === '3D' ? layerDepth3D : 0.001)
      const prev = frames[Math.max(0, activeFrameIndex - 1)] ?? null
      await onionRef.current!.buildFromFrame(prev, width, height)
      renderActive()
    })()
  }, [onionSkinEnabled, activeFrameIndex, frameVersion, width, height, activeTab, renderMode3D, layerDepth3D])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
