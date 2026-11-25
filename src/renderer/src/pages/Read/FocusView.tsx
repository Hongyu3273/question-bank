import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { extractMeta } from '@shared/meta'
import type { Question } from '@shared/types'
import { ArrowLeftIcon, CloseIcon } from '../../components/icons'
import MarkdownView from '../../components/MarkdownView'
import MetaTags from '../../components/MetaTags'
import { useSearchHighlight } from '../../hooks/useSearchHighlight'
import styles from './FocusView.module.css'

interface Props {
  question: Question
  bankName: string
  /** 在所选题库全部题目中的位置(从 1 开始) */
  index: number
  total: number
  /** 在所属题库中的题号 */
  number: number
  query: string
  showEnglish: boolean
  priorityLabel: (p: string) => string
  onPrev: () => void
  onNext: () => void
  onClose: () => void
}

/** 单题放大查看:大字号显示一道题,左右切换上一题、下一题 */
export default function FocusView({
  question: q,
  bankName,
  index,
  total,
  number,
  query,
  showEnglish,
  priorityLabel,
  onPrev,
  onNext,
  onClose
}: Props) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const { meta, body } = useMemo(() => extractMeta(q.answerMd), [q.answerMd])
  const hasPrev = index > 1
  const hasNext = index < total

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  // 切换题目后回到顶部
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [q.id])

  useSearchHighlight(bodyRef, query, q.id, 'qb-search-focus')

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="focus-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return
        if (e.key === 'ArrowLeft' && hasPrev) {
          e.preventDefault()
          onPrev()
        } else if (e.key === 'ArrowRight' && hasNext) {
          e.preventDefault()
          onNext()
        }
      }}
    >
      <header className={styles.header}>
        <span className={styles.bankTag}>{bankName}</span>
        <span className={styles.position}>
          {t('manage.questionNumber', { number })}
          <span className={styles.positionTotal}>{t('read.focusPosition', { index, total })}</span>
        </span>
        <button type="button" className={styles.close} aria-label={t('read.closeFocus')} title={t('read.closeFocus')} onClick={onClose}>
          <CloseIcon size={20} />
        </button>
      </header>

      <div className={styles.stage}>
        <button
          type="button"
          className={`${styles.side} ${styles.sidePrev}`}
          aria-label={t('recite.prev')}
          title={`${t('recite.prev')} (←)`}
          disabled={!hasPrev}
          onClick={onPrev}
        >
          <ArrowLeftIcon size={16} />
        </button>

        <div ref={bodyRef} className={styles.body} tabIndex={-1}>
          <article className={styles.content}>
            <MetaTags meta={meta} showSource priorityLabel={priorityLabel} />
            <h2 id="focus-title" className={styles.title}>
              {q.title}
            </h2>
            {showEnglish && meta.english && <p className={styles.english}>{meta.english}</p>}
            <div className={styles.divider} />
            {body.trim() ? (
              <MarkdownView markdown={body} bankId={q.bankId} className={styles.answer} />
            ) : (
              <p className={styles.noAnswer}>{t('read.noAnswer')}</p>
            )}
          </article>
        </div>

        <button
          type="button"
          className={`${styles.side} ${styles.sideNext}`}
          aria-label={t('recite.next')}
          title={`${t('recite.next')} (→)`}
          disabled={!hasNext}
          onClick={onNext}
        >
          <ArrowLeftIcon size={16} />
        </button>
      </div>

      <footer className={styles.footer}>
        <button type="button" className="btn btn-sm" onClick={onPrev} disabled={!hasPrev}>
          <ArrowLeftIcon size={14} />
          {t('recite.prev')}
        </button>
        <span className={styles.hint}>{t('read.focusHint')}</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={onNext} disabled={!hasNext} autoFocus>
          {t('recite.next')}
          <span className={styles.flip}>
            <ArrowLeftIcon size={14} />
          </span>
        </button>
      </footer>
    </dialog>
  )
}
