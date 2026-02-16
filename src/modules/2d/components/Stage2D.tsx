import { ThreeStage } from '../../render/ThreeStage'
import { CanvasRenderer } from './CanvasRenderer'
import { FpsOverlay } from './FpsOverlay'
import { useEditorStore } from '../store/editorStore'
import styles from './PixiStage.module.scss'

export const Stage2D = () => {
  const activeTab = useEditorStore(state => state.activeTab)
  return (
    <div className={styles.stage}>
      <div className={styles.layer}>
        <ThreeStage />
      </div>
      <div className={styles.layer} style={{ pointerEvents: activeTab === '3D' ? 'none' : 'auto' }}>
        <CanvasRenderer mode="overlay" inputOnly={true} />
      </div>
      <FpsOverlay />
    </div>
  )
}
