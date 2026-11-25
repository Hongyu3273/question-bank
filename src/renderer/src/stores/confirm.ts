import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 确认按钮显示为危险操作(红色) */
  danger?: boolean
}

interface ConfirmState {
  request: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  ask: (options: ConfirmOptions) => Promise<boolean>
  settle: (ok: boolean) => void
}

/** 全局确认弹窗:const ok = await useConfirmStore.getState().ask({ ... }) */
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  ask: (options) =>
    new Promise<boolean>((resolve) => {
      get().request?.resolve(false)
      set({ request: { ...options, resolve } })
    }),
  settle: (ok) => {
    get().request?.resolve(ok)
    set({ request: null })
  }
}))

export const confirmDialog = (options: ConfirmOptions) => useConfirmStore.getState().ask(options)
