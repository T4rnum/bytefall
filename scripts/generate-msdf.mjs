import fs from 'node:fs'
import path from 'node:path'
import opentype from 'opentype.js'

const fontPath = path.resolve('src/assets/fonts/PressStart2P-Regular.ttf')
const charsetPath = path.resolve('public/msdf/charset.txt')
const charsetTsPath = path.resolve('src/modules/2d/fonts/fontCharset.ts')

const font = opentype.loadSync(fontPath)
const codes = new Set()

for (let i = 0; i < font.glyphs.length; i++) {
  const glyph = font.glyphs.get(i)
  if (!glyph) continue
  if (glyph.unicode !== undefined) {
    codes.add(glyph.unicode)
  }
  if (glyph.unicodes && glyph.unicodes.length > 0) {
    glyph.unicodes.forEach((code) => codes.add(code))
  }
}

const sorted = Array.from(codes).sort((a, b) => a - b)
const chars = sorted
  .filter((code) => code >= 32 && code !== 127)
  .map((code) => String.fromCodePoint(code))
  .join('')

fs.mkdirSync(path.dirname(charsetPath), { recursive: true })
fs.writeFileSync(charsetPath, chars, 'utf8')

const tsContent = `export const FONT_CHARSET = ${JSON.stringify(chars)}\nexport const FONT_CHARS = Array.from(FONT_CHARSET)\n`
fs.writeFileSync(charsetTsPath, tsContent, 'utf8')
