import { app, BrowserWindow, dialog, ipcMain, nativeTheme, screen, shell } from 'electron'
import { join } from 'node:path'
import { closeDb, getDb, openDb } from './db/connection'
import { getAllSettings, readInternal, writeInternal } from './db/repositories/settings'
import { registerIpc } from './ipc'
import { autoBackupDir, registerIoIpc } from './ipc/io'
import { handleAssetProtocol, registerAssetScheme } from './protocol'
import { AppError } from '../shared/errors'
import { AssetStore } from './services/assets'
import { runDailyBackup } from './services/autoBackup'
import { createBackup } from './services/backup'
import { initLogger, log } from './services/logger'
import { initUpdater } from './services/updater'

/** 所有 IPC 调用出错时写日志:预期内的错误(AppError)记为警告,其余记为错误 */
function logIpcErrors(): void {
  const handle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel, listener) =>
    handle(channel, async (...args) => {
      try {
        return await listener(...args)
      } catch (err) {
        if (err instanceof AppError) log('warn', `ipc ${channel}`, err.message)
        else log('error', `ipc ${channel}`, err)
        throw err
      }
    })
}

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

registerAssetScheme()

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
    initLogger(join(app.getPath('userData'), 'logs'))
    log('info', `start v${app.getVersion()} ${process.platform} ${process.arch}`)
    process.on('uncaughtException', (err) => log('error', 'uncaughtException', err))
    process.on('unhandledRejection', (err) => log('error', 'unhandledRejection', err))
    try {
      await openDb()
    } catch (err) {
      log('error', 'failed to open database', err)
      dialog.showErrorBox('无法打开数据库', err instanceof Error ? err.message : String(err))
      app.quit()
      return
    }
    nativeTheme.themeSource = getAllSettings(getDb()).theme
    const assetsRoot = join(app.getPath('userData'), 'assets')
    const assets = new AssetStore(assetsRoot)
    handleAssetProtocol(assets)
    logIpcErrors()
    registerIpc(assets)
    registerIoIpc(assets, assetsRoot)
    createWindow()

    // 每日自动备份:启动后稍等再做,不拖慢打开速度;之后每小时检查一次是否换了一天
    const backupNow = () => {
      try {
        const created = runDailyBackup(autoBackupDir(), () => createBackup(getDb(), assets, app.getVersion()))
        if (created) log('info', `auto backup ${created}`)
      } catch (err) {
        log('error', 'auto backup failed', err)
      }
    }
    setTimeout(backupNow, 5000)
    setInterval(backupNow, 60 * 60 * 1000)

    initUpdater(() => getAllSettings(getDb()).language)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('render-process-gone', (_e, _w, details) => log('error', 'render process gone', details))

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => closeDb())
}
