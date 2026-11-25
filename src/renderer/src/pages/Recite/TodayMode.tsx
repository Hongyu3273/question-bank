// 今日任务:按记忆曲线出题。到期复习 + 每日新题,看完答案后自评"不会 / 模糊 / 记住"。

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WRONG_BOOK_ID, type Grade, type StudyState, type TodayCounts } from '@shared/types'
import { CheckIcon } from '../../components/icons'
import PageHeader from '../../components/PageHeader'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import { errorMessage } from '../../lib/errors'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import { GradeBar, handleStudyKeys, ModeSwitch, QuestionCard, ReciteEmpty } from './RecitePieces'
import styles from './RecitePage.module.css'

const NO_IDS: string[] = []
/** 完成后"再学几道新题"每次加的数量 */
const MORE_NEW = 10
/** "提前复习"每次最多加的数量 */
const MORE_AHEAD = 20

/** 卡片上方的今日进度:进度条 + 新题、复习、重学剩余数量 */
function TodayProgress({ counts }: { counts: TodayCounts }) {
  const { t } = useTranslation()
  const left = counts.newLeft + counts.reviewLeft + counts.learningLeft
  const total = counts.doneToday + left
  const percent = total === 0 ? 100 : Math.round((counts.doneToday / total) * 100)
  return (
    <div className={styles.todayStrip}>
      <span className={styles.todayLabel}>{t('study.todayProgress')}</span>
      <div
        className={styles.todayBar}
        role="progressbar"
        aria-label={t('study.todayProgress')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={counts.doneToday}
      >
        <div style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.todayLeft}>{t('study.leftToday', { count: left })}</span>
      <span className={styles.counts}>
        <span className={styles.countNew} title={t('study.newHint')}>
          {t('study.countNew', { count: counts.newLeft })}
        </span>
        <span className={styles.countReview} title={t('study.reviewHint')}>
          {t('study.countReview', { count: counts.reviewLeft })}
        </span>
        {counts.learningLeft > 0 && (
          <span className={styles.countLearning} title={t('study.learningHint')}>
            {t('study.countLearning', { count: counts.learningLeft })}
          </span>
        )}
      </span>
    </div>
  )
}

export default function TodayMode() {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const priorityFilter = useSettingsStore((s) => s.settings?.priorityFilter ?? NO_IDS)
  const update = useSettingsStore((s) => s.update)
  const priorityLabel = usePriorityLabel()

  const [state, setState] = useState<StudyState | undefined>(undefined)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLElement>(null)

  const fail = useCallback((err: unknown) => toast(errorMessage(err, t), 3000), [toast, t])

  const apply = useCallback((next: StudyState) => {
    setState(next)
    setRevealed(false)
    cardRef.current?.scrollTo({ top: 0 })
  }, [])

  const load = useCallback(
    () => window.api.study.state(selectedIds, priorityFilter),
    [selectedIds, priorityFilter]
  )

  useEffect(() => {
    let cancelled = false
    load()
      .then((s) => !cancelled && apply(s))
      .catch(fail)
    return () => {
      cancelled = true
    }
  }, [load, apply, fail])

  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return
      setBusy(true)
      try {
        await action()
        apply(await load())
      } catch (err) {
        fail(err)
      } finally {
        setBusy(false)
      }
    },
    [busy, load, apply, fail]
  )

  const grade = useCallback(
    (g: Grade) => {
      if (state?.status !== 'card') return
      const id = state.card.question.id
      void run(() => window.api.study.rate(id, g))
    },
    [state, run]
  )

  const undoLast = useCallback(
    () =>
      void run(async () => {
        const id = await window.api.study.undo()
        toast(id ? t('study.undone') : t('study.nothingToUndo'))
      }),
    [run, toast, t]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || state.status === 'empty') return
      if (state.status === 'done') {
        // 完成页只响应撤销
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.canUndo) {
          e.preventDefault()
          undoLast()
        }
        return
      }
      handleStudyKeys(e, { revealed, setRevealed, onGrade: grade, onUndo: state.canUndo ? undoLast : undefined })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, revealed, grade, undoLast])

  if (state === undefined) return null
  if (state.status === 'empty') {
    return <ReciteEmpty selected={selectedIds.length} filtered={priorityFilter.length > 0} />
  }

  const header = (
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
          <ModeSwitch />
        </>
      }
    />
  )

  // ---------- 今日任务完成 ----------
  if (state.status === 'done') {
    const openWrongBook = async () => {
      await update('selectedBankIds', [WRONG_BOOK_ID])
      await update('reciteMode', 'shuffle')
    }
    return (
      <div className={styles.page}>
        {header}
        <TodayProgress counts={state.counts} />
        <div className={styles.empty}>
          <div className={`${styles.emptyIcon} ${styles.doneIcon}`}>
            <CheckIcon size={28} />
          </div>
          <div className={styles.emptyTitle}>{t('study.doneTitle')}</div>
          <p className={styles.emptyDesc}>{t('study.doneDesc', { count: state.counts.doneToday })}</p>
          <div className={styles.doneActions}>
            {state.moreNew > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void run(() => window.api.study.extend('new', Math.min(MORE_NEW, state.moreNew)))}
              >
                {t('study.moreNew', { count: Math.min(MORE_NEW, state.moreNew) })}
              </button>
            )}
            {state.ahead > 0 && (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => void run(() => window.api.study.extend('ahead', Math.min(MORE_AHEAD, state.ahead)))}
              >
                {t('study.ahead', { count: Math.min(MORE_AHEAD, state.ahead) })}
              </button>
            )}
            {state.wrongBook > 0 && !selectedIds.includes(WRONG_BOOK_ID) && (
              <button type="button" className="btn" onClick={() => void openWrongBook()}>
                {t('study.practiceWrongBook', { count: state.wrongBook })}
              </button>
            )}
          </div>
          {state.canUndo && (
            <button type="button" className={styles.undoLink} onClick={undoLast} disabled={busy}>
              {t('study.undoLast')}
              <kbd className={styles.kbd}>Ctrl Z</kbd>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ---------- 一道题 ----------
  const { card } = state
  return (
    <div className={styles.page}>
      {header}
      <TodayProgress counts={state.counts} />
      <QuestionCard
        question={card.question}
        bankName={card.bankName}
        badges={
          <>
            {card.isNew ? (
              <span className={styles.newTag}>{t('study.newCard')}</span>
            ) : (
              <span className={styles.reviewTag}>{t('study.reviewCard')}</span>
            )}
            {card.inWrongBook && <span className={styles.wrongTag}>{t('study.inWrongBook')}</span>}
          </>
        }
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onHide={() => setRevealed(false)}
        cardRef={cardRef}
      />
      <footer className={styles.footer}>
        {state.canUndo ? (
          <button type="button" className={styles.undoButton} onClick={undoLast} disabled={busy} title={t('study.undoHint')}>
            {t('study.undo')}
            <kbd className={styles.kbd}>Ctrl Z</kbd>
          </button>
        ) : (
          <span className={styles.footerSpacer} aria-hidden="true" />
        )}
        {revealed ? (
          <GradeBar previews={card.previews} onGrade={grade} disabled={busy} />
        ) : (
          <span className={styles.footerSpacer} aria-hidden="true" />
        )}
        {/* 占位,让中间的按钮居中 */}
        <span className={styles.footerSpacer} aria-hidden="true" />
      </footer>
    </div>
  )
}
