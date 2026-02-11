import { Frame } from '../modules/2d/types'

const GRID_SIZE = 16
const FONT_SIZE = 12

export const exportFrameToPNG = (
    frame: Frame, 
    width: number, 
    height: number, 
    bgColor: string | null
) => {
    const canvas = document.createElement('canvas')
    canvas.width = width * GRID_SIZE
    canvas.height = height * GRID_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fill background
    if (bgColor) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    // Font settings
    ctx.font = `${FONT_SIZE}px "Press Start 2P"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Draw layers
    frame.layers.forEach(layer => {
        if (!layer.visible) return
        ctx.globalAlpha = layer.opacity

        layer.data.forEach((cell, key) => {
            const [x, y] = key.split(',').map(Number)
            // Convert coordinate system (-width/2 ... width/2) to (0 ... width)
            const px = (x + width / 2) * GRID_SIZE + GRID_SIZE / 2
            const py = (y + height / 2) * GRID_SIZE + GRID_SIZE / 2

            if (cell.bgColor) {
                ctx.fillStyle = cell.bgColor
                ctx.fillRect(px - GRID_SIZE / 2, py - GRID_SIZE / 2, GRID_SIZE, GRID_SIZE)
            }

            if (cell.char) {
                ctx.fillStyle = cell.color
                ctx.fillText(cell.char, px, py + 2)
            }
        })
    })

    // Download
    const link = document.createElement('a')
    link.download = `bytefall_export_${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
}
