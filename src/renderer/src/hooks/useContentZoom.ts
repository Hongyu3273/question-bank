import { useEffect, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useToastStore } from '../stores/toast'
import { useUiStore, ZOOM_STEP } from '../stores/ui'

/** 可以用 Ctrl + 滚轮缩放的区域加上这个属性 */
export const ZOOM_AREA = { 'data-content-zoom': '' } as const

/**
 * 全局监听 Ctrl + 滚轮(Mac 上是 ⌘ + 滚轮):鼠标在可缩放区域内时缩放题目内容,
 * 而不是让整个窗口缩放。在 App 中调用一次。
 */
export function useCtrlWheelZoom(): void {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (!(e.target instanceof Element) || !e.target.closest('[data-content-zoom]')) return
      e.preventDefault()
      if (e.deltaY === 0) return
      const { contentZoom, setContentZoom } = useUiStore.getState()
      setContentZoom(contentZoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
      const next = useUiStore.getState().contentZoom
      if (next !== contentZoom) toast(t('zoom.level', { percent: Math.round(next * 100) }), 1200)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [t, toast])
}

/** 被缩放的内容使用的样式;--content-zoom 用来让最大宽度保持不变 */
export function useContentZoomStyle(): CSSProperties {
  const zoom = useUiStore((s) => s.contentZoom)
  return { zoom, ['--content-zoom' as string]: zoom }
}
