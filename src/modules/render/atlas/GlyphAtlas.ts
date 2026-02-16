import * as THREE from 'three'

export type GlyphInfo = {
  char: string
  x: number
  y: number
  width: number
  height: number
  xoffset: number
  yoffset: number
  xadvance: number
  u0: number
  v0: number
  u1: number
  v1: number
}

export class GlyphAtlas {
  static shared: GlyphAtlas | null = null
  texture: THREE.Texture | null = null
  glyphs: Map<string, GlyphInfo> = new Map()
  pxRange = 4
  useMSDF = false
  width = 0
  height = 0
  loaded = false

  static async loadShared(baseUrl = '/msdf'): Promise<GlyphAtlas> {
    if (!GlyphAtlas.shared) GlyphAtlas.shared = new GlyphAtlas()
    if (!GlyphAtlas.shared.loaded) {
      await GlyphAtlas.shared.load(baseUrl)
    }
    return GlyphAtlas.shared
  }

  async load(baseUrl = '/msdf'): Promise<void> {
    // Use JSON for metrics
    const jsonUrl = `${baseUrl}/PressStart2P-Regular.json`
    const res = await fetch(jsonUrl)
    const data = await res.json()
    const page = Array.isArray(data.pages) ? data.pages[0] : 'press-start-2p.png'
    const texUrl = `${baseUrl}/${page}`
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      new THREE.TextureLoader().load(texUrl, t => resolve(t), undefined, reject)
    })
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.anisotropy = 1
    texture.flipY = true
    texture.colorSpace = THREE.NoColorSpace
    texture.needsUpdate = true
    this.texture = texture
    const common = data.common ?? null
    const dist = data.distanceField ?? null
    const img = texture.image as HTMLImageElement
    const imgW = img.width || 1
    const imgH = img.height || 1
    this.width = imgW
    this.height = imgH
    if (common && typeof common.scaleW === 'number' && typeof common.scaleH === 'number') {
      const dw = Math.abs(common.scaleW - imgW)
      const dh = Math.abs(common.scaleH - imgH)
      if (dw < 2 && dh < 2) {
        this.width = common.scaleW
        this.height = common.scaleH
      }
    }
    if (dist && typeof dist.distanceRange === 'number') {
      this.pxRange = dist.distanceRange
    }
    const fieldType = typeof dist?.fieldType === 'string' ? dist.fieldType.toLowerCase() : null
    this.useMSDF = Boolean(dist && (!fieldType || fieldType.includes('msdf')))
    // Build glyphs
    const chars: any[] = data.chars ?? []
    for (const c of chars) {
      const u0 = c.x / this.width
      // With flipY=true, V=0 is bottom, V=1 is top.
      // Character data: y=0 is top, y=H is bottom.
      // So Top of char (y) maps to V = 1 - y/H
      // Bottom of char (y+h) maps to V = 1 - (y+h)/H
      // We want v0 (offset) to be the bottom V, and v1 to be the top V.
      // So v0 = 1 - (y+h)/H, v1 = 1 - y/H.
      const v0 = 1 - (c.y + c.height) / this.height
      const v1 = 1 - c.y / this.height
      
      const u1 = (c.x + c.width) / this.width
      const g: GlyphInfo = {
        char: c.char,
        x: c.x, y: c.y, width: c.width, height: c.height,
        xoffset: c.xoffset, yoffset: c.yoffset, xadvance: c.xadvance,
        u0, v0, u1, v1
      }
      this.glyphs.set(c.char, g)
    }
    this.loaded = true
  }

  getGlyph(ch: string): GlyphInfo | null {
    return this.glyphs.get(ch) ?? null
  }
}
