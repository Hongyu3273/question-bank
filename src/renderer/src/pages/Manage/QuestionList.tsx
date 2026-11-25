import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuestionSummary } from '@shared/types'
import { PlusIcon, SearchIcon } from '../../components/icons'
import { stepId, useDragReorder } from '../../hooks/useDragReorder'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import styles from './ManagePage.module.css'

interface Props {
  questions: QuestionSummary[]
  /** 当前编辑的题目 id;'new' 表示正在新增 */
  selectedId: string | 'new' | null
  /** 当前题目有未保存的修改 */
  dirty: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onReorder: (ids: string[]) => void
}

/** 中间题目列表:搜索、两行摘要(题干 + 答案开头)、方向键切换 */
const PRIORITY_DOT: Record<string, string> = {
  高: styles.dotHigh,
  中: styles.dotMedium,
  低: styles.dotLow
}

export default function QuestionList({ questions, selectedId, dirty, onSelect, onNew, onReorder }: Props) {
  const { t } = useTranslation()
  const priorityLabel = usePriorityLabel()
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLOListElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return questions
    return questions.filter((x) => x.title.toLowerCase().includes(q) || x.snippet.toLowerCase().includes(q))
  }, [questions, query])

  // 选中项保持在可见范围内;用方向键切换时焦点跟随
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')
    el?.scrollIntoView({ block: 'nearest' })
    if (el && listRef.current?.contains(document.activeElement)) el.focus()
  }, [selectedId])

  const moveSelection = (delta: number) => {
    if (filtered.length === 0) return
    const i = filtered.findIndex((q) => q.id === selectedId)
    const next = filtered[Math.min(filtered.length - 1, Math.max(0, i === -1 ? 0 : i + delta))]
    if (next && next.id !== selectedId) onSelect(next.id)
  }

  const numberOf = (id: string) => questions.findIndex((q) => q.id === id) + 1

  // 拖动排序;搜索过滤时不能拖动
  const ids = questions.map((q) => q.id)
  const searching = query.trim() !== ''
  const drag = useDragReorder(ids, onReorder, !searching)

  return (
    <section className={styles.questionColumn} aria-label={t('manage.questions')}>
      <div className={styles.questionToolbar}>
        <label className={styles.search}>
          <SearchIcon size={15} />
          <span className="sr-only">{t('manage.searchQuestions')}</span>
          <input
            type="search"
            value={query}
            placeholder={t('manage.searchQuestions')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                listRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
              }
            }}
          />
        </label>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.iconButtonAccent}`}
          aria-label={t('manage.newQuestion')}
          title={`${t('manage.newQuestion')}`}
          onClick={onNew}
        >
          <PlusIcon size={18} />
        </button>
      </div>

      <ol
        ref={listRef}
        className={styles.questionList}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          if (e.altKey) {
            // Alt + ↑ / ↓ 移动当前题目
            if (searching || !selectedId || selectedId === 'new') return
            const next = stepId(ids, selectedId, e.key === 'ArrowUp' ? -1 : 1)
            if (next !== ids) onReorder(next)
          } else {
            moveSelection(e.key === 'ArrowDown' ? 1 : -1)
          }
        }}
      >
        {selectedId === 'new' && (
          <li>
            <div className={`${styles.questionRow} ${styles.questionRowSelected}`} aria-current="true">
              <span className={styles.questionMain}>
                <span className={styles.questionTitle}>{t('manage.untitled')}</span>
                <span className={styles.questionSnippet}>{t('manage.newQuestionHint')}</span>
              </span>
              <span className={styles.dirtyDot} aria-label={t('manage.unsavedShort')} />
            </div>
          </li>
        )}
        {filtered.map((q) => {
          const selected = q.id === selectedId
          const mark = drag.indicator(q.id)
          const liCls = [
            mark === 'dragging' && styles.dragging,
            mark === 'before' && styles.dropBefore,
            mark === 'after' && styles.dropAfter
          ]
          return (
            <li key={q.id} className={liCls.filter(Boolean).join(' ') || undefined} {...drag.rowProps(q.id)}>
              <button
                type="button"
                className={selected ? `${styles.questionRow} ${styles.questionRowSelected}` : styles.questionRow}
                aria-current={selected ? 'true' : undefined}
                tabIndex={selected || (!selectedId && q === filtered[0]) ? 0 : -1}
                onClick={() => onSelect(q.id)}
              >
                <span className={styles.questionNumber}>{numberOf(q.id)}</span>
                <span
                  className={`${styles.priorityDot} ${q.priority ? (PRIORITY_DOT[q.priority] ?? styles.dotOther) : styles.dotNone}`}
                  title={q.priority ? priorityLabel(q.priority) : t('meta.none')}
                  aria-label={q.priority ? priorityLabel(q.priority) : t('meta.none')}
                />
                <span className={styles.questionMain}>
                  <span className={styles.questionTitle}>{q.title}</span>
                  <span className={styles.questionSnippet}>{q.snippet || t('manage.noAnswer')}</span>
                </span>
                {selected && dirty && <span className={styles.dirtyDot} aria-label={t('manage.unsavedShort')} />}
              </button>
            </li>
          )
        })}
      </ol>

      {questions.length === 0 && selectedId !== 'new' && (
        <div className={styles.columnEmpty}>
          <p>{t('manage.noQuestions')}</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={onNew}>
            <PlusIcon size={14} />
            {t('manage.newQuestion')}
          </button>
        </div>
      )}
      {questions.length > 0 && filtered.length === 0 && (
        <p className={styles.columnEmpty}>{t('manage.noMatches')}</p>
      )}

      <div className={styles.questionFooter}>
        {query.trim()
          ? t('manage.matchCount', { count: filtered.length, total: questions.length })
          : t('manage.questionsCount', { count: questions.length })}
      </div>
    </section>
  )
}
