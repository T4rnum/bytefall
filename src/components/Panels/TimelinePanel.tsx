import { useState, useEffect, useRef, memo } from 'react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { Frame } from '../../modules/2d/types'
import { Play, Pause, Plus, Copy, Ghost } from 'lucide-react'
import styles from './TimelinePanel.module.scss'
import clsx from 'clsx'

// Memoized preview to prevent unnecessary redraws
const FramePreview = memo(({ frame, width, height }: { frame: Frame, width: number, height: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
    // Canvas (0,0) is top-left.
    // We want grid (0,0) to be at canvas (width/2, height/2).
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
    
    ctx.restore()

  }, [frame, width, height])

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
            <span style={{ display: 'inline-block', width: '24px', textAlign: 'right' }}>{fps}</span>
            <input 
                type="range" 
                min="1" 
                max="24" 
                value={fps} 
                onChange={(e) => setFps(Number(e.target.value))}
                className={styles.fpsSlider}
            />
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
            
            <FramePreview frame={frame} width={width} height={height} />

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
