import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import styles from './FpsOverlay.module.scss'

export const FpsOverlay = () => {
  const showFps = useEditorStore(state => state.showFps)
  const [fps, setFps] = useState(0)
  const lastTimeRef = useRef(performance.now())
  const framesRef = useRef(0)

  useEffect(() => {
    if (!showFps) return
    let raf = 0
    const tick = (time: number) => {
      framesRef.current += 1
      const delta = time - lastTimeRef.current
      if (delta >= 500) {
        setFps(Math.round((framesRef.current * 1000) / delta))
        framesRef.current = 0
        lastTimeRef.current = time
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showFps])

  if (!showFps) return null

  return (
    <div className={styles.fps}>
      FPS: {fps}
    </div>
  )
}
