import { useState, useEffect } from 'react'
import { MainLayout } from './components/Layout/MainLayout'
import { ToolsPanel } from './components/Panels/ToolsPanel'
import { LayersPanel } from './components/Panels/LayersPanel'
import { ProjectPanel } from './components/Panels/ProjectPanel'
import { TimelinePanel } from './components/Panels/TimelinePanel'
import { TabbedPanel } from './components/Common/TabbedPanel'
import { Stage2D } from './modules/2d/components/Stage2D'
import { useProjectStore } from './modules/2d/store/projectStore'
import { useEditorStore } from './modules/2d/store/editorStore'
import { useHotkeys } from './modules/2d/hotkeys/useHotkeys'
import { Save, FolderOpen, Image as ImageIcon } from 'lucide-react'
import './App.scss'

// Components moved outside to prevent re-creation on every render
const Header = () => {
  const { activeTab, setActiveTab } = useEditorStore()
  const { exportProject, loadProject, frames, activeFrameIndex } = useProjectStore()

  const handleSave = async () => {
      const content = exportProject()
      // @ts-ignore
      if (window.ipcRenderer) {
          // @ts-ignore
          const result = await window.ipcRenderer.invoke('save-project', content)
          if (result.success) {
              console.log('Saved to', result.filePath)
          }
      }
  }

  const handleLoad = async () => {
      // @ts-ignore
      if (window.ipcRenderer) {
          // @ts-ignore
          const result = await window.ipcRenderer.invoke('load-project')
          if (result.success && result.content) {
              loadProject(result.content)
          }
      }
  }

  const handleExportImage = async () => {
      const activeFrame = frames[activeFrameIndex]
      if (!activeFrame) return

      // Determine bounds
      let minX = Infinity, maxX = -Infinity
      let minY = Infinity, maxY = -Infinity
      let hasData = false

      activeFrame.layers.forEach(layer => {
          if (!layer.visible) return
          layer.data.forEach((_, key) => {
              const [x, y] = key.split(',').map(Number)
              minX = Math.min(minX, x)
              maxX = Math.max(maxX, x)
              minY = Math.min(minY, y)
              maxY = Math.max(maxY, y)
              hasData = true
          })
      })

      if (!hasData) {
          alert("Nothing to export!")
          return
      }

      // Add padding
      const padding = 1
      minX -= padding
      maxX += padding
      minY -= padding
      maxY += padding

      const CELL_SIZE = 20
      const width = (maxX - minX + 1) * CELL_SIZE
      const height = (maxY - minY + 1) * CELL_SIZE

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Background
      const exportBgColor = useEditorStore.getState().exportBgColor
      if (exportBgColor) {
          ctx.fillStyle = exportBgColor
          ctx.fillRect(0, 0, width, height)
      }

      // Draw Cells
      activeFrame.layers.forEach(layer => {
          if (!layer.visible) return
          layer.data.forEach((cell, key) => {
              const [x, y] = key.split(',').map(Number)
              const px = (x - minX) * CELL_SIZE
              const py = (y - minY) * CELL_SIZE

              if (cell.bgColor) {
                  ctx.fillStyle = cell.bgColor
                  ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE)
              }

              if (cell.char) {
                  ctx.fillStyle = cell.color || '#fff'
                  ctx.font = '16px "Press Start 2P", monospace'
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  ctx.fillText(cell.char, px + CELL_SIZE/2, py + CELL_SIZE/2 + 2)
              }
          })
      })

      const dataUrl = canvas.toDataURL('image/png')
      
      // @ts-ignore
      if (window.ipcRenderer) {
          // @ts-ignore
          const result = await window.ipcRenderer.invoke('save-image', dataUrl)
          if (result.success) {
              console.log('Image saved to', result.filePath)
          }
      }
  }

  return (
  <header className="app-header">
    <div className="title">BYTEFALL</div>
    <div className="header-right">
      <div className="actions">
          <button className="icon-btn" onClick={handleSave} title="Save Project">
              <Save size={18} />
          </button>
          <button className="icon-btn" onClick={handleLoad} title="Load Project">
              <FolderOpen size={18} />
          </button>
          <button className="icon-btn" onClick={handleExportImage} title="Export Image">
              <ImageIcon size={18} />
          </button>
      </div>
      <div className="mode-switcher">
        <button 
          className={activeTab === '2D' ? 'active' : ''} 
          onClick={() => setActiveTab('2D')}
        >
          2D MODE
        </button>
        <button 
          className={activeTab === '3D' ? 'active' : ''} 
          onClick={() => setActiveTab('3D')}
        >
          3D MODE
        </button>
      </div>
    </div>
  </header>
  )
}

function App() {
  const [mounted, setMounted] = useState(false)
  useHotkeys()

  useEffect(() => {
    setMounted(true)
    console.log("App mounted")
  }, [])

  if (!mounted) return null

  return (
    <div className="app-container">
      <Header />
      <div className="workspace-wrapper">
        <MainLayout 
          leftPanel={<TabbedPanel tabs={[{ id: 'tools', title: 'TOOLS', content: <ToolsPanel /> }]} />}
          centerPanel={<Stage2D />}
          rightPanel={<TabbedPanel tabs={[
            { id: 'layers', title: 'LAYERS', content: <LayersPanel /> },
            { id: 'project', title: 'PROJECT', content: <ProjectPanel /> }
          ]} />}
          bottomPanel={<TabbedPanel tabs={[{ id: 'timeline', title: 'TIMELINE', content: <TimelinePanel /> }]} />}
        />
      </div>
    </div>
  )
}

export default App
