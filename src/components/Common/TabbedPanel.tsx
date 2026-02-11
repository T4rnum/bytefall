import { ReactNode, useState, useRef, useEffect } from 'react'
import styles from './TabbedPanel.module.scss'
import clsx from 'clsx'

interface Tab {
  id: string
  title: string
  content: ReactNode
}

interface TabbedPanelProps {
  tabs: Tab[]
  defaultTabId?: string
}

export const TabbedPanel = ({ tabs, defaultTabId }: TabbedPanelProps) => {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id)
  const headerRef = useRef<HTMLDivElement>(null)

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  useEffect(() => {
    const header = headerRef.current
    if (!header) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        // If the header has overflow, scroll it horizontally
        if (header.scrollWidth > header.clientWidth) {
            e.preventDefault()
            header.scrollLeft += e.deltaY
        }
      }
    }

    header.addEventListener('wheel', handleWheel, { passive: false })
    return () => header.removeEventListener('wheel', handleWheel)
  }, [])

  if (!tabs.length) return null

  return (
    <div className={styles.container}>
      <div className={styles.header} ref={headerRef}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={clsx(styles.tab, tab.id === activeTabId && styles.active)}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.title}
          </div>
        ))}
      </div>
      <div className={styles.content}>
        {activeTab?.content}
      </div>
    </div>
  )
}
