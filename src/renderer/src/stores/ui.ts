import { create } from 'zustand'

const SIDEBAR_KEY = 'qb.sidebar.collapsed'
const ZOOM_KEY = 'qb.contentZoom'
const COVER_KEY = 'qb.read.cover'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** 题目内容的缩放范围(Ctrl + 滚轮) */
export const ZOOM_MIN = 0.7
export const ZOOM_MAX = 2
export const ZOOM_STEP = 0.1

function readZoom(): number {
  try {
    const v = Number(localStorage.getItem(ZOOM_KEY))
    return v >= ZOOM_MIN && v <= ZOOM_MAX ? v : 1
  } catch {
    return 1
  }
}

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
  /** 看题、单题放大、背题卡片中题目内容的缩放比例 */
  contentZoom: number
  setContentZoom: (zoom: number) => void
  /** 看题模式中遮住答案,点击才显示(用来自测) */
  coverAnswers: boolean
  setCoverAnswers: (cover: boolean) => void
}

/** 界面状态:侧栏折叠、内容缩放(记在本机)、快捷键说明 */
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
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  coverAnswers: readFlag(COVER_KEY),
  setCoverAnswers: (cover) => {
    try {
      localStorage.setItem(COVER_KEY, cover ? '1' : '0')
    } catch {
      // 保存失败不影响使用
    }
    set({ coverAnswers: cover })
  },
  contentZoom: readZoom(),
  setContentZoom: (zoom) => {
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) * 10) / 10
    try {
      localStorage.setItem(ZOOM_KEY, String(next))
    } catch {
      // 保存失败不影响使用
    }
    set({ contentZoom: next })
  }
}))
