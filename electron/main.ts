import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  const publicDir = process.env.VITE_PUBLIC || ''
  const distDir = process.env.DIST || ''
  
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(publicDir, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    backgroundColor: '#2e2c29',
  })

  win.setMenu(null) // Disable default menu

  // Restore shortcuts disabled by setMenu(null)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    // F12 or Ctrl+Shift+I to toggle DevTools
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win?.webContents.toggleDevTools()
      event.preventDefault()
    }

    // F5 or Ctrl+R to reload
    if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
      win?.webContents.reload()
      event.preventDefault()
    }
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Open DevTools by default for debugging
  win.webContents.openDevTools()

  if (VITE_DEV_SERVER_URL) {
    const devServerUrl = VITE_DEV_SERVER_URL.replace('localhost', '127.0.0.1')
    console.log('Loading URL:', devServerUrl)
    const loadURL = () => {
      win?.loadURL(devServerUrl).catch((err) => {
        console.log('Failed to load URL, retrying...', err)
        setTimeout(loadURL, 1000)
      })
    }
    loadURL()
  } else {
    console.log('Loading file:', path.join(distDir, 'index.html'))
    win.loadFile(path.join(distDir, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  ipcMain.handle('save-project', async (_event, content) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'Bytefall Project', extensions: ['bfp', 'json'] }]
    })
    
    if (canceled || !filePath) return { success: false }

    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true, filePath }
    } catch (error) {
      console.error('Failed to save file:', error)
      return { success: false, error }
    }
  })

  ipcMain.handle('save-image', async (_event, dataUrl) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      filters: [{ name: 'PNG Image', extensions: ['png'] }]
    })
    
    if (canceled || !filePath) return { success: false }

    try {
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "")
      await fs.writeFile(filePath, base64Data, 'base64')
      return { success: true, filePath }
    } catch (error) {
      console.error('Failed to save image:', error)
      return { success: false, error }
    }
  })

  ipcMain.handle('load-project', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Bytefall Project', extensions: ['bfp', 'json'] }],
      properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) return { success: false }

    try {
      const content = await fs.readFile(filePaths[0], 'utf-8')
      return { success: true, content, filePath: filePaths[0] }
    } catch (error) {
      console.error('Failed to load file:', error)
      return { success: false, error: String(error) }
    }
  })
})
