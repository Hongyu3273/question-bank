import { create } from 'zustand'

const SIDEBAR_KEY = 'qb.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

interface UiState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
}

/** 界面状态:侧栏折叠(记在本机)、快捷键说明 */
export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: readCollapsed(),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
    } catch {
      // 保存失败不影响使用
    }
    set({ sidebarCollapsed: next })
  },
  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open })
}))
