import { Frame } from '../modules/2d/types'
import gifshot from 'gifshot'

const GRID_SIZE = 16
const FONT_SIZE = 12

export const exportFrameToPNG = (
    frame: Frame, 
    width: number, 
    height: number, 
    bgColor: string | null
) => {
    const canvas = renderFrameToCanvas(frame, width, height, bgColor)
    downloadCanvasAsPNG(canvas, `bytefall_frame_${Date.now()}.png`)
}

export const exportToSpriteSheet = (
    frames: Frame[],
    width: number,
    height: number,
    bgColor: string | null
) => {
    if (frames.length === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = width * GRID_SIZE * frames.length
    canvas.height = height * GRID_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    frames.forEach((frame, index) => {
        const frameCanvas = renderFrameToCanvas(frame, width, height, bgColor)
        ctx.drawImage(frameCanvas, index * width * GRID_SIZE, 0)
    })

    downloadCanvasAsPNG(canvas, `bytefall_spritesheet_${Date.now()}.png`)
}

export const exportToGIF = (
    frames: Frame[],
    width: number,
    height: number,
    bgColor: string | null,
    fps: number = 10
) => {
    if (frames.length === 0) return

    const scale = 2
    const images = frames.map(frame => {
        const canvas = renderFrameToCanvas(frame, width, height, bgColor)
        return canvas.toDataURL('image/png')
    })

    gifshot.createGIF({
        images: images,
        gifWidth: width * GRID_SIZE * scale,
        gifHeight: height * GRID_SIZE * scale,
        interval: 1 / fps,
        numFrames: frames.length,
        frameDuration: 1,
        sampleInterval: 1, 
        clearFilters: true,
    }, (obj: any) => {
        if (!obj.error) {
            const link = document.createElement('a')
            link.download = `bytefall_animation_${Date.now()}.gif`
            link.href = obj.image
            link.click()
        }
    })
}

// Internal helpers
const renderFrameToCanvas = (
    frame: Frame,
    width: number,
    height: number,
    bgColor: string | null
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas')
    // Use higher resolution for crispness
    const scale = 2 
    canvas.width = width * GRID_SIZE * scale
    canvas.height = height * GRID_SIZE * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    ctx.scale(scale, scale)
    ctx.imageSmoothingEnabled = false

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

    return canvas
}

const downloadCanvasAsPNG = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement('a')
    link.download = filename
    link.href = canvas.toDataURL('image/png')
    link.click()
}
