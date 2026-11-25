import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import guideEn from '../assets/import-guide.en.md?raw'
import guideZh from '../assets/import-guide.zh-CN.md?raw'
import { CheckIcon, CloseIcon, CopyIcon, InfoIcon } from './icons'
import MarkdownView from './MarkdownView'
import styles from './ImportGuide.module.css'

/** 当前语言的导入格式说明(Markdown 原文,复制的也是这份) */
export function importGuideText(language: string): string {
  return language === 'en' ? guideEn : guideZh
}

/** 写入剪贴板;navigator.clipboard 不可用时退回 execCommand */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // 继续尝试旧方法
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('copy failed')
}

const OPEN_DELAY = 200
const CLOSE_DELAY = 250
const GAP = 8
const MARGIN = 12

interface Position {
  left: number
  top: number
  maxHeight: number
}

/**
 * "格式说明"按钮:鼠标悬停显示导入格式说明卡片,点击则固定显示。
 * 卡片里的文字可以选中复制,也可以用"复制"按钮复制全文(Markdown)。
 */
export default function ImportGuide({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState<Position | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const id = useId()
  const text = importGuideText(i18n.language)

  const clearTimer = () => window.clearTimeout(timer.current)
  const close = useCallback(() => {
    clearTimer()
    setOpen(false)
    setPinned(false)
  }, [])

  // 悬停:延迟打开,离开后延迟关闭,方便把鼠标移进卡片
  const hoverIn = () => {
    clearTimer()
    if (!open) timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY)
  }
  const hoverOut = () => {
    clearTimer()
    if (pinned) return
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  const toggle = () => {
    clearTimer()
    if (open && pinned) close()
    else {
      setOpen(true)
      setPinned(true)
    }
  }

  useEffect(() => () => clearTimer(), [])

  // 位置:按钮下方,靠右时右对齐;下方放不下就放到上方
  useLayoutEffect(() => {
    if (!open) return setPos(null)
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const card = cardRef.current
      if (!trigger || !card) return
      const width = card.offsetWidth
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = trigger.left
      if (left + width > vw - MARGIN) left = Math.max(MARGIN, Math.min(trigger.right - width, vw - width - MARGIN))
      const below = vh - trigger.bottom - GAP - MARGIN
      const above = trigger.top - GAP - MARGIN
      const natural = card.scrollHeight
      if (below >= Math.min(natural, 360) || below >= above) {
        setPos({ left, top: trigger.bottom + GAP, maxHeight: below })
      } else {
        const maxHeight = above
        setPos({ left, top: trigger.top - GAP - Math.min(natural, maxHeight), maxHeight })
      }
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  // 固定显示时:Esc 或点击外部关闭
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        triggerRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (cardRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [open, close])

  useEffect(() => {
    if (!copied) return
    const h = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(h)
  }, [copied])

  const copy = async () => {
    try {
      await copyText(text)
      setCopied(true)
    } catch {
      // 复制失败时文字仍可手动选中复制
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={compact ? styles.triggerCompact : `btn ${styles.trigger}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={toggle}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        <InfoIcon size={16} />
        {t('guide.button')}
      </button>
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={id}
            role="dialog"
            aria-label={t('guide.title')}
            className={styles.card}
            style={
              pos
                ? { left: pos.left, top: pos.top, maxHeight: pos.maxHeight }
                : { left: -9999, top: 0, visibility: 'hidden' }
            }
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
            // 在卡片里点击(选文字、点复制)即固定显示
            onPointerDown={() => setPinned(true)}
          >
            <div className={styles.header}>
              <span className={styles.title}>{t('guide.title')}</span>
              <button
                type="button"
                className={`btn btn-sm ${copied ? styles.copied : ''}`}
                onClick={() => void copy()}
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                {copied ? t('guide.copied') : t('guide.copy')}
              </button>
              <button type="button" className={styles.close} aria-label={t('guide.close')} onClick={close}>
                <CloseIcon size={16} />
              </button>
            </div>
            <div className={styles.body}>
              <MarkdownView markdown={text} bankId="" className={styles.markdown} />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
