import React, { useState, useRef, useEffect } from 'react'
import { Paintbrush, Eraser, MousePointer2, PaintBucket, Minus, Square, Pipette, ArrowUpRight, Circle } from 'lucide-react'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { ToolType } from '../../modules/2d/types'
import { CharPicker } from '../UI/CharPicker'
import { ColorPalette } from '../UI/ColorPalette'
import styles from './Panels.module.scss'
import clsx from 'clsx'

const TOOLS: { id: ToolType; icon: React.ElementType; label: string; hotkey: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', hotkey: 'S' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', hotkey: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', hotkey: 'E' },
  { id: 'fill', icon: PaintBucket, label: 'Fill', hotkey: 'G' },
  { id: 'gradient', icon: ArrowUpRight, label: 'Gradient', hotkey: 'H' }, // Changed hotkey to H to avoid conflict if needed
  { id: 'eyedropper', icon: Pipette, label: 'Eyedropper', hotkey: 'I' },
  { id: 'line', icon: Minus, label: 'Line', hotkey: 'L' },
  { id: 'rectangle', icon: Square, label: 'Rectangle', hotkey: 'R' },
  { id: 'circle', icon: Circle, label: 'Circle', hotkey: 'C' },
]

interface CharInputProps {
    value: string
    onChange: (val: string) => void
}

const CharInput: React.FC<CharInputProps> = ({ value, onChange }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Handle click outside to close picker
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowPicker(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleSingleClick = () => {
        if (!isEditing) {
            setShowPicker(!showPicker)
        }
    }

    const handleDoubleClick = () => {
        setShowPicker(false)
        setIsEditing(true)
    }

    const handleBlur = () => {
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            setIsEditing(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        // Allow empty string (for backspace clearing) or single char
        if (val.length <= 1) {
             onChange(val)
        } else {
             // If pasting or typing multiple, take the last char usually, or just the new one
             // But simpler to just take the last char if it's appended
             onChange(val.slice(-1))
        }
        // Auto-blur after typing a character? User said: "input automatically disappears when you click on a symbol"
        // If typing manually, maybe we should close after 1 char?
        // "input automatically disappears when you click on a symbol" -> This likely refers to the Picker.
        // "Also when the field waits for symbol input, show it visually".
        // Let's assume manual input stays open until Enter or Blur, OR if single char is typed?
        // "input automatically disappears when you press a symbol" -> Sounds like auto-submit on keypress.
        if (val.length === 1) {
            // Optional: Auto-close on single char input
             setIsEditing(false)
        }
    }

    return (
        <div className={styles.charInputContainer} ref={containerRef} style={{ position: 'relative' }}>
            {isEditing ? (
                <input 
                    ref={inputRef}
                    type="text" 
                    className={clsx(styles.charInput, styles.editing)}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    maxLength={1} // Just in case
                />
            ) : (
                <div 
                    className={clsx(styles.charDisplay, showPicker && styles.active)}
                    onClick={handleSingleClick}
                    onDoubleClick={handleDoubleClick}
                    title="Click to pick, Dbl-Click to edit"
                >
                    {value === ' ' ? <span style={{ opacity: 0.5, fontSize: '8px' }}>[SPC]</span> : (value || <span style={{ opacity: 0.3 }}>∅</span>)}
                </div>
            )}
            
            {showPicker && (
                <CharPicker 
                    activeChar={value} 
                    onSelect={(char) => {
                        onChange(char)
                        setShowPicker(false)
                    }}
                    onClose={() => setShowPicker(false)}
                />
            )}
        </div>
    )
}

export const ToolsPanel = () => {
  const { 
    activeTool, 
    setActiveTool,
    brushChar,
    setBrushChar,
    brushColor,
    setBrushColor,
    secondaryChar,
    setSecondaryChar,
    secondaryColor,
    setSecondaryColor,
    gradientType,
    setGradientType,
    gradientColorStart,
    gradientColorEnd,
    setGradientColors
  } = useEditorStore()

  return (
    <div className={styles.panelContainer}>
      <div className={styles.scrollableContent}>
        <div className={styles.toolsGrid}>
            {TOOLS.map((tool) => (
            <button
                key={tool.id}
                className={clsx(styles.toolBtn, activeTool === tool.id && styles.active)}
                onClick={() => setActiveTool(tool.id)}
                title={`${tool.label} (${tool.hotkey})`}
                style={{ position: 'relative' }}
            >
                <tool.icon size={20} />
                <span style={{ 
                    position: 'absolute', 
                    bottom: '2px', 
                    right: '2px', 
                    fontSize: '8px', 
                    opacity: 0.6,
                    pointerEvents: 'none'
                }}>
                    {tool.hotkey}
                </span>
            </button>
            ))}
        </div>

        <div className={styles.panelHeader}>SETTINGS</div>
        <div className={styles.settingsSection}>
            <div className={styles.settingRow}>
            <span>CHAR</span>
            <CharInput 
                value={brushChar}
                onChange={setBrushChar}
            />
            </div>
            <div className={styles.settingRow}>
            <span>COLOR</span>
            <input 
                type="color" 
                className={styles.colorInput}
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
            />
            </div>
            
            <div className={styles.settingRow} style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <span>RMB CHAR</span>
            <CharInput 
                value={secondaryChar}
                onChange={setSecondaryChar}
            />
            </div>
            <div className={styles.settingRow}>
            <span>RMB COL</span>
            <input 
                type="color" 
                className={styles.colorInput}
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
            />
            </div>
            {activeTool === 'gradient' && (
                <>
                <div className={styles.settingRow}>
                    <span>TYPE</span>
                    <select 
                        value={gradientType} 
                        onChange={(e) => setGradientType(e.target.value as 'linear' | 'radial')}
                        className={styles.charInput}
                        style={{ flex: 1, fontSize: '10px', width: 'auto' }}
                    >
                        <option value="linear">Linear</option>
                        <option value="radial">Radial</option>
                    </select>
                </div>
                <div className={styles.settingRow}>
                    <span>START</span>
                    <input 
                        type="color" 
                        className={styles.colorInput}
                        value={gradientColorStart}
                        onChange={(e) => setGradientColors(e.target.value, gradientColorEnd)}
                    />
                </div>
                <div className={styles.settingRow}>
                    <span>END</span>
                    <input 
                        type="color" 
                        className={styles.colorInput}
                        value={gradientColorEnd}
                        onChange={(e) => setGradientColors(gradientColorStart, e.target.value)}
                    />
                </div>
                </>
            )}

            <div style={{ marginTop: '15px', borderTop: '2px solid var(--border-color)', paddingTop: '10px' }}>
                <div style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '8px' }}>PALETTE</div>
                <ColorPalette />
            </div>
        </div>
      </div>
    </div>
  )
}
