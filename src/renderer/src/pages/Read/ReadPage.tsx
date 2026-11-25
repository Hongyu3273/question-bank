import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Question, ReadBank } from '@shared/types'
import { BookIcon, ChevronRightIcon, ExpandIcon, PanelLeftIcon, SearchIcon } from '../../components/icons'
import MarkdownView from '../../components/MarkdownView'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import { useSearchHighlight } from '../../hooks/useSearchHighlight'
import { errorMessage } from '../../lib/errors'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import FocusView from './FocusView'
import styles from './ReadPage.module.css'

const NO_IDS: string[] = []

/** 答案渲染前占位的估计高度,减少答案渲染出来时页面的跳动 */
const estimateHeight = (q: Question) => Math.min(900, 48 + Math.ceil(q.answerMd.length / 40) * 26)

interface CardProps {
  question: Question
  rendered: boolean
  active: boolean
  matched: boolean
  noAnswer: string
  numberLabel: string
  expandLabel: string
  onExpand: (id: string) => void
}

/** 一道题。答案在接近可视区域时才渲染(题目多时保持流畅) */
const QuestionCard = memo(function QuestionCard({
  question: q,
  rendered,
  active,
  matched,
  noAnswer,
  numberLabel,
  expandLabel,
  onExpand
}: CardProps) {
  const cls = [styles.card, active && styles.cardActive, matched && styles.cardMatched].filter(Boolean).join(' ')
  return (
    <article id={`q-${q.id}`} data-question={q.id} className={cls} aria-labelledby={`title-${q.id}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardNumber} data-search-skip>
          {numberLabel}
        </span>
        <button
          type="button"
          className={styles.expand}
          aria-label={expandLabel}
          title={expandLabel}
          onClick={() => onExpand(q.id)}
        >
          <ExpandIcon size={16} />
        </button>
      </div>
      <h3 id={`title-${q.id}`} className={styles.cardTitle} onClick={() => onExpand(q.id)}>
        {q.title}
      </h3>
      <div className={styles.answer}>
        {!rendered ? (
          <div className={styles.answerPlaceholder} style={{ height: estimateHeight(q) }} aria-hidden="true" />
        ) : q.answerMd.trim() ? (
          <MarkdownView markdown={q.answerMd} bankId={q.bankId} />
        ) : (
          <p className={styles.noAnswer}>{noAnswer}</p>
        )}
      </div>
    </article>
  )
})

export default function ReadPage() {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const savedPosition = useSettingsStore((s) => s.settings?.readPosition ?? null)
  const updateSetting = useSettingsStore((s) => s.update)

  const [banks, setBanks] = useState<ReadBank[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rendered, setRendered] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  /** 放大查看的题目 */
  const [focusId, setFocusId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const restored = useRef(false)
  /** 渲染完成后要滚动到的题目 */
  const pendingScroll = useRef<{ id: string; smooth: boolean } | null>(null)
  const toc = useResizablePanel({
    storageKey: 'qb.read.toc',
    defaultWidth: 260,
    minWidth: 180,
    maxWidth: 480,
    collapseBelow: 120
  })

  // 读取所选题库的全部题目
  useEffect(() => {
    let cancelled = false
    window.api.read
      .list(selectedIds)
      .then((list) => {
        if (cancelled) return
        setBanks(list)
        // 先渲染开头几道题的答案,其余随滚动渲染
        setRendered(new Set(list.flatMap((b) => b.questions).slice(0, 8).map((q) => q.id)))
      })
      .catch((err) => toast(errorMessage(err, t), 3000))
    return () => {
      cancelled = true
    }
  }, [selectedIds, toast, t])

  const all = useMemo(() => banks?.flatMap((b) => b.questions) ?? [], [banks])

  /** 每道题的位置信息:全局序号、所属题库名、题库内题号 */
  const positions = useMemo(() => {
    const map = new Map<string, { index: number; bankName: string; number: number }>()
    let index = 0
    for (const bank of banks ?? []) {
      bank.questions.forEach((q, i) => map.set(q.id, { index: ++index, bankName: bank.name, number: i + 1 }))
    }
    return map
  }, [banks])

  const openFocus = useCallback((id: string) => {
    setFocusId(id)
    setActiveId(id)
  }, [])

  /** 放大视图中切换题目;同时更新阅读位置 */
  const stepFocus = (delta: number) => {
    if (!focusId) return
    const i = (positions.get(focusId)?.index ?? 1) - 1 + delta
    const next = all[i]
    if (next) {
      setFocusId(next.id)
      setActiveId(next.id)
    }
  }

  /** 关闭放大视图,列表停在最后查看的题目 */
  const closeFocus = () => {
    if (focusId) goTo(focusId, false)
    setFocusId(null)
  }

  // 输入停顿后再搜索
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 200)
    return () => clearTimeout(timer)
  }, [input])

  /** 在题目数据中搜索(不依赖答案是否已渲染),结果按题目顺序 */
  const matches = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return []
    return all.filter((x) => x.title.toLowerCase().includes(q) || x.answerMd.toLowerCase().includes(q)).map((x) => x.id)
  }, [all, query])
  const matchSet = useMemo(() => new Set(matches), [matches])

  /** 跳到某道题:先确保答案已渲染,渲染完成后再滚动 */
  const goTo = useCallback((id: string, smooth = true) => {
    pendingScroll.current = { id, smooth }
    setRendered((prev) => new Set(prev).add(id))
    setActiveId(id)
  }, [])

  useLayoutEffect(() => {
    const target = pendingScroll.current
    if (!target) return
    pendingScroll.current = null
    document
      .getElementById(`q-${target.id}`)
      ?.scrollIntoView({ block: 'start', behavior: target.smooth ? 'smooth' : 'auto' })
  }, [rendered])

  // 搜索词变化时跳到第一个匹配的题目
  useEffect(() => {
    setMatchIndex(0)
    if (matches.length > 0) goTo(matches[0])
  }, [matches, goTo])

  const stepMatch = (delta: number) => {
    if (matches.length === 0) return
    const i = (matchIndex + delta + matches.length) % matches.length
    setMatchIndex(i)
    goTo(matches[i])
  }

  useSearchHighlight(listRef, query, rendered)

  // 回到上次阅读的位置(只在首次加载时)
  useEffect(() => {
    if (!banks || restored.current) return
    restored.current = true
    if (!savedPosition || all[0]?.id === savedPosition || !all.some((q) => q.id === savedPosition)) return
    goTo(savedPosition, false)
    toast(t('read.resumed'))
  }, [banks, all, savedPosition, goTo, toast, t])

  // 接近可视区域的题目渲染答案
  useEffect(() => {
    const root = listRef.current
    if (!root || !banks) return
    const observer = new IntersectionObserver(
      (entries) => {
        const ids = entries.filter((e) => e.isIntersecting).map((e) => (e.target as HTMLElement).dataset.question!)
        if (ids.length === 0) return
        setRendered((prev) => {
          if (ids.every((id) => prev.has(id))) return prev
          const next = new Set(prev)
          ids.forEach((id) => next.add(id))
          return next
        })
      },
      { root, rootMargin: '1200px 0px' }
    )
    root.querySelectorAll('[data-question]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [banks])

  // 跟踪当前阅读的题目:视口上部的题目视为"正在读"
  useEffect(() => {
    const root = listRef.current
    if (!root || !banks) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.question!
          if (e.isIntersecting) visible.set(id, e.boundingClientRect.top)
          else visible.delete(id)
        }
        let best: string | null = null
        let bestTop = Infinity
        for (const [id, top] of visible) {
          if (top < bestTop) {
            best = id
            bestTop = top
          }
        }
        if (best) setActiveId(best)
      },
      { root, rootMargin: '0px 0px -65% 0px' }
    )
    root.querySelectorAll('[data-question]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [banks])

  // 保存阅读位置(停顿后再写入)
  useEffect(() => {
    if (!activeId || activeId === savedPosition) return
    const timer = setTimeout(() => void updateSetting('readPosition', activeId), 800)
    return () => clearTimeout(timer)
  }, [activeId, savedPosition, updateSetting])

  // 目录跟随当前题目
  useEffect(() => {
    tocRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeId, toc.collapsed])

  // Ctrl+F 聚焦搜索框
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focusId) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusId])

  const toggleBank = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // ---------- 空状态 ----------

  if (selectedIds.length === 0 || (banks && banks.length === 0)) {
    return (
      <Empty title={t('read.noSelectionTitle')} desc={t('read.noSelectionDesc')} to="/" action={t('read.goSelect')} />
    )
  }
  if (!banks) return null
  if (all.length === 0) {
    return (
      <Empty title={t('read.noQuestionsTitle')} desc={t('read.noQuestionsDesc')} to="/manage" action={t('home.manageBanks')} />
    )
  }

  // ---------- 页面 ----------

  const currentMatch = matches[matchIndex] ?? null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={toc.collapsed ? styles.iconButtonPlain : `${styles.iconButtonPlain} ${styles.iconButtonOn}`}
          aria-label={toc.collapsed ? t('read.showToc') : t('read.hideToc')}
          aria-pressed={!toc.collapsed}
          title={toc.collapsed ? t('read.showToc') : t('read.hideToc')}
          onClick={() => toc.setCollapsed(!toc.collapsed)}
        >
          <PanelLeftIcon size={18} />
        </button>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t('nav.read')}</h1>
          <span className={styles.subtitle}>{t('read.summary', { banks: banks.length, count: all.length })}</span>
        </div>

        <div className={styles.searchBox}>
          <label className={styles.search}>
            <SearchIcon size={15} />
            <span className="sr-only">{t('read.search')}</span>
            <input
              ref={searchRef}
              type="search"
              value={input}
              placeholder={t('read.searchPlaceholder')}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (input.trim() !== query) setQuery(input.trim())
                  else stepMatch(e.shiftKey ? -1 : 1)
                } else if (e.key === 'Escape') {
                  setInput('')
                  setQuery('')
                }
              }}
            />
          </label>
          {query && (
            <>
              <span className={styles.matchCount} aria-live="polite">
                {matches.length > 0
                  ? t('read.matchPosition', { current: matchIndex + 1, count: matches.length })
                  : t('read.noMatch')}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t('read.prevMatch')}
                title={`${t('read.prevMatch')} (Shift+Enter)`}
                disabled={matches.length === 0}
                onClick={() => stepMatch(-1)}
              >
                <ChevronRightIcon size={16} />
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.down}`}
                aria-label={t('read.nextMatch')}
                title={`${t('read.nextMatch')} (Enter)`}
                disabled={matches.length === 0}
                onClick={() => stepMatch(1)}
              >
                <ChevronRightIcon size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      <div className={toc.dragging ? `${styles.body} ${styles.resizing}` : styles.body}>
        {!toc.collapsed && (
          <nav ref={tocRef} className={styles.toc} style={{ width: toc.width }} aria-label={t('read.toc')}>
            <div className={styles.tocHeader}>
              <span className={styles.tocLabel}>{t('read.toc')}</span>
              <button
                type="button"
                className={styles.iconButtonPlain}
                aria-label={t('read.hideToc')}
                title={t('read.hideToc')}
                onClick={() => toc.setCollapsed(true)}
              >
                <ChevronRightIcon size={16} />
              </button>
            </div>
            {banks.map((bank) => {
              const isCollapsed = collapsed.has(bank.id)
              return (
                <div key={bank.id} className={styles.tocBank}>
                  <button
                    type="button"
                    className={styles.tocBankButton}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleBank(bank.id)}
                  >
                    <span className={isCollapsed ? styles.chevron : `${styles.chevron} ${styles.chevronOpen}`}>
                      <ChevronRightIcon size={14} />
                    </span>
                    <span className={styles.tocBankName}>{bank.name}</span>
                    <span className={styles.tocCount}>{bank.questions.length}</span>
                  </button>
                  {!isCollapsed && (
                    <ol className={styles.tocList}>
                      {bank.questions.map((q, i) => {
                        const cls = [
                          styles.tocItem,
                          q.id === activeId && styles.tocItemActive,
                          query && !matchSet.has(q.id) && styles.tocItemDim
                        ]
                        return (
                          <li key={q.id}>
                            <button
                              type="button"
                              className={cls.filter(Boolean).join(' ')}
                              aria-current={q.id === activeId ? 'true' : undefined}
                              onClick={() => goTo(q.id)}
                              title={q.title}
                            >
                              <span className={styles.tocNumber}>{i + 1}</span>
                              <span className={styles.tocTitle}>{q.title}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              )
            })}
          </nav>
        )}

        <div
          className={toc.collapsed ? `${styles.resizer} ${styles.resizerCollapsed}` : styles.resizer}
          aria-label={t('read.resizeToc')}
          title={t('read.resizeTocHint')}
          {...toc.separatorProps}
        />

        <div ref={listRef} className={styles.list}>
          <div className={styles.listInner}>
            {banks.map((bank) => (
              <section key={bank.id} className={styles.bankSection} aria-labelledby={`bank-${bank.id}`}>
                <h2 id={`bank-${bank.id}`} className={styles.bankHeading} data-search-skip>
                  {bank.name}
                  <span className={styles.bankHeadingCount}>
                    {t('common.questionCount', { count: bank.questions.length })}
                  </span>
                </h2>
                {bank.questions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    numberLabel={t('manage.questionNumber', { number: i + 1 })}
                    rendered={rendered.has(q.id)}
                    active={q.id === activeId}
                    matched={q.id === currentMatch}
                    noAnswer={t('read.noAnswer')}
                    expandLabel={t('read.expand')}
                    onExpand={openFocus}
                  />
                ))}
              </section>
            ))}
            <p className={styles.end} data-search-skip>
              {t('read.end')}
            </p>
          </div>
        </div>
      </div>

      {focusId && positions.has(focusId) && (
        <FocusView
          question={all[positions.get(focusId)!.index - 1]}
          bankName={positions.get(focusId)!.bankName}
          number={positions.get(focusId)!.number}
          index={positions.get(focusId)!.index}
          total={all.length}
          query={query}
          onPrev={() => stepFocus(-1)}
          onNext={() => stepFocus(1)}
          onClose={closeFocus}
        />
      )}
    </div>
  )
}

function Empty({ title, desc, to, action }: { title: string; desc: string; to: string; action: string }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>
        <BookIcon size={28} />
      </div>
      <div className={styles.emptyTitle}>{title}</div>
      <p className={styles.emptyDesc}>{desc}</p>
      <Link to={to} className="btn btn-primary">
        {action}
      </Link>
    </div>
  )
}
