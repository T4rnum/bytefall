import { useState, useEffect } from 'react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { NumberDragger } from '../UI/NumberDragger'
import { exportFrameToPNG } from '../../utils/exportUtils'
import styles from './Panels.module.scss'

export const ProjectPanel = () => {
    const { frames, activeFrameIndex, width: projectWidth, height: projectHeight, setSize } = useProjectStore()
    const { 
        canvasBgColor, setCanvasBgColor, 
        exportBgColor, setExportBgColor,
        showGrid, setShowGrid,
        showCenterGuide, setShowCenterGuide,
        workspaceColor, setWorkspaceColor
    } = useEditorStore()
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

    const handleExport = () => {
        const frame = frames[activeFrameIndex]
        if (!frame) return
        exportFrameToPNG(frame, projectWidth, projectHeight, exportBgColor)
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
                    <label>CANVAS COLOR</label>
                    <input 
                        type="color" 
                        value={canvasBgColor}
                        onChange={(e) => setCanvasBgColor(e.target.value)}
                        style={{ width: '40px', height: '24px' }}
                    />
                </div>
                <div className={styles.settingRow}>
                    <label>VIEWPORT COLOR</label>
                    <input 
                        type="color" 
                        value={workspaceColor}
                        onChange={(e) => setWorkspaceColor(e.target.value)}
                        style={{ width: '40px', height: '24px' }}
                    />
                </div>
                <div className={styles.settingRow}>
                    <label>EXPORT TRANSP</label>
                    <input 
                        type="checkbox" 
                        checked={exportBgColor === null}
                        onChange={(e) => setExportBgColor(e.target.checked ? null : canvasBgColor)}
                    />
                </div>

                <div className={styles.settingRow} style={{ justifyContent: 'center', marginTop: '10px' }}>
                    <button 
                        className={styles.toolBtn} 
                        onClick={handleExport}
                        style={{ 
                            width: '100%', 
                            aspectRatio: 'auto', 
                            padding: '10px', 
                            fontSize: '10px',
                            fontFamily: '"Press Start 2P", cursive',
                            backgroundColor: 'var(--accent)',
                            color: 'var(--bg-darker)'
                        }}
                    >
                        EXPORT PNG
                    </button>
                </div>

                <div className={styles.settingRow} style={{ marginTop: '15px', borderTop: '1px solid #333', paddingTop: '10px' }}>
                    <label>SHOW GRID</label>
                    <input 
                        type="checkbox" 
                        checked={showGrid}
                        onChange={(e) => setShowGrid(e.target.checked)}
                    />
                </div>

                <div className={styles.settingRow}>
                    <label>CENTER GUIDE</label>
                    <input 
                        type="checkbox" 
                        checked={showCenterGuide}
                        onChange={(e) => setShowCenterGuide(e.target.checked)}
                    />
                </div>
            </div>
        </div>
    )
}
