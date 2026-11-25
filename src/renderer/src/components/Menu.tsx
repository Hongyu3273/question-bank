import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Menu.module.css'

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onSelect: () => void
}

export interface MenuAnchor {
  x: number
  y: number
}

interface Props {
  /** 菜单左上角位置(视口坐标);null 时关闭 */
  anchor: MenuAnchor | null
  items: MenuItem[]
  onClose: () => void
  label: string
}

/** 弹出菜单:用于"⋯"按钮和右键菜单。方向键切换、回车选择、Esc 或点击外部关闭 */
export default function Menu({ anchor, items, onClose, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<MenuAnchor | null>(anchor)

  // 菜单超出窗口时往回收
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return setPos(anchor)
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      x: Math.min(anchor.x, window.innerWidth - width - 8),
      y: anchor.y + height > window.innerHeight - 8 ? Math.max(8, anchor.y - height) : anchor.y
    })
  }, [anchor])

  useEffect(() => {
    if (!anchor) return
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onScroll = () => onClose()
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('blur', onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('blur', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [anchor, onClose])

  if (!anchor) return null

  const move = (delta: number) => {
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    buttons[(i + delta + buttons.length) % buttons.length]?.focus()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={styles.menu}
      style={{ left: (pos ?? anchor).x, top: (pos ?? anchor).y }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        } else if (e.key === 'Escape' || e.key === 'Tab') {
          e.preventDefault()
          onClose()
        }
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? `${styles.item} ${styles.danger}` : styles.item}
          onClick={() => {
            onClose()
            item.onSelect()
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

/** 根据按钮位置计算菜单位置(按钮下方,右对齐) */
export function anchorBelow(el: HTMLElement, menuWidth = 180): MenuAnchor {
  const r = el.getBoundingClientRect()
  return { x: Math.max(8, r.right - menuWidth), y: r.bottom + 4 }
}
