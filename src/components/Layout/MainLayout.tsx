import { ReactNode } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import styles from './MainLayout.module.scss'

interface MainLayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
  centerPanel: ReactNode
  bottomPanel?: ReactNode
}

export function MainLayout({ leftPanel, rightPanel, centerPanel, bottomPanel }: MainLayoutProps) {
  return (
    <div className={styles.layoutContainer}>
      <PanelGroup orientation="vertical">
        {/* Top Area: Left, Center, Right */}
        <Panel>
          <PanelGroup orientation="horizontal">
            {/* Left Sidebar */}
            <Panel collapsible defaultSize="20" minSize="10" maxSize="40" className={styles.panel}>
              {leftPanel}
            </Panel>

            <PanelResizeHandle className={styles.resizeHandle} />

            {/* Center Content */}
            <Panel minSize="30" className={styles.panel}>
              {centerPanel}
            </Panel>

            {rightPanel && (
              <>
                <PanelResizeHandle className={styles.resizeHandle} />

                {/* Right Sidebar */}
                <Panel collapsible defaultSize="20" minSize="10" maxSize="40" className={styles.panel}>
                  {rightPanel}
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
        
        {bottomPanel && (
          <>
            <PanelResizeHandle className={styles.resizeHandleHorizontal} />
            {/* Bottom Panel (Timeline) */}
            <Panel collapsible defaultSize="20" minSize="15" maxSize="60" className={styles.panel}>
              {bottomPanel}
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  )
}
