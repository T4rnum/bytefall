import React, { useState, useRef, useEffect } from 'react'
import styles from './NumberDragger.module.scss'

interface NumberDraggerProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  wheelStep?: number
  className?: string
  style?: React.CSSProperties
}

export const NumberDragger: React.FC<NumberDraggerProps> = ({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  wheelStep,
  className,
  style
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value.toString())
  
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Sync internal edit value when external value changes
  useEffect(() => {
    if (!isEditing) {
      setTempValue(value.toString())
    }
  }, [value, isEditing])

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        const dx = e.movementX
        const dy = e.movementY
        
        // Right or Up increases value
        // Down or Left decreases value
        // We prioritize the axis with larger movement, or just sum them.
        // Let's use (dx - dy) so dragging Up (-dy) adds, dragging Right (+dx) adds.
        const delta = dx - dy
        
        if (delta !== 0) {
          const change = Math.sign(delta) * step
          const newValue = Math.min(max, Math.max(min, value + change))
          onChange(newValue)
        }
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.exitPointerLock?.()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      // Request pointer lock for infinite scrolling feel (optional, but good for Blender style)
      // But simple dragging is safer for now.
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, value, min, max, step, onChange])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return
    if (e.button !== 0) return // Left click only
    
    e.preventDefault() // Prevent text selection
    setIsDragging(true)
    // containerRef.current?.requestPointerLock?.() // Optional
  }

  const handleDoubleClick = () => {
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
    commitEdit()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
      commitEdit()
    }
    if (e.key === 'Escape') {
      setIsEditing(false)
      setTempValue(value.toString()) // Revert
    }
  }

  const commitEdit = () => {
    let val = parseFloat(tempValue)
    if (isNaN(val)) val = value
    val = Math.min(max, Math.max(min, val))
    onChange(val)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (isEditing) return
    const delta = -Math.sign(e.deltaY) * (wheelStep ?? step)
    const newValue = Math.min(max, Math.max(min, value + delta))
    onChange(newValue)
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        className={`${styles.input} ${className || ''}`}
        style={style}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isDragging ? styles.dragging : ''} ${className || ''}`}
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      title="Drag to change, Double-click to edit"
    >
      {value}
    </div>
  )
}
