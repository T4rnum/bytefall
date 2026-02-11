import React from 'react'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import styles from './ColorPalette.module.scss'
import clsx from 'clsx'

export const ColorPalette: React.FC = () => {
    const { palette, brushColor, setBrushColor, secondaryColor, setSecondaryColor, addColorToPalette } = useEditorStore()

    const handleColorClick = (color: string, e: React.MouseEvent) => {
        if (e.button === 2 || e.ctrlKey) {
            // Right click or Ctrl+Click for secondary color
            setSecondaryColor(color)
        } else {
            setBrushColor(color)
        }
    }

    return (
        <div className={styles.paletteContainer}>
            <div className={styles.grid}>
                {palette.map((color, index) => (
                    <div
                        key={`${color}-${index}`}
                        className={clsx(styles.colorSwatch, {
                            [styles.activePrimary]: brushColor === color,
                            [styles.activeSecondary]: secondaryColor === color
                        })}
                        style={{ backgroundColor: color }}
                        onClick={(e) => handleColorClick(color, e)}
                        onContextMenu={(e) => {
                            e.preventDefault()
                            handleColorClick(color, e)
                        }}
                        title={`${color} (LMB: Brush, RMB: Secondary)`}
                    />
                ))}
                <button 
                    className={styles.addBtn}
                    onClick={() => addColorToPalette(brushColor)}
                    title="Add current color to palette"
                >
                    +
                </button>
            </div>
        </div>
    )
}
