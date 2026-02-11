import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useProjectStore } from '../../2d/store/projectStore'
import styles from './SceneRenderer.module.scss'

export const SceneRenderer = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const voxelGroupRef = useRef<THREE.Group | null>(null)
  const { frames, activeFrameIndex } = useProjectStore()

  // Helper to create texture from char
  const createCharTexture = (char: string, color: string, bgColor: string) => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Background
    ctx.fillStyle = bgColor || '#cccccc' // Default block color
    ctx.fillRect(0, 0, 64, 64)

    // Char
    if (char) {
        ctx.fillStyle = color || '#ffffff'
        ctx.font = 'bold 48px "Press Start 2P", monospace' // Use pixel font if available or monospace
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(char, 32, 32)
        
        // Add border for voxels to look distinct?
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, 64, 64)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.magFilter = THREE.NearestFilter // Pixelated look
    texture.minFilter = THREE.NearestFilter
    return texture
  }

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#111')

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.set(5, 5, 5)
    camera.lookAt(0, 0, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)

    // Grid Helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222)
    scene.add(gridHelper)

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(2)
    scene.add(axesHelper)

    // Voxel Group
    const voxelGroup = new THREE.Group()
    scene.add(voxelGroup)
    voxelGroupRef.current = voxelGroup

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05

    // Animation Loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight
      
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(animationId)
      resizeObserver.disconnect()
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  // Sync Data
  useEffect(() => {
    if (!voxelGroupRef.current || !frames || frames.length === 0) return
    
    const group = voxelGroupRef.current
    group.clear()

    const activeFrame = frames[activeFrameIndex]
    if (!activeFrame) return

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    
    // Cache textures to avoid recreating them for same char/color combo
    const textureCache = new Map<string, THREE.Texture>()

    activeFrame.layers.forEach((layer, layerIndex) => {
      if (!layer.visible) return
      
      // Calculate Z offset based on layer index (higher index = closer to camera/stacked on top)
      // Or just separate them in Z space. 
      // Let's do Z offset. Standard 2D coordinate system usually has (0,0) at top-left.
      // In 3D: X is right, Y is up. We mapped 2D Y to -Y.
      // Z can be layer depth.
      const zOffset = layerIndex * 1.05 // Small gap between layers? Or direct stacking?
      
      layer.data.forEach((cell, key) => {
        const [x, y] = key.split(',').map(Number)
        
        // Skip if empty
        if (!cell.char && !cell.bgColor) return

        const textureKey = `${cell.char}-${cell.color}-${cell.bgColor}`
        let texture = textureCache.get(textureKey)
        
        if (!texture) {
            const newTexture = createCharTexture(cell.char, cell.color, cell.bgColor || '')
            if (newTexture) {
                texture = newTexture
                textureCache.set(textureKey, texture)
            }
        }

        const material = new THREE.MeshStandardMaterial({ 
            map: texture,
            color: 0xffffff // White so texture color shows through
        })
        
        const cube = new THREE.Mesh(geometry, material)
        // Position: x, -y, z
        cube.position.set(x, -y, zOffset)
        group.add(cube)
      })
    })

  }, [frames, activeFrameIndex])

  return <div ref={containerRef} className={styles.sceneContainer} />
}
