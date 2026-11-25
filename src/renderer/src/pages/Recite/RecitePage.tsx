import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { extractMeta } from '@shared/meta'
import type { ReciteState } from '@shared/types'
import { ArrowLeftIcon, EyeIcon, ShuffleIcon } from '../../components/icons'
import MarkdownView from '../../components/MarkdownView'
import MetaTags from '../../components/MetaTags'
import PageHeader from '../../components/PageHeader'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import { errorMessage } from '../../lib/errors'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import styles from './RecitePage.module.css'

const NO_IDS: string[] = []

/** 焦点在输入框或有弹窗打开时,不响应快捷键 */
function shortcutsBlocked(): boolean {
  const el = document.activeElement
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable) {
    return true
  }
  return document.querySelector('dialog[open]') !== null
}

export default function RecitePage() {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const priorityFilter = useSettingsStore((s) => s.settings?.priorityFilter ?? NO_IDS)
  const showEnglish = useSettingsStore((s) => s.settings?.showEnglish ?? true)
  const priorityLabel = usePriorityLabel()

  // undefined:加载中;null:没有可背的题目
  const [state, setState] = useState<ReciteState | null | undefined>(undefined)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const fail = useCallback((err: unknown) => toast(errorMessage(err, t), 3000), [toast, t])

  /** 切换到新状态:答案恢复隐藏,滚动回顶部 */
  const apply = useCallback(
    (next: ReciteState | null) => {
      setState(next)
      setRevealed(false)
      cardRef.current?.scrollTo({ top: 0 })
      if (next?.roundCompleted) toast(t('recite.roundCompleted', { round: next.round - 1 }), 2600)
    },
    [toast, t]
  )

  useEffect(() => {
    if (selectedIds.length === 0) {
      setState(null)
      return
    }
    let cancelled = false
    window.api.recite
      .start(selectedIds, priorityFilter)
      .then((s) => !cancelled && apply(s))
      .catch(fail)
    return () => {
      cancelled = true
    }
  }, [selectedIds, priorityFilter, apply, fail])

  const run = useCallback(
    async (action: () => Promise<ReciteState | null>) => {
      if (busy) return
      setBusy(true)
      try {
        apply(await action())
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [busy, apply, fail]
  )

  const next = useCallback(() => void run(() => window.api.recite.next()), [run])
  const prev = useCallback(() => void run(() => window.api.recite.prev()), [run])
  const reshuffle = () =>
    void run(async () => {
      const s = await window.api.recite.reshuffle()
      toast(t('recite.reshuffled'))
      return s
    })

  // 快捷键:空格显示/隐藏答案,← → 切换题目
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || e.ctrlKey || e.metaKey || e.altKey || shortcutsBlocked()) return
      if (e.key === ' ') {
        e.preventDefault()
        setRevealed((r) => !r)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' && state.index > 1) {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, next, prev])

  const parsed = useMemo(() => (state ? extractMeta(state.question.answerMd) : null), [state])

  // ---------- 空状态 ----------

  if (state === undefined) return null
  if (state === null) {
    const noSelection = selectedIds.length === 0
    const filtered = priorityFilter.length > 0
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <ShuffleIcon size={28} />
        </div>
        <div className={styles.emptyTitle}>
          {noSelection ? t('read.noSelectionTitle') : filtered ? t('read.noFilteredTitle') : t('read.noQuestionsTitle')}
        </div>
        <p className={styles.emptyDesc}>
          {noSelection ? t('recite.noSelectionDesc') : filtered ? t('read.noFilteredDesc') : t('read.noQuestionsDesc')}
        </p>
        <Link to={noSelection || filtered ? '/' : '/manage'} className="btn btn-primary">
          {noSelection || filtered ? t('read.goSelect') : t('home.manageBanks')}
        </Link>
      </div>
    )
  }

  // ---------- 页面 ----------

  const { question, index, total, round, bankName } = state
  const percent = Math.round((index / total) * 100)

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('nav.recite')}
        subtitle={
          priorityFilter.length > 0
            ? t('recite.filtered', { priorities: priorityFilter.map(priorityLabel).join('、') })
            : undefined
        }
        actions={
          <>
            <Link to="/" className={styles.changeBanks}>
              {t('recite.changeBanks')}
            </Link>
            <div className={styles.progress}>
              <span className={styles.progressLabel}>{t('recite.roundLabel', { round })}</span>
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-label={t('recite.progress')}
                aria-valuemin={1}
                aria-valuemax={total}
                aria-valuenow={index}
              >
                <div className={styles.progressFill} style={{ width: `${percent}%` }} />
              </div>
              <span className={styles.progressCount}>
                {index} / {total}
              </span>
            </div>
            <button type="button" className="btn" onClick={reshuffle} disabled={busy}>
              <ShuffleIcon size={15} />
              {t('recite.reshuffle')}
            </button>
          </>
        }
      />

      <div className={styles.stage}>
        <article ref={cardRef} className={styles.card} aria-labelledby="recite-question">
          <div className={styles.cardMeta}>
            <span className={styles.bankTag}>{bankName}</span>
            <span>{t('recite.questionIndex', { index })}</span>
            {parsed && <MetaTags meta={parsed.meta} priorityLabel={priorityLabel} />}
          </div>
          <h2 id="recite-question" className={styles.question}>
            {question.title}
          </h2>
          {showEnglish && parsed?.meta.english && <p className={styles.english}>{parsed.meta.english}</p>}
          <div className={styles.divider} />

          {revealed ? (
            <div className={styles.answer}>
              <div className={styles.answerHeader}>
                <span className={styles.answerLabel}>{t('recite.answer')}</span>
                <button type="button" className="btn btn-sm" onClick={() => setRevealed(false)}>
                  {t('recite.hideAnswer')}
                  <kbd className={styles.kbd}>{t('recite.space')}</kbd>
                </button>
              </div>
              {parsed?.body.trim() ? (
                <MarkdownView markdown={parsed.body} bankId={question.bankId} />
              ) : (
                <p className={styles.noAnswer}>{t('read.noAnswer')}</p>
              )}
            </div>
          ) : (
            // 整个区域都可以点击:点任意位置显示答案
            <button type="button" className={styles.hidden} onClick={() => setRevealed(true)}>
              <span className={styles.hiddenIcon} aria-hidden="true">
                <EyeIcon size={26} />
              </span>
              <span className={styles.hiddenText}>{t('recite.thinkFirst')}</span>
              <span className={styles.hiddenHint}>
                {t('recite.clickToReveal')}
                <kbd className={styles.kbd}>{t('recite.space')}</kbd>
              </span>
            </button>
          )}
        </article>
      </div>

      <footer className={styles.footer}>
        <button type="button" className="btn" onClick={prev} disabled={busy || index <= 1}>
          <ArrowLeftIcon size={16} />
          {t('recite.prev')}
        </button>
        <button type="button" className="btn btn-primary" onClick={next} disabled={busy}>
          {index >= total ? t('recite.finishRound') : t('recite.next')}
          <span className={styles.arrowRight}>
            <ArrowLeftIcon size={16} />
          </span>
        </button>
      </footer>
    </div>
  )
}
