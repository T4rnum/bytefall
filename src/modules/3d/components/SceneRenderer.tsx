import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js'
import { NumberDragger } from '../../../components/UI/NumberDragger'
import { useProjectStore } from '../../2d/store/projectStore'
import { useEditorStore } from '../../2d/store/editorStore'
import styles from './SceneRenderer.module.scss'

export const SceneRenderer = () => {
  const { frames, activeFrameIndex, width: projectWidth, height: projectHeight } = useProjectStore()
  const renderMode3D = useEditorStore(state => state.renderMode3D)
  const setRenderMode3D = useEditorStore(state => state.setRenderMode3D)
  const autoRotate3D = useEditorStore(state => state.autoRotate3D)
  const setAutoRotate3D = useEditorStore(state => state.setAutoRotate3D)
  const asciiMode3D = useEditorStore(state => state.asciiMode3D)
  const setAsciiMode3D = useEditorStore(state => state.setAsciiMode3D)
  const asciiFontSize = useEditorStore(state => state.asciiFontSize)
  const setAsciiFontSize = useEditorStore(state => state.setAsciiFontSize)
  const cameraState3D = useEditorStore(state => state.cameraState3D)
  const setCameraState3D = useEditorStore(state => state.setCameraState3D)

  const [lightIntensity] = useState(1.2)
  const [showGrid3D, setShowGrid3D] = useState(true)
  const [useLights, setUseLights] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const voxelGroupRef = useRef<THREE.Group | null>(null)
  const gridHelperRef = useRef<THREE.GridHelper | null>(null)
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null)
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const effectRef = useRef<any>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  // Helper to create texture from char
  const createCharTexture = (char: string, color: string, bgColor: string, lit: boolean) => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return null

    // Background
    if (bgColor) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, 128, 128)
    } else {
        ctx.clearRect(0, 0, 128, 128)
    }

    // Char
    if (char) {
        ctx.fillStyle = color || '#ffffff'
        ctx.font = 'bold 80px "Press Start 2P"'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // x=64 is center of the 128x128 canvas
        ctx.fillText(char, 64, 64)
    }
    
    // Border
    ctx.strokeStyle = lit ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 4
    ctx.strokeRect(0, 0, 128, 128)

    const texture = new THREE.CanvasTexture(canvas)
    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }

  const setCameraView = (axis: 'x' | 'y' | 'z' | '-x' | '-y' | '-z') => {
    if (!cameraRef.current || !controlsRef.current) return
    const dist = Math.max(projectWidth, projectHeight) * 1.5
    switch(axis) {
      case 'x': cameraRef.current.position.set(dist, 0, 0); break;
      case 'y': cameraRef.current.position.set(0, dist, 0); break;
      case 'z': cameraRef.current.position.set(0, 0, dist); break;
      case '-x': cameraRef.current.position.set(-dist, 0, 0); break;
      case '-y': cameraRef.current.position.set(0, -dist, 0); break;
      case '-z': cameraRef.current.position.set(0, 0, -dist); break;
    }
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }

  const asciiModeRef = useRef(asciiMode3D)
  useEffect(() => { asciiModeRef.current = asciiMode3D }, [asciiMode3D])

  // Initialize Scene once
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#111')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    
    if (cameraState3D) {
      camera.position.fromArray(cameraState3D.position)
    } else {
      camera.position.set(0, 0, Math.max(projectWidth, projectHeight) * 1.5)
    }
    camera.lookAt(0, 0, 0)
    
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    rendererRef.current = renderer
    
    // Add renderer to DOM initially
    container.appendChild(renderer.domElement)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, lightIntensity)
    scene.add(ambientLight)
    ambientLightRef.current = ambientLight
    
    const dirLight = new THREE.DirectionalLight(0xffffff, lightIntensity)
    dirLight.position.set(10, 20, 10)
    scene.add(dirLight)
    dirLightRef.current = dirLight

    // Voxel Group
    const voxelGroup = new THREE.Group()
    scene.add(voxelGroup)
    voxelGroupRef.current = voxelGroup

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    if (cameraState3D) {
      controls.target.fromArray(cameraState3D.target)
      camera.lookAt(controls.target)
      controls.update()
    }
    controlsRef.current = controls

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return
      const width = container.clientWidth
      const height = container.clientHeight
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(width, height)
      if (effectRef.current) {
        effectRef.current.setSize(width, height)
      }
    }
    
    window.addEventListener('resize', handleResize)

    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      if (controlsRef.current) controlsRef.current.update()
      
      if (sceneRef.current && cameraRef.current) {
        if (asciiModeRef.current && effectRef.current) {
          effectRef.current.render(sceneRef.current, cameraRef.current)
        } else if (rendererRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
      }
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)

      if (cameraRef.current && controlsRef.current) {
        const pos = cameraRef.current.position
        const tgt = controlsRef.current.target
        setCameraState3D({ position: [pos.x, pos.y, pos.z], target: [tgt.x, tgt.y, tgt.z] })
      }
      
      if (controlsRef.current) controlsRef.current.dispose()
      if (rendererRef.current) rendererRef.current.dispose()
      if (container) {
        container.innerHTML = ''
      }
    }
  }, []) // Run once on mount

  // Sync lighting
  useEffect(() => {
    if (ambientLightRef.current) ambientLightRef.current.intensity = useLights ? lightIntensity : 0
    if (dirLightRef.current) dirLightRef.current.intensity = useLights ? lightIntensity : 0
    if (ambientLightRef.current) ambientLightRef.current.color.set(useLights ? 0xffffff : 0x000000)
  }, [lightIntensity, useLights])


  // Sync grid
  useEffect(() => {
    if (sceneRef.current) {
      // Always cleanup previous grid/group
      if (gridHelperRef.current) {
        sceneRef.current.remove(gridHelperRef.current)
        // Check if it's a group and dispose its children's geometries/materials
        if (gridHelperRef.current instanceof THREE.Group) {
          gridHelperRef.current.traverse((child) => {
            if (child instanceof THREE.Line) {
              child.geometry.dispose()
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose())
              } else {
                child.material.dispose()
              }
            }
          })
        }
      }
      
      const sizeX = projectWidth
      const sizeY = projectHeight
      
      const gridGroup = new THREE.Group()
      
      // Vertical lines
      const vertMaterial = new THREE.LineBasicMaterial({ color: 0x444444 })
      for (let i = 0; i <= sizeX; i++) {
        const x = i - sizeX / 2
        const points = [
          new THREE.Vector3(x, -sizeY / 2, 0),
          new THREE.Vector3(x, sizeY / 2, 0)
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const line = new THREE.Line(geometry, vertMaterial)
        gridGroup.add(line)
      }
      
      // Horizontal lines
      const horizMaterial = new THREE.LineBasicMaterial({ color: 0x444444 })
      for (let i = 0; i <= sizeY; i++) {
        const y = i - sizeY / 2
        const points = [
          new THREE.Vector3(-sizeX / 2, y, 0),
          new THREE.Vector3(sizeX / 2, y, 0)
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const line = new THREE.Line(geometry, horizMaterial)
        gridGroup.add(line)
      }

      gridGroup.position.set(0, 0, -0.01)
      gridGroup.visible = showGrid3D
      sceneRef.current.add(gridGroup)
      gridHelperRef.current = gridGroup as any
    }
  }, [showGrid3D, projectWidth, projectHeight, renderMode3D])

  // Handle ASCII Mode Toggle
  useEffect(() => {
    if (!rendererRef.current || !containerRef.current) return

    const renderer = rendererRef.current
    const container = containerRef.current

    if (asciiMode3D) {
      // Re-create effect if font size changed or it doesn't exist
      if (effectRef.current) {
        if (container.contains(effectRef.current.domElement)) {
          container.removeChild(effectRef.current.domElement)
        }
        effectRef.current = null
      }

      if (!effectRef.current) {
        // Characters set: empty space for low intensity to avoid dots on empty areas
        effectRef.current = new (AsciiEffect as any)(renderer, '  .:-+*=%@#', { 
          invert: true,
          resolution: Math.min(1, 1 / asciiFontSize)
        })
        const el = effectRef.current.domElement
        el.style.color = 'white'
        el.style.backgroundColor = 'black'
        el.style.position = 'absolute'
        el.style.top = '0'
        el.style.left = '0'
        el.style.width = '100%'
        el.style.height = '100%'
        el.style.pointerEvents = 'all'
        el.style.userSelect = 'none'
        el.style.fontSize = `${asciiFontSize}px`
        el.style.lineHeight = `${asciiFontSize}px`
        el.setAttribute('tabindex', '0')
        container.appendChild(el)
      }
      
      const effect = effectRef.current
      effect.setSize(container.clientWidth, container.clientHeight)
      
      renderer.domElement.style.display = 'none'
      effect.domElement.style.display = 'block'

      // Re-attach controls to the ASCII element
      if (controlsRef.current) {
        const oldTarget = controlsRef.current.target.clone()
        controlsRef.current.dispose()
        const controls = new OrbitControls(cameraRef.current!, effect.domElement)
        controls.enableDamping = true
        controls.autoRotate = autoRotate3D
        controls.target.copy(oldTarget)
        controlsRef.current = controls
        controls.update()
      }

      if (sceneRef.current && cameraRef.current) {
        effect.render(sceneRef.current, cameraRef.current)
      }
    } else {
      renderer.domElement.style.display = 'block'
      if (effectRef.current) {
        effectRef.current.domElement.style.display = 'none'
      }

      // Re-attach controls to the original renderer element
      if (controlsRef.current) {
        const oldTarget = controlsRef.current.target.clone()
        controlsRef.current.dispose()
        const controls = new OrbitControls(cameraRef.current!, renderer.domElement)
        controls.enableDamping = true
        controls.autoRotate = autoRotate3D
        controls.target.copy(oldTarget)
        controlsRef.current = controls
        controls.update()
      }

      if (sceneRef.current && cameraRef.current) {
        renderer.render(sceneRef.current, cameraRef.current)
      }
    }
  }, [asciiMode3D, renderMode3D, asciiFontSize]) // Re-run when switching modes or font size changes

  // Handle Auto Rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate3D
    }
  }, [autoRotate3D])

  // Handle Camera Update on size change
  useEffect(() => {
    if (cameraRef.current && !cameraState3D) {
        cameraRef.current.position.set(0, 0, Math.max(projectWidth, projectHeight) * 1.5)
        cameraRef.current.lookAt(0, 0, 0)
    }
  }, [projectWidth, projectHeight])

  // Sync Data - Using InstancedMesh for optimization
  useEffect(() => {
    if (!voxelGroupRef.current || !frames || frames.length === 0) return
    
    const timer = setTimeout(() => {
        const group = voxelGroupRef.current!
        
        // Dispose of old meshes and materials/textures
        group.children.forEach(child => {
            if (child instanceof THREE.InstancedMesh) {
                child.geometry.dispose()
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose())
                } else {
                    child.material.dispose()
                }
            }
        })
        group.clear()

        const activeFrame = frames[activeFrameIndex]
        if (!activeFrame) return

        const geometry = renderMode3D === 'voxel' 
            ? new THREE.BoxGeometry(1, 1, 1)
            : new THREE.PlaneGeometry(1, 1)
            
        // Group cells by texture to use InstancedMesh
        const cellGroups = new Map<string, { x: number, y: number, z: number, opacity: number, texture: THREE.Texture }[]>()
        const textureCache = new Map<string, THREE.Texture>()

        activeFrame.layers.forEach((layer, layerIndex) => {
          if (!layer.visible) return
          const zOffset = layerIndex * 0.1

          layer.data.forEach((cell, key) => {
            const [xStr, yStr] = key.split(',')
            const x = parseInt(xStr)
            const y = parseInt(yStr)
            if (isNaN(x) || isNaN(y)) return
            if (!cell.char && !cell.bgColor) return

            const textureKey = `${cell.char}-${cell.color}-${cell.bgColor}-${useLights}`
            let texture = textureCache.get(textureKey)
            if (!texture) {
                const t = createCharTexture(cell.char, cell.color, cell.bgColor || '', useLights)
                if (t) {
                    texture = t
                    textureCache.set(textureKey, texture)
                }
            }

            if (texture) {
                if (!cellGroups.has(textureKey)) {
                    cellGroups.set(textureKey, [])
                }
                // Use x and y directly without +0.5 offset because project coordinates
                // are integer-based and 0,0 is top-left in 2D, but in 3D 0,0 is center of project.
                // Wait, projectStore says x,y are centered around 0? 
                // Let's check CanvasRenderer to be sure.
                cellGroups.get(textureKey)!.push({ x: x, y: -y, z: zOffset, opacity: layer.opacity, texture })
            }
          })
        })

        // Create an InstancedMesh for each unique texture
        cellGroups.forEach((cells) => {
            const firstCell = cells[0]
            const material = useLights 
                ? new THREE.MeshStandardMaterial({ map: firstCell.texture, transparent: true, opacity: firstCell.opacity })
                : new THREE.MeshBasicMaterial({ map: firstCell.texture, transparent: true, opacity: firstCell.opacity })
            
            const instancedMesh = new THREE.InstancedMesh(geometry, material, cells.length)
            const dummy = new THREE.Object3D()

            cells.forEach((cell, i) => {
                // Add 0.5 offset to center within grid cells
                // x is between [x, x+1], y is between [y-1, y]
                dummy.position.set(cell.x + 0.5, cell.y - 0.5, cell.z)
                dummy.updateMatrix()
                instancedMesh.setMatrixAt(i, dummy.matrix)
            })

            instancedMesh.instanceMatrix.needsUpdate = true
            group.add(instancedMesh)
        })

        // No group offset needed because x, y are already centered around 0 in project store
        group.position.set(0, 0, 0)
    }, 100)

    return () => clearTimeout(timer)
  }, [frames, activeFrameIndex, renderMode3D, projectWidth, projectHeight, useLights])

  return (
    <div className={styles.sceneWrapper}>
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <button className={renderMode3D === 'voxel' ? styles.active : ''} onClick={() => setRenderMode3D('voxel')}>VOXEL</button>
          <button className={renderMode3D === 'plane' ? styles.active : ''} onClick={() => setRenderMode3D('plane')}>PLANE</button>
        </div>
        <div className={styles.controlGroup}>
          <button className={autoRotate3D ? styles.active : ''} onClick={() => setAutoRotate3D(!autoRotate3D)}>ROTATE</button>
          <button className={asciiMode3D ? styles.active : ''} onClick={() => setAsciiMode3D(!asciiMode3D)}>ASCII</button>
          {asciiMode3D && (
            <div className={styles.fontSizeControl}>
              <span>SIZE:</span>
              <NumberDragger 
                value={asciiFontSize} 
                onChange={(val) => setAsciiFontSize(val)}
                min={5}
                max={10}
              />
            </div>
          )}
        </div>
        <div className={styles.controlGroup}>
          <button className={useLights ? styles.active : ''} onClick={() => setUseLights(!useLights)}>LIGHTS</button>
          <button className={showGrid3D ? styles.active : ''} onClick={() => setShowGrid3D(!showGrid3D)}>GRID</button>
        </div>
        <div className={styles.controlGroup}>
          <button onClick={() => setCameraView('x')}>X</button>
          <button onClick={() => setCameraView('y')}>Y</button>
          <button onClick={() => setCameraView('z')}>Z</button>
        </div>
        <div className={styles.controlGroup}>
          <button onClick={() => setCameraView('-x')}>-X</button>
          <button onClick={() => setCameraView('-y')}>-Y</button>
          <button onClick={() => setCameraView('-z')}>-Z</button>
        </div>
      </div>
      <div ref={containerRef} className={styles.sceneContainer} />
    </div>
  )
}
