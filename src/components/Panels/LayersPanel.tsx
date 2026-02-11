import { Eye, EyeOff, Plus } from 'lucide-react'
import { useProjectStore } from '../../modules/2d/store/projectStore'
import styles from './Panels.module.scss'
import clsx from 'clsx'

export const LayersPanel = () => {
  const { 
    frames, 
    activeFrameIndex, 
    activeLayerId, 
    addLayer, 
    toggleLayerVisibility, 
    setActiveLayerId 
  } = useProjectStore()

  const activeFrame = frames[activeFrameIndex]

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader} style={{ justifyContent: 'flex-end' }}>
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
                <span className={styles.layerName}>{layer.name}</span>
            </div>
        ))} 
      </div>
      
      <div className={styles.panelHeader} style={{ marginTop: 'auto', borderTop: '2px solid var(--border-color)' }}>
        PROPERTIES
      </div>
      <div style={{ padding: '12px', fontSize: '10px' }}>
        Opacity: {(activeFrame.layers.find(l => l.id === activeLayerId)?.opacity ?? 1) * 100}%
      </div>
    </div>
  )
}
