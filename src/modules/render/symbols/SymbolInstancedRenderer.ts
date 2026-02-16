import * as THREE from 'three'
import type { Frame } from '../types'
import { GlyphAtlas } from '../atlas/GlyphAtlas'
import { createSymbolMSDFMaterial } from '../materials/SymbolMSDFMaterial'

type ViewRect = { minX: number; maxX: number; minY: number; maxY: number }

type LayerChunk = {
  key: string
  cx: number
  cy: number
  originXi: number
  originYi: number
  chunkW: number
  chunkH: number
  bounds: ViewRect
  mesh: THREE.InstancedMesh
  uvOffset: THREE.InstancedBufferAttribute | null
  uvScale: THREE.InstancedBufferAttribute | null
  tint: THREE.InstancedBufferAttribute | null
  alpha: THREE.InstancedBufferAttribute | null
  color: THREE.InstancedBufferAttribute | null
  inView: boolean
}

export class SymbolInstancedRenderer {
  private scene: THREE.Scene | null = null
  private chunksByLayerId: Map<string, Map<string, LayerChunk>> = new Map()
  private layerZById: Map<string, number> = new Map()
  private layerOpacityById: Map<string, number> = new Map()
  private layerVisibleById: Map<string, boolean> = new Map()
  private atlas: GlyphAtlas | null = null
  private materialsByLayerId: Map<string, THREE.Material> = new Map()
  private width = 0
  private height = 0
  private buildId = 0
  private opacity = 1.0
  private readonly chunkSize = 32
  private layerSpacingZ = 0.001
  private viewRect: ViewRect | null = null
  private renderMode: 'plane' | 'voxel' = 'plane'

  async ensureAtlas(): Promise<GlyphAtlas> {
    if (this.atlas && this.atlas.loaded) return this.atlas
    const atlas = await GlyphAtlas.loadShared('/msdf')
    this.atlas = atlas
    return atlas
  }
  setScene(scene: THREE.Scene | null): void {
    if (this.scene && this.scene !== scene) {
      for (const layerChunks of this.chunksByLayerId.values()) {
        for (const chunk of layerChunks.values()) {
          this.scene.remove(chunk.mesh)
        }
      }
    }
    this.scene = scene
    if (scene) {
      for (const layerChunks of this.chunksByLayerId.values()) {
        for (const chunk of layerChunks.values()) {
          scene.add(chunk.mesh)
        }
      }
    }
  }
  dispose(): void {
    for (const layerChunks of this.chunksByLayerId.values()) {
      for (const chunk of layerChunks.values()) {
        chunk.mesh.geometry.dispose()
        if (this.scene) this.scene.remove(chunk.mesh)
      }
    }
    for (const mat of this.materialsByLayerId.values()) {
      mat.dispose()
    }
    this.chunksByLayerId.clear()
    this.layerZById.clear()
    this.layerOpacityById.clear()
    this.layerVisibleById.clear()
    this.materialsByLayerId.clear()
  }

  setOpacity(alpha: number): void {
    this.opacity = alpha
    for (const [layerId, material] of this.materialsByLayerId.entries()) {
      const layerOpacity = this.layerOpacityById.get(layerId) ?? 1.0
      if (material instanceof THREE.ShaderMaterial) {
        material.uniforms.opacity.value = alpha * layerOpacity
      } else if (material instanceof THREE.Material) {
        const anyMat = material as any
        if (typeof anyMat.opacity === 'number') anyMat.opacity = alpha * layerOpacity
        if (typeof anyMat.transparent === 'boolean') anyMat.transparent = true
      }
    }
  }

  setLayerSpacingZ(spacing: number): void {
    this.layerSpacingZ = Number.isFinite(spacing) ? spacing : this.layerSpacingZ
  }

  setRenderMode(mode: 'plane' | 'voxel'): void {
    this.renderMode = mode
  }

  setViewRect(rect: ViewRect | null): void {
    this.viewRect = rect
    this.updateChunkVisibility()
  }

  private updateChunkVisibility(): void {
    const rect = this.viewRect
    for (const [layerId, layerChunks] of this.chunksByLayerId.entries()) {
      const layerVisible = this.layerVisibleById.get(layerId) ?? true
      for (const chunk of layerChunks.values()) {
        const inView =
          !rect ||
          !(
            rect.maxX < chunk.bounds.minX ||
            rect.minX > chunk.bounds.maxX ||
            rect.maxY < chunk.bounds.minY ||
            rect.minY > chunk.bounds.maxY
          )
        chunk.inView = inView
        chunk.mesh.visible = layerVisible && inView
      }
    }
  }

