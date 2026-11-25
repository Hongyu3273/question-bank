// IPC 通道名与 window.api 的接口定义。
// 新增接口时三处同步修改:这里的 IPC 和 Api、preload/index.ts、main/ipc/index.ts。

import type { AppInfo, BankSummary, Settings } from './types'

export const IPC = {
  banksList: 'banks:list',
  settingsGetAll: 'settings:getAll',
  settingsSet: 'settings:set',
  appInfo: 'app:info'
} as const

export interface Api {
  banks: {
    list(): Promise<BankSummary[]>
  }
  settings: {
    getAll(): Promise<Settings>
    set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>
  }
  app: {
    info(): Promise<AppInfo>
  }
}
