import { Eye, EyeOff, Trash2, Edit2 } from 'lucide-react'
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
  const [newLayerName, setNewLayerName] = useState('')
  const [isAddingLayer, setIsAddingLayer] = useState(false)
  const activeFrame = frames[activeFrameIndex]
  const activeLayer = activeFrame.layers.find(l => l.id === activeLayerId)

  const handleRename = (id: string, newName: string) => {
    renameLayer(id, newName)
    setEditingId(null)
  }

  const handleAddLayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const name = newLayerName.trim() || `Layer ${activeFrame.layers.length + 1}`
    addLayer(name)
    setNewLayerName('')
    setIsAddingLayer(false)
  }

  return (
    <div className={styles.panelContainer}>
      <div className={styles.layersList}>
        <div className={styles.addLayerContainer}>
          {isAddingLayer ? (
            <form onSubmit={handleAddLayer} className={clsx(styles.layerItem, styles.active)}>
              <input
                autoFocus
                className={styles.layerRenameInput}
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                onBlur={handleAddLayer}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setIsAddingLayer(false)
                }}
                placeholder="Layer name..."
              />
            </form>
          ) : (
            <button 
              className={styles.addLayerBtn}
              onClick={() => setIsAddingLayer(true)}
            >
              ADD LAYER
            </button>
          )}
        </div>

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
      
      <div className={styles.settingsSection}>
        {activeLayer && (
          <>
            <div className={styles.opacitySeparator} />
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
          </>
        )}
      </div>
    </div>
  )
}
