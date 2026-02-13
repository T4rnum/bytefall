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
                {palette.map((color, index) => {
                    const isPrimary = brushColor.toLowerCase() === color.toLowerCase()
                    const isSecondary = secondaryColor.toLowerCase() === color.toLowerCase()
                    
                    return (
                        <div
                            key={`${color}-${index}`}
                            className={clsx(styles.colorSwatch, {
                                [styles.activePrimary]: isPrimary,
                                [styles.activeSecondary]: isSecondary
                            })}
                            style={{ backgroundColor: color }}
                            onClick={(e) => handleColorClick(color, e)}
                            onContextMenu={(e) => {
                                e.preventDefault()
                                handleColorClick(color, e)
                            }}
                            title={`${color} (LMB: Brush, RMB: Secondary)`}
                        >
                            {isPrimary && <div className={styles.markerPrimary} />}
                            {isSecondary && <div className={styles.markerSecondary} />}
                        </div>
                    )
                })}
                <button 
                    className={styles.addBtn}
                    onClick={() => addColorToPalette(brushColor)}
                    onContextMenu={(e) => {
                        e.preventDefault()
                        addColorToPalette(secondaryColor)
                    }}
                    title="Add current colors (LMB: Primary, RMB: Secondary)"
                >
                    +
                </button>
            </div>
        </div>
    )
}