  private ensureLayerChunks(
    layerId: string,
    layerIndex: number,
    layerOpacity: number,
    layerVisible: boolean,
    atlas: GlyphAtlas,
    width: number,
    height: number
  ): Map<string, LayerChunk> {
    const existing = this.chunksByLayerId.get(layerId)
    if (existing) return existing
    if (!this.scene) return new Map()

    const halfW = Math.floor(width / 2)
    const halfH = Math.floor(height / 2)
    const layerZ = layerIndex * this.layerSpacingZ

    const mat =
      this.renderMode === 'plane'
        ? (() => {
            const m = createSymbolMSDFMaterial(atlas.texture!, atlas.pxRange)
            m.uniforms.useMSDF.value = atlas.useMSDF ? 1 : 0
            m.uniforms.opacity.value = this.opacity * layerOpacity
            return m
          })()
        : new THREE.ShaderMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: true,
            uniforms: { opacity: { value: this.opacity * layerOpacity } },
            vertexShader: `
              varying vec3 vColor;
              void main() {
                vColor = instanceColor;
                vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
              }
            `,
            fragmentShader: `
              varying vec3 vColor;
              uniform float opacity;
              void main() {
                gl_FragColor = vec4(vColor, opacity);
              }
            `,
          })
    this.materialsByLayerId.set(layerId, mat)

    const chunks = new Map<string, LayerChunk>()
    const chunkCountX = Math.ceil(width / this.chunkSize)
    const chunkCountY = Math.ceil(height / this.chunkSize)

    for (let cy = 0; cy < chunkCountY; cy++) {
      for (let cx = 0; cx < chunkCountX; cx++) {
        const originXi = cx * this.chunkSize
        const originYi = cy * this.chunkSize
        const chunkW = Math.min(this.chunkSize, width - originXi)
        const chunkH = Math.min(this.chunkSize, height - originYi)
        const capacity = chunkW * chunkH

        const geom = this.renderMode === 'plane' ? new THREE.PlaneGeometry(1, 1) : new THREE.BoxGeometry(1, 1, 1)
        let uvOffset: THREE.InstancedBufferAttribute | null = null
        let uvScale: THREE.InstancedBufferAttribute | null = null
        let tint: THREE.InstancedBufferAttribute | null = null
        let alpha: THREE.InstancedBufferAttribute | null = null
        let color: THREE.InstancedBufferAttribute | null = null

        if (this.renderMode === 'plane') {
          uvOffset = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2)
          uvScale = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2)
          tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
          alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1)
          uvOffset.setUsage(THREE.DynamicDrawUsage)
          uvScale.setUsage(THREE.DynamicDrawUsage)
          tint.setUsage(THREE.DynamicDrawUsage)
          alpha.setUsage(THREE.DynamicDrawUsage)
          // @ts-ignore
          geom.setAttribute('instanceUvOffset', uvOffset)
          // @ts-ignore
          geom.setAttribute('instanceUvScale', uvScale)
          // @ts-ignore
          geom.setAttribute('instanceTint', tint)
          // @ts-ignore
          geom.setAttribute('instanceAlpha', alpha)
        }

        const mesh = new THREE.InstancedMesh(geom, mat, capacity)
        mesh.frustumCulled = true
        mesh.visible = layerVisible
        mesh.renderOrder = layerIndex
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        if (this.renderMode === 'voxel') {
          color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
          color.setUsage(THREE.DynamicDrawUsage)
          mesh.instanceColor = color
          // @ts-ignore
          geom.setAttribute('instanceColor', color)
        }

        const dummy = new THREE.Object3D()
        for (let ly = 0; ly < chunkH; ly++) {
          for (let lx = 0; lx < chunkW; lx++) {
            const localIdx = ly * chunkW + lx
            const xi = originXi + lx
            const yi = originYi + ly
            const x = xi - halfW
            const y = yi - halfH
            dummy.position.set(x, -y, layerZ)
            dummy.scale.set(0, 0, 0)
            dummy.updateMatrix()
            mesh.setMatrixAt(localIdx, dummy.matrix)
            if (uvOffset && uvScale && tint && alpha) {
              uvOffset.setXY(localIdx, 0, 0)
              uvScale.setXY(localIdx, 0, 0)
              tint.setXYZ(localIdx, 1, 1, 1)
              alpha.setX(localIdx, 0.0)
            }
            if (color) {
              color.setXYZ(localIdx, 1, 1, 1)
            }
          }
        }

        mesh.instanceMatrix.needsUpdate = true
        if (uvOffset) uvOffset.needsUpdate = true
        if (uvScale) uvScale.needsUpdate = true
        if (tint) tint.needsUpdate = true
        if (alpha) alpha.needsUpdate = true
        if (color) color.needsUpdate = true

        const minCellX = originXi - halfW
        const maxCellX = originXi + chunkW - 1 - halfW
        const minCellY = originYi - halfH
        const maxCellY = originYi + chunkH - 1 - halfH

        const bounds: ViewRect = {
          minX: minCellX - 0.5,
          maxX: maxCellX + 0.5,
          minY: -maxCellY - 0.5,
          maxY: -minCellY + 0.5,
        }

        const key = `${cx},${cy}`
        const chunk: LayerChunk = {
          key,
          cx,
          cy,
          originXi,
          originYi,
          chunkW,
          chunkH,
          bounds,
          mesh,
          uvOffset,
          uvScale,
          tint,
          alpha,
          color,
          inView: true,
        }

        chunks.set(key, chunk)
        this.scene.add(mesh)
      }
    }

    this.chunksByLayerId.set(layerId, chunks)
    this.layerZById.set(layerId, layerZ)
    this.layerOpacityById.set(layerId, layerOpacity)
    this.layerVisibleById.set(layerId, layerVisible)
    this.updateChunkVisibility()
    return chunks
  }

  async buildFromFrame(frame: Frame | null, width: number, height: number): Promise<void> {
    const currentBuildId = ++this.buildId
    if (!this.scene) return
    
    this.width = width
    this.height = height
    const atlas = await this.ensureAtlas()
    
    if (this.buildId !== currentBuildId) return
    if (!this.scene) return

    this.dispose()
    if (!frame) return

    for (let layerIndex = 0; layerIndex < frame.layers.length; layerIndex++) {
      const layer = frame.layers[layerIndex]
      const layerOpacity = typeof layer.opacity === 'number' ? layer.opacity : 1.0
      const layerChunks = this.ensureLayerChunks(layer.id, layerIndex, layerOpacity, Boolean(layer.visible), atlas, width, height)
      const halfW = Math.floor(width / 2)
      const halfH = Math.floor(height / 2)
      const layerZ = this.layerZById.get(layer.id) ?? (layerIndex * this.layerSpacingZ)
      const dummy = new THREE.Object3D()

      layer.data.forEach((cell, key) => {
        const hasChar = Boolean(cell && typeof cell.char === 'string' && cell.char.trim().length > 0)
        if (!hasChar) return
        const [xs, ys] = key.split(',')
        const x = Number(xs)
        const y = Number(ys)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        const xi = x + halfW
        const yi = y + halfH
        if (xi < 0 || xi >= width || yi < 0 || yi >= height) return
        const cx = Math.floor(xi / this.chunkSize)
        const cy = Math.floor(yi / this.chunkSize)
        const chunkKey = `${cx},${cy}`
        const chunk = layerChunks.get(chunkKey)
        if (!chunk) return
        const localX = xi - chunk.originXi
        const localY = yi - chunk.originYi
        const localIdx = localY * chunk.chunkW + localX

        dummy.position.set(x, -y, layerZ)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        chunk.mesh.setMatrixAt(localIdx, dummy.matrix)

        const c = new THREE.Color(cell.color || '#ffffff')
        if (this.renderMode === 'plane') {
          const ch = cell.char[0]
          const g = atlas.getGlyph(ch) || atlas.getGlyph('#')
          if (!g || !chunk.tint || !chunk.alpha || !chunk.uvOffset || !chunk.uvScale) return
          chunk.tint.setXYZ(localIdx, c.r, c.g, c.b)
          chunk.alpha.setX(localIdx, 1.0)
          chunk.uvOffset.setXY(localIdx, g.u0, g.v0)
          chunk.uvScale.setXY(localIdx, g.u1 - g.u0, g.v1 - g.v0)
        } else {
          if (chunk.color) chunk.color.setXYZ(localIdx, c.r, c.g, c.b)
        }
      })

      for (const chunk of layerChunks.values()) {
        chunk.mesh.instanceMatrix.needsUpdate = true
        if (chunk.color) chunk.color.needsUpdate = true
        if (chunk.uvOffset) chunk.uvOffset.needsUpdate = true
        if (chunk.uvScale) chunk.uvScale.needsUpdate = true
        if (chunk.tint) chunk.tint.needsUpdate = true
        if (chunk.alpha) chunk.alpha.needsUpdate = true
      }
    }
  }
  
  applyUpdates(
    updates: { x: number; y: number; data: any }[],
    width: number,
    height: number,
    layerId: string,
    layerOpacity: number,
    layerVisible: boolean
  ): boolean {
    if (this.width !== width || this.height !== height) return false
    const layerChunks = this.chunksByLayerId.get(layerId)
    if (!layerChunks) return false
    if (!this.atlas) return false

    this.layerVisibleById.set(layerId, layerVisible)
    const material = this.materialsByLayerId.get(layerId)
    if (material instanceof THREE.ShaderMaterial) material.uniforms.opacity.value = this.opacity * layerOpacity
    else if (material) {
      const anyMat = material as any
      if (typeof anyMat.opacity === 'number') anyMat.opacity = this.opacity * layerOpacity
      if (typeof anyMat.transparent === 'boolean') anyMat.transparent = true
    }
    this.layerOpacityById.set(layerId, layerOpacity)
    this.updateChunkVisibility()

    const halfW = Math.floor(width / 2)
    const halfH = Math.floor(height / 2)
    const layerZ = this.layerZById.get(layerId) ?? 0

    const dummy = new THREE.Object3D()

    const rangesByChunk = new Map<LayerChunk, { minIdx: number; maxIdx: number }>()

    for (const u of updates) {
      const xi = u.x + halfW
      const yi = u.y + halfH
      if (xi < 0 || xi >= width || yi < 0 || yi >= height) continue
      const cx = Math.floor(xi / this.chunkSize)
      const cy = Math.floor(yi / this.chunkSize)
      const chunkKey = `${cx},${cy}`
      const chunk = layerChunks.get(chunkKey)
      if (!chunk) continue
      const localX = xi - chunk.originXi
      const localY = yi - chunk.originYi
      const localIdx = localY * chunk.chunkW + localX

      const range = rangesByChunk.get(chunk)
      if (!range) rangesByChunk.set(chunk, { minIdx: localIdx, maxIdx: localIdx })
      else {
        if (localIdx < range.minIdx) range.minIdx = localIdx
        if (localIdx > range.maxIdx) range.maxIdx = localIdx
      }

      const hasChar = typeof u.data?.char === 'string' && u.data.char.trim().length > 0
      dummy.position.set(u.x, -u.y, layerZ)

      if (hasChar) {
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        chunk.mesh.setMatrixAt(localIdx, dummy.matrix)

        const color = new THREE.Color(u.data.color || '#ffffff')
        if (this.renderMode === 'plane') {
          const ch = u.data.char[0]
          const g = this.atlas.getGlyph(ch) || this.atlas.getGlyph('#')
          if (!g || !chunk.tint || !chunk.alpha || !chunk.uvOffset || !chunk.uvScale) continue
          chunk.tint.setXYZ(localIdx, color.r, color.g, color.b)
          chunk.alpha.setX(localIdx, 1.0)
          chunk.uvOffset.setXY(localIdx, g.u0, g.v0)
          chunk.uvScale.setXY(localIdx, g.u1 - g.u0, g.v1 - g.v0)
        } else {
          if (chunk.color) chunk.color.setXYZ(localIdx, color.r, color.g, color.b)
        }
      } else {
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        chunk.mesh.setMatrixAt(localIdx, dummy.matrix)
        if (this.renderMode === 'plane') {
          if (chunk.alpha) chunk.alpha.setX(localIdx, 0.0)
          if (chunk.uvOffset) chunk.uvOffset.setXY(localIdx, 0, 0)
          if (chunk.uvScale) chunk.uvScale.setXY(localIdx, 0, 0)
        }
      }
    }

    const setRanges = (attr: any, offset: number, count: number) => {
      if (typeof attr?.clearUpdateRanges === 'function') attr.clearUpdateRanges()
      if (typeof attr?.addUpdateRange === 'function') attr.addUpdateRange(offset, count)
      else if (attr?.updateRange) {
        attr.updateRange.offset = offset
        attr.updateRange.count = count
      }
    }

    for (const [chunk, r] of rangesByChunk.entries()) {
      chunk.mesh.instanceMatrix.needsUpdate = true
      if (chunk.color) chunk.color.needsUpdate = true
      if (chunk.uvOffset) chunk.uvOffset.needsUpdate = true
      if (chunk.uvScale) chunk.uvScale.needsUpdate = true
      if (chunk.tint) chunk.tint.needsUpdate = true
      if (chunk.alpha) chunk.alpha.needsUpdate = true

      const elemCount = r.maxIdx - r.minIdx + 1
      setRanges(chunk.mesh.instanceMatrix as any, r.minIdx * 16, elemCount * 16)
      if (chunk.color) setRanges(chunk.color as any, r.minIdx * 3, elemCount * 3)
      if (chunk.uvOffset) setRanges(chunk.uvOffset as any, r.minIdx * 2, elemCount * 2)
      if (chunk.uvScale) setRanges(chunk.uvScale as any, r.minIdx * 2, elemCount * 2)
      if (chunk.tint) setRanges(chunk.tint as any, r.minIdx * 3, elemCount * 3)
      if (chunk.alpha) setRanges(chunk.alpha as any, r.minIdx, elemCount)
    }

    return true
  }
}
