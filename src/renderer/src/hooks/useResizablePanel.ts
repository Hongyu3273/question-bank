import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

interface Options {
  /** localStorage 中保存宽度和折叠状态的键前缀 */
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** 拖到小于这个宽度时自动折叠 */
  collapseBelow: number
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 保存失败不影响使用
  }
}

/** 可拖动宽度、可折叠的侧栏。宽度和折叠状态记在本机 */
export function useResizablePanel({ storageKey, defaultWidth, minWidth, maxWidth, collapseBelow }: Options) {
  const widthKey = `${storageKey}.width`
  const collapsedKey = `${storageKey}.collapsed`
  const [width, setWidthState] = useState(() =>
    Math.min(maxWidth, Math.max(minWidth, readNumber(widthKey, defaultWidth)))
  )
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(collapsedKey) === '1'
    } catch {
      return false
    }
  })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  const setWidth = useCallback(
    (w: number) => {
      const clamped = Math.min(maxWidth, Math.max(minWidth, Math.round(w)))
      setWidthState(clamped)
      write(widthKey, String(clamped))
    },
    [maxWidth, minWidth, widthKey]
  )

  const setCollapsed = useCallback(
    (c: boolean) => {
      setCollapsedState(c)
      write(collapsedKey, c ? '1' : '0')
    },
    [collapsedKey]
  )

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startWidth: collapsed ? 0 : width }
    setDragging(true)
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return
    const next = drag.current.startWidth + e.clientX - drag.current.startX
    if (next < collapseBelow) {
      if (!collapsed) setCollapsed(true)
    } else {
      if (collapsed) setCollapsed(false)
      setWidthState(Math.min(maxWidth, Math.max(minWidth, Math.round(next))))
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    drag.current = null
    setDragging(false)
    write(widthKey, String(width))
  }

  /** 键盘:左右方向键调整宽度,回车切换折叠 */
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (collapsed) setCollapsed(false)
      else setWidth(width + (e.key === 'ArrowRight' ? 20 : -20))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      setCollapsed(!collapsed)
    }
  }

  return {
    width,
    collapsed,
    dragging,
    setCollapsed,
    /** 绑定到分隔条元素上的属性 */
    separatorProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-valuemin': minWidth,
      'aria-valuemax': maxWidth,
      'aria-valuenow': collapsed ? 0 : width,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
      onDoubleClick: () => setCollapsed(!collapsed)
    }
  }
}
