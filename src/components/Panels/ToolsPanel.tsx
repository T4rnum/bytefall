import { Paintbrush, Eraser, MousePointer2, PaintBucket, Minus, Square, Pipette, ArrowUpRight } from 'lucide-react'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { ToolType } from '../../modules/2d/types'
import styles from './Panels.module.scss'
import clsx from 'clsx'

const TOOLS: { id: ToolType; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select' },
  { id: 'brush', icon: Paintbrush, label: 'Brush' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'fill', icon: PaintBucket, label: 'Fill' },
  { id: 'gradient', icon: ArrowUpRight, label: 'Gradient' },
  { id: 'eyedropper', icon: Pipette, label: 'Eyedropper' },
  { id: 'line', icon: Minus, label: 'Line' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
]

export const ToolsPanel = () => {
  const { 
    activeTool, 
    setActiveTool,
    brushChar,
    setBrushChar,
    brushColor,
    setBrushColor,
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
                title={tool.label}
            >
                <tool.icon size={20} />
            </button>
            ))}
        </div>

        <div className={styles.panelHeader}>SETTINGS</div>
        <div className={styles.settingsSection}>
            <div className={styles.settingRow}>
            <span>CHAR</span>
            <input 
                type="text" 
                className={styles.charInput}
                value={brushChar}
                onChange={(e) => setBrushChar(e.target.value.slice(0, 1))}
                maxLength={1}
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
        </div>
      </div>
    </div>
  )
}
