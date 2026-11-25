// 自动更新:从 GitHub Releases 检查新版本。
// - Windows:后台下载,下载完成后询问是否重启安装
// - macOS:没有开发者签名,无法自动安装,只提示并打开下载页面

import { app, BrowserWindow, dialog, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheck } from '../../shared/types'
import { log } from './logger'

const RELEASES_URL = 'https://github.com/Hongyu3273/question-bank/releases/latest'
const canAutoInstall = process.platform === 'win32'

type Lang = () => 'zh-CN' | 'en'
let language: Lang = () => 'zh-CN'
/** 已经提示过的版本,避免重复弹窗 */
let notified: string | null = null

const text = {
  'zh-CN': {
    downloadedTitle: '新版本已准备好',
    downloaded: (v: string) => `知识题库 ${v} 已下载完成,重启后即可使用新版本。`,
    restart: '立即重启',
    later: '稍后',
    availableTitle: '发现新版本',
    available: (v: string) => `知识题库 ${v} 已发布。macOS 版需要手动下载安装,数据不会丢失。`,
    download: '前往下载'
  },
  en: {
    downloadedTitle: 'Update ready',
    downloaded: (v: string) => `Question Bank ${v} has been downloaded. Restart to start using it.`,
    restart: 'Restart now',
    later: 'Later',
    availableTitle: 'Update available',
    available: (v: string) => `Question Bank ${v} is available. On macOS, download and install it manually; your data is kept.`,
    download: 'Download'
  }
}

function parent(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

export function initUpdater(getLanguage: Lang): void {
  language = getLanguage
  autoUpdater.autoDownload = canAutoInstall
  autoUpdater.autoInstallOnAppQuit = canAutoInstall
  autoUpdater.logger = {
    info: (m: unknown) => log('info', `[updater] ${String(m)}`),
    warn: (m: unknown) => log('warn', `[updater] ${String(m)}`),
    error: (m: unknown) => log('error', `[updater] ${String(m)}`),
    debug: () => undefined
  }

  autoUpdater.on('update-available', (info) => {
    if (canAutoInstall || notified === info.version) return
    notified = info.version
    const t = text[language()]
    void dialog
      .showMessageBox(parent()!, {
        type: 'info',
        title: t.availableTitle,
        message: t.availableTitle,
        detail: t.available(info.version),
        buttons: [t.download, t.later],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) void shell.openExternal(RELEASES_URL)
      })
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (notified === info.version) return
    notified = info.version
    const t = text[language()]
    void dialog
      .showMessageBox(parent()!, {
        type: 'info',
        title: t.downloadedTitle,
        message: t.downloadedTitle,
        detail: t.downloaded(info.version),
        buttons: [t.restart, t.later],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        // 选"稍后"时,退出软件时会自动安装
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => log('warn', '[updater] error', err))

  // 打开软件后稍等再检查,不影响启动速度
  if (app.isPackaged) setTimeout(() => void checkForUpdates(), 10_000)
}

/** 检查更新;开发模式下不检查 */
export async function checkForUpdates(): Promise<UpdateCheck> {
  if (!app.isPackaged) return { status: 'dev' }
  try {
    const result = await autoUpdater.checkForUpdates()
    const latest = result?.updateInfo.version
    if (!latest || latest === app.getVersion() || !result?.isUpdateAvailable) {
      return { status: 'latest', version: app.getVersion() }
    }
    return { status: 'available', version: latest, autoInstall: canAutoInstall }
  } catch (err) {
    log('warn', '[updater] check failed', err)
    return { status: 'error' }
  }
}
