// 主进程与界面共用的数据类型

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 's' | 'm' | 'l'
export type Language = 'zh-CN' | 'en'

/** 用户可修改的设置项 */
export interface Settings {
  theme: ThemeMode
  fontSize: FontSize
  language: Language
  /** 首页勾选的题库 id */
  selectedBankIds: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 'm',
  language: 'zh-CN',
  selectedBankIds: []
}

export interface BankSummary {
  id: string
  name: string
  questionCount: number
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface AppInfo {
  version: string
  platform: string
}
