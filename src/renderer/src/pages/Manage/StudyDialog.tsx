import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STUDY_LIMITS, type BankSummary, type StudyLimits } from '@shared/types'
import styles from './PriorityDialog.module.css'

interface Props {
  bank: BankSummary | null
  onSubmit: (limits: StudyLimits, applyAll: boolean) => Promise<void>
  onReset: () => Promise<void>
  onClose: () => void
}

const parse = (text: string, max: number): number | null => {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n <= max ? n : null
}

/** 题库的学习设置:每日新题数、每日复习上限、重置学习进度 */
export default function StudyDialog({ bank, onSubmit, onReset, onClose }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const [newText, setNewText] = useState('10')
  const [reviewText, setReviewText] = useState('100')
  const [applyAll, setApplyAll] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (bank && !dialog.open) {
      setNewText(String(bank.newPerDay))
      setReviewText(String(bank.reviewPerDay))
      setApplyAll(false)
      dialog.showModal()
    }
    if (!bank && dialog.open) dialog.close()
  }, [bank])

  const newPerDay = parse(newText, STUDY_LIMITS.newPerDay)
  const reviewPerDay = parse(reviewText, STUDY_LIMITS.reviewPerDay)
  const valid = newPerDay !== null && reviewPerDay !== null

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  const field = (
    id: string,
    label: string,
    hint: string,
    value: string,
    set: (v: string) => void,
    ok: boolean,
    max: number
  ) => (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        className={`input ${styles.numberInput}`}
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={!ok}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className={ok ? styles.fieldHint : styles.fieldError}>
        {ok ? hint : t('studySettings.invalid', { max })}
      </p>
    </div>
  )

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="study-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {bank && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) void act(() => onSubmit({ newPerDay, reviewPerDay }, applyAll))
          }}
        >
          <h2 id="study-title" className={styles.title}>
            {t('studySettings.title', { name: bank.name })}
          </h2>

          {field(
            'study-new',
            t('studySettings.newPerDay'),
            t('studySettings.newPerDayHint'),
            newText,
            setNewText,
            newPerDay !== null,
            STUDY_LIMITS.newPerDay
          )}
          {field(
            'study-review',
            t('studySettings.reviewPerDay'),
            t('studySettings.reviewPerDayHint'),
            reviewText,
            setReviewText,
            reviewPerDay !== null,
            STUDY_LIMITS.reviewPerDay
          )}

          <label className={styles.radio}>
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
            {t('studySettings.applyAll')}
          </label>

          <div className={styles.resetBox}>
            <p className={styles.fieldHint}>{t('studySettings.resetHint')}</p>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void act(onReset)}>
              {t('studySettings.reset')}
            </button>
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !valid}>
              {t('common.save')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
