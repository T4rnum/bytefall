import React, { useState, useEffect } from 'react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { NumberDragger } from '../UI/NumberDragger'
import styles from './Panels.module.scss'

export const ProjectPanel = () => {
    const { width: projectWidth, height: projectHeight, setSize } = useProjectStore()
    const { canvasBgColor, setCanvasBgColor, exportBgColor, setExportBgColor } = useEditorStore()
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

                <div className={styles.settingRow} style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                    <label>CANVAS BG</label>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                         <input 
                            type="checkbox" 
                            checked={canvasBgColor === null}
                            onChange={(e) => setCanvasBgColor(e.target.checked ? null : '#111111')}
                         />
                         <span style={{ fontSize: '10px', color: '#888' }}>TRANSP</span>
                         {canvasBgColor !== null && (
                             <input 
                                type="color" 
                                value={canvasBgColor}
                                onChange={(e) => setCanvasBgColor(e.target.value)}
                                style={{ width: '20px', height: '20px', padding: 0, border: 'none', background: 'none' }}
                             />
                         )}
                    </div>
                </div>
                <div className={styles.settingRow}>
                    <label>EXPORT BG</label>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                         <input 
                            type="checkbox" 
                            checked={exportBgColor === null}
                            onChange={(e) => setExportBgColor(e.target.checked ? null : '#111111')}
                         />
                         <span style={{ fontSize: '10px', color: '#888' }}>TRANSP</span>
                         {exportBgColor !== null && (
                             <input 
                                type="color" 
                                value={exportBgColor}
                                onChange={(e) => setExportBgColor(e.target.value)}
                                style={{ width: '20px', height: '20px', padding: 0, border: 'none', background: 'none' }}
                             />
                         )}
                    </div>
                </div>
            </div>
        </div>
    )
}
