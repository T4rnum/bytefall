import React, { useState, useEffect } from 'react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { NumberDragger } from '../UI/NumberDragger'
import styles from './Panels.module.scss'

export const ProjectPanel = () => {
    const { width: projectWidth, height: projectHeight, setSize } = useProjectStore()
    const [width, setWidth] = useState(projectWidth)
    const [height, setHeight] = useState(projectHeight)

    useEffect(() => {
        setWidth(projectWidth)
        setHeight(projectHeight)
    }, [projectWidth, projectHeight])

    const handleApply = () => {
        const w = Math.max(1, Math.min(200, width))
        const h = Math.max(1, Math.min(200, height))
        setSize(w, h)
    }

    return (
        <div className={styles.panelContainer}>
            <div className={styles.settingsSection}>
                <div className={styles.settingRow}>
                    <label>WIDTH</label>
                    <NumberDragger 
                        value={width} 
                        onChange={setWidth}
                        min={1}
                        max={200}
                        style={{ width: '60px' }}
                    />
                </div>
                <div className={styles.settingRow}>
                    <label>HEIGHT</label>
                    <NumberDragger 
                        value={height} 
                        onChange={setHeight}
                        min={1}
                        max={200}
                        style={{ width: '60px' }}
                    />
                </div>
                <div className={styles.settingRow} style={{ justifyContent: 'center', marginTop: '10px' }}>
                    <button 
                        className={styles.toolBtn} 
                        onClick={handleApply}
                        style={{ 
                            width: '100%', 
                            aspectRatio: 'auto', 
                            padding: '10px', 
                            fontSize: '10px',
                            fontFamily: '"Press Start 2P", cursive'
                        }}
                    >
                        APPLY RESIZE
                    </button>
                </div>
            </div>
        </div>
    )
}
