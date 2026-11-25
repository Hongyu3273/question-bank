import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ReadBank } from '@shared/types'
import { BookIcon, ChevronRightIcon, PanelLeftIcon, SearchIcon } from '../../components/icons'
import MarkdownView from '../../components/MarkdownView'
import { useResizablePanel } from '../../hooks/useResizablePanel'
import { useSearchHighlight } from '../../hooks/useSearchHighlight'
import { errorMessage } from '../../lib/errors'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import styles from './ReadPage.module.css'

const NO_IDS: string[] = []

export default function ReadPage() {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const savedPosition = useSettingsStore((s) => s.settings?.readPosition ?? null)
  const updateSetting = useSettingsStore((s) => s.update)

  const [banks, setBanks] = useState<ReadBank[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const restored = useRef(false)
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
      .then((list) => !cancelled && setBanks(list))
      .catch((err) => toast(errorMessage(err, t), 3000))
    return () => {
      cancelled = true
    }
  }, [selectedIds, toast, t])

  const total = useMemo(() => banks?.reduce((n, b) => n + b.questions.length, 0) ?? 0, [banks])

  // 输入停顿后再搜索
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), 200)
    return () => clearTimeout(timer)
  }, [input])

  const search = useSearchHighlight(listRef, query, banks)

  // 回到上次阅读的位置(只在首次加载时)
  useLayoutEffect(() => {
    if (!banks || restored.current) return
    restored.current = true
    if (!savedPosition) return
    const el = document.getElementById(`q-${savedPosition}`)
    if (el && el !== listRef.current?.querySelector('[data-question]')) {
      el.scrollIntoView({ block: 'start' })
      setActiveId(savedPosition)
      toast(t('read.resumed'))
    }
  }, [banks, savedPosition, toast, t])

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const jumpTo = (id: string) => {
    document.getElementById(`q-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    setActiveId(id)
  }

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
  if (total === 0) {
    return <Empty title={t('read.noQuestionsTitle')} desc={t('read.noQuestionsDesc')} to="/manage" action={t('home.manageBanks')} />
  }

  // ---------- 页面 ----------

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
          <span className={styles.subtitle}>{t('read.summary', { banks: banks.length, count: total })}</span>
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
                  setQuery(input)
                  if (query === input) {
                    if (e.shiftKey) search.prev()
                    else search.next()
                  }
                } else if (e.key === 'Escape') {
                  setInput('')
                  setQuery('')
                }
              }}
            />
          </label>
          {query.trim() && (
            <>
              <span className={styles.matchCount} aria-live="polite">
                {search.count > 0
                  ? t('read.matchPosition', { current: search.current + 1, count: search.count })
                  : t('read.noMatch')}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t('read.prevMatch')}
                title={`${t('read.prevMatch')} (Shift+Enter)`}
                disabled={search.count === 0}
                onClick={search.prev}
              >
                <ChevronRightIcon size={16} />
              </button>
              <button
                type="button"
                className={`${styles.iconButton} ${styles.down}`}
                aria-label={t('read.nextMatch')}
                title={`${t('read.nextMatch')} (Enter)`}
                disabled={search.count === 0}
                onClick={search.next}
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
                      {bank.questions.map((q, i) => (
                        <li key={q.id}>
                          <button
                            type="button"
                            className={q.id === activeId ? `${styles.tocItem} ${styles.tocItemActive}` : styles.tocItem}
                            aria-current={q.id === activeId ? 'true' : undefined}
                            onClick={() => jumpTo(q.id)}
                            title={q.title}
                          >
                            <span className={styles.tocNumber}>{i + 1}</span>
                            <span className={styles.tocTitle}>{q.title}</span>
                          </button>
                        </li>
                      ))}
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
                  <span className={styles.bankHeadingCount}>{t('common.questionCount', { count: bank.questions.length })}</span>
                </h2>
                {bank.questions.map((q, i) => (
                  <article
                    key={q.id}
                    id={`q-${q.id}`}
                    data-question={q.id}
                    className={q.id === activeId ? `${styles.card} ${styles.cardActive}` : styles.card}
                    aria-labelledby={`title-${q.id}`}
                  >
                    <div className={styles.cardNumber} data-search-skip>
                      {t('manage.questionNumber', { number: i + 1 })}
                    </div>
                    <h3 id={`title-${q.id}`} className={styles.cardTitle}>
                      {q.title}
                    </h3>
                    <div className={styles.answer}>
                      {q.answerMd.trim() ? (
                        <MarkdownView markdown={q.answerMd} bankId={q.bankId} />
                      ) : (
                        <p className={styles.noAnswer}>{t('read.noAnswer')}</p>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            ))}
            <p className={styles.end} data-search-skip>
              {t('read.end')}
            </p>
          </div>
        </div>
      </div>
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
