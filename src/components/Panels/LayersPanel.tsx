import { Eye, EyeOff, Plus, Trash2, Edit2 } from 'lucide-react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import { NumberDragger } from '../UI/NumberDragger'
import styles from './Panels.module.scss'
import clsx from 'clsx'
import React, { useState } from 'react'

export const LayersPanel = () => {
  const { 
    frames, 
    activeFrameIndex, 
    activeLayerId, 
    addLayer, 
    deleteLayer,
    renameLayer,
    toggleLayerVisibility, 
    setLayerOpacity,
    setActiveLayerId 
  } = useProjectStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const activeFrame = frames[activeFrameIndex]
  const activeLayer = activeFrame.layers.find(l => l.id === activeLayerId)

  const handleRename = (id: string, newName: string) => {
    renameLayer(id, newName)
    setEditingId(null)
  }

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <span>LAYERS</span>
        <button 
          className={styles.iconBtn} 
          onClick={() => addLayer(`Layer ${activeFrame.layers.length + 1}`)}
          title="Add Layer"
        >
            <Plus size={16} />
        </button>
      </div>
      <div className={styles.layersList}>
        {[...activeFrame.layers].reverse().map((layer) => (
            <div 
                key={layer.id} 
                className={clsx(styles.layerItem, layer.id === activeLayerId && styles.active)}
                onClick={() => setActiveLayerId(layer.id)}
            >
                <button 
                    className={styles.visibilityBtn}
                    onClick={(e) => {
                        e.stopPropagation()
                        toggleLayerVisibility(layer.id)
                    }}
                >
                    {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                
                {editingId === layer.id ? (
                  <input
                    autoFocus
                    className={styles.layerRenameInput}
                    defaultValue={layer.name}
                    onBlur={(e) => handleRename(layer.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(layer.id, e.currentTarget.value)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.layerName} onDoubleClick={() => setEditingId(layer.id)}>
                    {layer.name}
                  </span>
                )}

                <div className={styles.layerActions}>
                  <button 
                    className={styles.iconBtnSmall}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(layer.id)
                    }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button 
                    className={styles.iconBtnSmall}
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteLayer(layer.id)
                    }}
                    disabled={activeFrame.layers.length <= 1}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
            </div>
        ))} 
      </div>
      
      <div className={styles.panelHeader} style={{ marginTop: 'auto', borderTop: '2px solid var(--border-color)' }}>
        PROPERTIES
      </div>
      <div className={styles.settingsSection}>
        {activeLayer && (
          <div className={styles.settingRow}>
            <label>OPACITY</label>
            <div style={{ width: '60px' }}>
              <NumberDragger 
                value={Math.round(activeLayer.opacity * 100)}
                min={0}
                max={100}
                onChange={(val) => setLayerOpacity(activeLayer.id, val / 100)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
