import { app, ipcMain, nativeTheme } from 'electron'
import { IPC } from '../../shared/ipc'
import type { AppInfo } from '../../shared/types'
import { getDb } from '../db/connection'
import { listBanks } from '../db/repositories/banks'
import { getAllSettings, isSettingKey, isValidSettingValue, setSetting } from '../db/repositories/settings'

export function registerIpc(): void {
  ipcMain.handle(IPC.banksList, () => listBanks(getDb()))

  ipcMain.handle(IPC.settingsGetAll, () => getAllSettings(getDb()))

  ipcMain.handle(IPC.settingsSet, (_event, key: unknown, value: unknown) => {
    if (!isSettingKey(key) || !isValidSettingValue(key, value)) {
      throw new Error(`无效的设置:${String(key)}`)
    }
    setSetting(getDb(), key, value)
    // 主题同步给系统层,窗口标题栏和 prefers-color-scheme 会随之变化
    if (key === 'theme') nativeTheme.themeSource = value as typeof nativeTheme.themeSource
  })

  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform
  }))
}
