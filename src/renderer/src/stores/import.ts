import { create } from 'zustand'
import type { ImportResult } from '@shared/types'

type Choice = 'overwrite' | 'saveAsNew' | 'skip'

interface ImportState {
  open: boolean
  running: boolean
  results: ImportResult[]
  /** 每次有题库被导入或覆盖时加 1,页面据此刷新题库列表 */
  version: number
  /** 选择文件并导入;返回 false 表示用户取消 */
  start: () => Promise<boolean>
  resolve: (token: string, choice: Choice) => Promise<void>
  resolveAll: (choice: Choice) => Promise<void>
  close: () => void
}

const changed = (r: ImportResult) => r.status === 'imported'

export const useImportStore = create<ImportState>((set, get) => ({
  open: false,
  running: false,
  results: [],
  version: 0,

  start: async () => {
    if (get().running) return false
    set({ running: true })
    try {
      const res = await window.api.io.import()
      if (res.canceled) return false
      set((s) => ({
        open: true,
        results: res.results,
        version: res.results.some(changed) ? s.version + 1 : s.version
      }))
      return true
    } finally {
      set({ running: false })
    }
  },

  resolve: async (token, choice) => {
    const result = await window.api.io.resolveConflict(token, choice)
    set((s) => ({
      results: s.results.map((r) => (r.status === 'conflict' && r.token === token ? result : r)),
      version: changed(result) ? s.version + 1 : s.version
    }))
  },

  resolveAll: async (choice) => {
    for (const r of get().results) {
      if (r.status === 'conflict') await get().resolve(r.token, choice)
    }
  },

  close: () => set({ open: false, results: [] })
}))
