import { useState, useEffect, useRef, memo } from 'react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { Frame } from '../../modules/2d/types'
import { Play, Pause, Plus, Copy, Ghost } from 'lucide-react'
import { NumberDragger } from '../UI/NumberDragger'
import styles from './TimelinePanel.module.scss'
import clsx from 'clsx'

// Memoized preview to prevent unnecessary redraws
const FramePreview = memo(({ frame, width, height, isCurrentFrame }: { frame: Frame, width: number, height: number, isCurrentFrame: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const selection = useEditorStore(state => state.selection)
  const floatingSelection = useEditorStore(state => state.floatingSelection)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1918'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    // Transform coordinate system to match grid (0,0 at center)
    ctx.translate(Math.floor(width / 2), Math.floor(height / 2))

    // Draw frame content
    frame.layers.forEach((layer: any) => {
         if (!layer.visible) return
         layer.data.forEach((cell: any, key: string) => {
             const [x, y] = key.split(',').map(Number)
             
             if (cell.bgColor) {
                 ctx.fillStyle = cell.bgColor
                 ctx.fillRect(x, y, 1, 1)
             }
             
             if (cell.char) {
                 ctx.fillStyle = cell.color
                 ctx.fillRect(x, y, 1, 1)
             }
         })
    })

    // Draw Floating Selection (ONLY for current frame)
    if (isCurrentFrame && floatingSelection && selection) {
        floatingSelection.forEach(item => {
            const x = selection.x + item.dx
            const y = selection.y + item.dy
            
            if (item.data.bgColor) {
                ctx.fillStyle = item.data.bgColor
                ctx.fillRect(x, y, 1, 1)
            }
            if (item.data.char) {
                ctx.fillStyle = item.data.color
                ctx.fillRect(x, y, 1, 1)
            }
        })
    }
    
    ctx.restore()

  }, [frame, width, height, isCurrentFrame, selection, floatingSelection])

  return <canvas ref={canvasRef} className={styles.previewCanvas} width={width} height={height} />
})

export const TimelinePanel = () => {
  const { 
    frames, 
    activeFrameIndex, 
    setActiveFrameIndex, 
    addFrame, 
    duplicateFrame, 
    deleteFrame,
    width,
    height
  } = useProjectStore()

  const { onionSkinEnabled, setOnionSkinEnabled } = useEditorStore()
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [fps, setFps] = useState(12)
  const intervalRef = useRef<number | null>(null)

  // Playback Logic
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setActiveFrameIndex((activeFrameIndex + 1) % frames.length)
      }, 1000 / fps)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isPlaying, fps, frames.length, activeFrameIndex, setActiveFrameIndex])

  const togglePlay = () => setIsPlaying(!isPlaying)

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.controls}>
        <button 
          className={clsx(styles.controlBtn, isPlaying && styles.active)} 
          onClick={togglePlay}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}>
            <span>FPS:</span>
            <div style={{ width: '40px' }}>
              <NumberDragger 
                  value={fps} 
                  min={1} 
                  max={60} 
                  onChange={(val) => setFps(val)}
              />
            </div>
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />
        
        <button 
          className={clsx(styles.controlBtn, onionSkinEnabled && styles.active)} 
          onClick={() => setOnionSkinEnabled(!onionSkinEnabled)}
          title="Toggle Onion Skin"
        >
          <Ghost size={14} />
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        <button className={styles.controlBtn} onClick={addFrame} title="Add Frame">
          <Plus size={14} />
        </button>
        <button className={styles.controlBtn} onClick={() => duplicateFrame(activeFrameIndex)} title="Duplicate Frame">
          <Copy size={14} />
        </button>
      </div>

      <div className={styles.framesList}>
        {frames.map((frame, index) => (
          <div 
            key={frame.id}
            className={clsx(styles.frameItem, activeFrameIndex === index && styles.active)}
            onClick={() => {
                setIsPlaying(false)
                setActiveFrameIndex(index)
            }}
          >
            <span className={styles.frameNumber}>{index + 1}</span>
            
            <FramePreview 
                frame={frame} 
                width={width} 
                height={height} 
                isCurrentFrame={activeFrameIndex === index}
            />

            {frames.length > 1 && (
                <button 
                    className={styles.deleteBtn}
                    onClick={(e) => {
                        e.stopPropagation()
                        deleteFrame(index)
                    }}
                    title="Delete Frame"
                >
                    ×
                </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
