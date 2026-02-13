import React from 'react'
import { X, Download, Settings2 } from 'lucide-react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { useEditorStore } from '../../modules/2d/store/editorStore'
import { exportFrameToPNG, exportToSpriteSheet, exportToGIF } from '../../utils/exportUtils'
import { NumberDragger } from './NumberDragger'
import styles from './ExportPopup.module.scss'

interface ExportPopupProps {
    onClose: () => void
}

export const ExportPopup: React.FC<ExportPopupProps> = ({ onClose }) => {
    const { frames, activeFrameIndex, width, height } = useProjectStore()
    const { exportBgColor, setExportBgColor, canvasBgColor } = useEditorStore()
    const [fps, setFps] = React.useState(10)
    const [scale, setScale] = React.useState(2)

    const handleExportPNG = () => {
        const frame = frames[activeFrameIndex]
        if (!frame) return
        exportFrameToPNG(frame, width, height, exportBgColor)
    }

    const handleExportSpriteSheet = () => {
        exportToSpriteSheet(frames, width, height, exportBgColor)
    }

    const handleExportGIF = () => {
        exportToGIF(frames, width, height, exportBgColor, fps)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.popup} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        <Settings2 size={16} />
                        <span>EXPORT SETTINGS</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>GENERAL</div>
                        <div className={styles.settingRow}>
                            <label>TRANSPARENT BG</label>
                            <input 
                                type="checkbox" 
                                checked={exportBgColor === null}
                                onChange={(e) => setExportBgColor(e.target.checked ? null : (exportBgColor || canvasBgColor))}
                            />
                        </div>
                        {exportBgColor !== null && (
                            <div className={styles.settingRow}>
                                <label>EXPORT BG COLOR</label>
                                <input 
                                    type="color" 
                                    value={exportBgColor}
                                    onChange={(e) => setExportBgColor(e.target.value)}
                                    className={styles.colorInput}
                                />
                            </div>
                        )}
                        <div className={styles.settingRow}>
                            <label>EXPORT SCALE</label>
                            <div className={styles.scaleContainer}>
                                {[1, 2, 4, 8].map(s => (
                                    <button 
                                        key={s}
                                        className={`${styles.scaleBtn} ${scale === s ? styles.active : ''}`}
                                        onClick={() => setScale(s)}
                                    >
                                        {s}x
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>ANIMATION (GIF)</div>
                        <div className={styles.settingRow}>
                            <label>ANIMATION FPS</label>
                            <NumberDragger 
                                value={fps} 
                                onChange={setFps}
                                min={1}
                                max={60}
                                style={{ width: '60px' }}
                            />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.exportBtn} onClick={handleExportPNG}>
                            <Download size={16} />
                            <span>EXPORT PNG</span>
                        </button>
                        <button className={styles.exportBtn} onClick={handleExportSpriteSheet}>
                            <Download size={16} />
                            <span>SPRITESHEET</span>
                        </button>
                        <button className={`${styles.exportBtn} ${styles.gifBtn}`} onClick={handleExportGIF}>
                            <Download size={16} />
                            <span>EXPORT GIF</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
