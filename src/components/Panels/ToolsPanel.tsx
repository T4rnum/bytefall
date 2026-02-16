import React, { useState, useRef, useEffect } from 'react'
import { Paintbrush, Eraser, MousePointer2, PaintBucket, Minus, Square, Pipette, ArrowUpRight, Circle, Lasso, Wand2, PlusSquare, MinusSquare, BoxSelect, Move } from 'lucide-react'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { ToolType } from '../../modules/2d/types'
import CharPicker from '../UI/CharPicker'
import { ColorPalette } from '../UI/ColorPalette'
import { NumberDragger } from '../UI/NumberDragger'
import { CustomSelect } from '../UI/CustomSelect'
import styles from './Panels.module.scss'
import clsx from 'clsx'

const TOOLS: { id: ToolType; icon: React.ElementType; label: string; hotkey: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', hotkey: 'S' },
  { id: 'move', icon: Move, label: 'Move', hotkey: 'V' },
  { id: 'lasso', icon: Lasso, label: 'Lasso', hotkey: 'K' },
  { id: 'magicWand', icon: Wand2, label: 'Wand', hotkey: 'W' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', hotkey: 'B' },
  { id: 'eraser', icon: Eraser, label: 'Eraser', hotkey: 'E' },
  { id: 'fill', icon: PaintBucket, label: 'Fill', hotkey: 'G' },
  { id: 'gradient', icon: ArrowUpRight, label: 'Gradient', hotkey: 'H' },
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
    setGradientColors,
    wandMode,
    setWandMode,
    wandTolerance,
    setWandTolerance,
    selectionMode,
    setSelectionMode,
    renderMode3D,
    setRenderMode3D,
    autoRotate3D,
    setAutoRotate3D,
    asciiMode3D,
    setAsciiMode3D,
    asciiFontSize,
    setAsciiFontSize,
    asciiFillBackground3D,
    setAsciiFillBackground3D,
    cameraType3D,
    setCameraType3D,
    cameraZoom3D,
    setCameraZoom3D,
    layerDepth3D,
    setLayerDepth3D,
    activeTab
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
            {activeTab === '3D' && (
                <>
                    <div className={styles.settingRow}>
                        <span>MODE</span>
                        <CustomSelect
                            value={renderMode3D}
                            onChange={(val) => setRenderMode3D(val as 'voxel' | 'plane')}
                            options={[
                                { value: 'plane', label: 'PLANE' },
                                { value: 'voxel', label: 'VOXEL' }
                            ]}
                            className={styles.toolSelect}
                        />
                    </div>
                    <div className={styles.settingRow}>
                        <span>CAMERA</span>
                        <CustomSelect
                            value={cameraType3D}
                            onChange={(val) => setCameraType3D(val as 'persp' | 'ortho')}
                            options={[
                                { value: 'persp', label: 'PERSP' },
                                { value: 'ortho', label: 'ORTHO' }
                            ]}
                            className={styles.toolSelect}
                        />
                    </div>
                    {cameraType3D === 'ortho' && (
                        <div className={styles.settingRow}>
                            <span>ZOOM</span>
                            <NumberDragger
                                value={cameraZoom3D}
                                onChange={setCameraZoom3D}
                                min={0.1}
                                max={20}
                                step={0.1}
                            />
                        </div>
                    )}
                    <div className={styles.settingRow}>
                        <span>DEPTH</span>
                        <NumberDragger
                            value={layerDepth3D}
                            onChange={setLayerDepth3D}
                            min={0}
                            max={5}
                            step={0.01}
                            wheelStep={0.1}
                        />
                    </div>
                    <div className={styles.settingRow}>
                        <span>AUTO ROT</span>
                        <input
                            type="checkbox"
                            checked={autoRotate3D}
                            onChange={(e) => setAutoRotate3D(e.target.checked)}
                        />
                    </div>
                    <div className={styles.settingRow}>
                        <span>ASCII</span>
                        <input
                            type="checkbox"
                            checked={asciiMode3D}
                            onChange={(e) => setAsciiMode3D(e.target.checked)}
                        />
                    </div>
                </>
            )}
            {activeTab === '3D' && asciiMode3D && (
                <>
                    <div className={styles.settingRow} style={{ marginBottom: '10px', padding: '8px', backgroundColor: 'rgba(255, 204, 0, 0.05)', borderRadius: '4px', border: '1px solid rgba(255, 204, 0, 0.2)' }}>
                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>ASCII SIZE</span>
                        <NumberDragger
                            value={asciiFontSize}
                            onChange={setAsciiFontSize}
                            min={5}
                            max={10}
                            step={1}
                        />
                    </div>
                    <div className={styles.settingRow}>
                        <span>ASCII FILL</span>
                        <input
                            type="checkbox"
                            checked={asciiFillBackground3D}
                            onChange={(e) => setAsciiFillBackground3D(e.target.checked)}
                        />
                    </div>
                </>
            )}
            {(activeTool === 'select' || activeTool === 'lasso' || activeTool === 'magicWand') && (
                <div className={styles.settingRow} style={{ marginBottom: '15px' }}>
                    <span>MODE</span>
                    <div className={styles.selectionModes}>
                        <button 
                            className={clsx(styles.modeBtn, selectionMode === 'new' && styles.active)}
                            onClick={() => setSelectionMode('new')}
                            title="New Selection (Ctrl click or release modifiers)"
                        >
                            <Square size={16} />
                        </button>
                        <button 
                            className={clsx(styles.modeBtn, selectionMode === 'add' && styles.active)}
                            onClick={() => setSelectionMode('add')}
                            title="Add to Selection (Hold Shift)"
                        >
                            <PlusSquare size={16} />
                        </button>
                        <button 
                            className={clsx(styles.modeBtn, selectionMode === 'subtract' && styles.active)}
                            onClick={() => setSelectionMode('subtract')}
                            title="Subtract from Selection (Hold Alt)"
                        >
                            <MinusSquare size={16} />
                        </button>
                        <button 
                            className={clsx(styles.modeBtn, selectionMode === 'intersect' && styles.active)}
                            onClick={() => setSelectionMode('intersect')}
                            title="Intersect Selection (Hold Shift + Alt)"
                        >
                            <BoxSelect size={16} />
                        </button>
                    </div>
                </div>
            )}
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
                    <CustomSelect 
                        value={gradientType} 
                        onChange={(val) => setGradientType(val as 'linear' | 'radial')}
                        options={[
                            { value: 'linear', label: 'LINEAR' },
                            { value: 'radial', label: 'RADIAL' }
                        ]}
                        className={styles.toolSelect}
                    />
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

            {activeTool === 'magicWand' && (
                <>
                <div className={styles.settingRow}>
                    <span>MODE</span>
                    <CustomSelect 
                        value={wandMode} 
                        onChange={(val) => setWandMode(val as 'color' | 'char')}
                        options={[
                            { value: 'color', label: 'COLOR' },
                            { value: 'char', label: 'SYMBOL' }
                        ]}
                        className={styles.toolSelect}
                    />
                </div>
                {wandMode === 'color' && (
                    <div className={styles.settingRow}>
                        <span>TOLERANCE</span>
                        <NumberDragger
                            value={wandTolerance}
                            onChange={setWandTolerance}
                            min={0}
                            max={255}
                            step={1}
                        />
                    </div>
                )}
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
