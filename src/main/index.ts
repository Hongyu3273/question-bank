import { app, BrowserWindow, dialog, nativeTheme, screen, shell } from 'electron'
import { join } from 'node:path'
import { closeDb, getDb, openDb } from './db/connection'
import { getAllSettings, readInternal, writeInternal } from './db/repositories/settings'
import { registerIpc } from './ipc'

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

let mainWindow: BrowserWindow | null = null

/** 恢复上次的窗口位置;如果显示器变了导致窗口不可见,就使用默认位置 */
function restoreBounds(): Partial<WindowBounds> {
  const saved = readInternal<WindowBounds>(getDb(), 'windowBounds')
  if (!saved) return {}
  const visible = screen.getAllDisplays().some(({ workArea: a }) =>
    saved.x < a.x + a.width && saved.x + saved.width > a.x && saved.y < a.y + a.height && saved.y + saved.height > a.y
  )
  return visible ? saved : { width: saved.width, height: saved.height }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    ...restoreBounds(),
    show: false,
    title: '知识题库',
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#141416' : '#F6F6F4',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow = win

  win.once('ready-to-show', () => win.show())

  win.on('close', () => {
    if (!win.isMaximized() && !win.isMinimized()) writeInternal(getDb(), 'windowBounds', win.getBounds())
  })
  win.on('closed', () => {
    mainWindow = null
  })

  // 外部链接用系统浏览器打开,应用窗口不跳转到任何外部页面
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 只允许运行一个实例,避免两个进程同时写数据库
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(async () => {
    try {
      await openDb()
    } catch (err) {
      dialog.showErrorBox('无法打开数据库', err instanceof Error ? err.message : String(err))
      app.quit()
      return
    }
    nativeTheme.themeSource = getAllSettings(getDb()).theme
    registerIpc()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => closeDb())
}
