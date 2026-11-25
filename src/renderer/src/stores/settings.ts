import { create } from 'zustand'
import type { Settings } from '@shared/types'

interface SettingsState {
  settings: Settings | null
  load: () => Promise<void>
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,

  load: async () => {
    set({ settings: await window.api.settings.getAll() })
  },

  // 先更新界面再写入数据库;写入失败时回滚
  update: async (key, value) => {
    const prev = get().settings
    if (!prev) return
    set({ settings: { ...prev, [key]: value } })
    try {
      await window.api.settings.set(key, value)
    } catch (err) {
      set({ settings: prev })
      throw err
    }
  }
}))
