// 全部刷一遍:所选题库洗牌后逐题过一遍(原来的背题方式)。自评同样计入记忆曲线。

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Grade, ReciteState } from '@shared/types'
import { ArrowLeftIcon, ShuffleIcon } from '../../components/icons'
import PageHeader from '../../components/PageHeader'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import { errorMessage } from '../../lib/errors'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import { GradeBar, handleStudyKeys, ModeSwitch, QuestionCard, ReciteEmpty } from './RecitePieces'
import styles from './RecitePage.module.css'

const NO_IDS: string[] = []

export default function ShuffleMode() {
  const { t } = useTranslation()
  const toast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const priorityFilter = useSettingsStore((s) => s.settings?.priorityFilter ?? NO_IDS)
  const priorityLabel = usePriorityLabel()

  // undefined:加载中;null:没有可背的题目
  const [state, setState] = useState<ReciteState | null | undefined>(undefined)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLElement>(null)

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
  const grade = useCallback(
    (g: Grade) => {
      if (!state) return
      void run(async () => {
        await window.api.study.rate(state.question.id, g)
        return window.api.recite.next()
      })
    },
    [state, run]
  )
  // 撤销上一次自评并回到上一题
  const undoLast = useCallback(
    () =>
      void run(async () => {
        const id = await window.api.study.undo()
        if (!id) {
          toast(t('study.nothingToUndo'))
          return state ?? null
        }
        toast(t('study.undone'))
        return window.api.recite.prev()
      }),
    [run, state, toast, t]
  )
  const reshuffle = () =>
    void run(async () => {
      const s = await window.api.recite.reshuffle()
      toast(t('recite.reshuffled'))
      return s
    })

  // 快捷键:空格显示/隐藏答案,1/2/3 自评,Ctrl+Z 撤销,← → 切换题目
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state) return
      if (handleStudyKeys(e, { revealed, setRevealed, onGrade: grade, onUndo: undoLast })) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft' && state.index > 1) {
        e.preventDefault()
        prev()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, revealed, grade, undoLast, next, prev])

  if (state === undefined) return null
  if (state === null) return <ReciteEmpty selected={selectedIds.length} filtered={priorityFilter.length > 0} />

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
            <ModeSwitch />
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

      <QuestionCard
        question={question}
        bankName={bankName}
        badges={
          <>
            <span>{t('recite.questionIndex', { index })}</span>
            {state.inWrongBook && <span className={styles.wrongTag}>{t('study.inWrongBook')}</span>}
          </>
        }
        revealed={revealed}
        onReveal={() => setRevealed(true)}
        onHide={() => setRevealed(false)}
        cardRef={cardRef}
      />

      <footer className={styles.footer}>
        <button type="button" className="btn" onClick={prev} disabled={busy || index <= 1}>
          <ArrowLeftIcon size={16} />
          {t('recite.prev')}
        </button>
        {revealed ? (
          <GradeBar previews={state.previews} onGrade={grade} disabled={busy} />
        ) : (
          <button type="button" className={`btn btn-primary ${styles.revealButton}`} onClick={() => setRevealed(true)}>
            {t('recite.showAnswer')}
            <kbd className={`${styles.kbd} ${styles.kbdOnAccent}`}>{t('recite.space')}</kbd>
          </button>
        )}
        <button type="button" className="btn" onClick={next} disabled={busy} title={t('study.skipHint')}>
          {index >= total ? t('recite.finishRound') : t('study.skip')}
          <span className={styles.arrowRight}>
            <ArrowLeftIcon size={16} />
          </span>
        </button>
      </footer>
    </div>
  )
}
