// 背题模式两种方式(今日任务、全部刷一遍)共用的组件

import { useMemo, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { extractMeta } from '@shared/meta'
import type { Grade, GradePreview, Question, ReciteMode } from '@shared/types'
import { EyeIcon, ShuffleIcon } from '../../components/icons'
import MarkdownView from '../../components/MarkdownView'
import MetaTags from '../../components/MetaTags'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import { useSettingsStore } from '../../stores/settings'
import styles from './RecitePage.module.css'

/** 焦点在输入框或有弹窗打开时,不响应快捷键 */
export function shortcutsBlocked(): boolean {
  const el = document.activeElement
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable) {
    return true
  }
  return document.querySelector('dialog[open]') !== null
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** 下次复习间隔:10 分钟、3 小时、4 天、2 个月、1.5 年 */
export function formatInterval(ms: number, t: TFunction): string {
  if (ms < HOUR) return t('study.minutes', { count: Math.max(1, Math.round(ms / MIN)) })
  if (ms < DAY) return t('study.hours', { count: Math.round(ms / HOUR) })
  const days = Math.round(ms / DAY)
  if (days < 30) return t('study.days', { count: days })
  if (days < 365) return t('study.months', { count: Math.round(days / 30) })
  return t('study.years', { count: Math.round((days / 365) * 10) / 10 })
}

/** 顶部的方式切换:今日任务 / 全部刷一遍 */
export function ModeSwitch() {
  const { t } = useTranslation()
  const mode = useSettingsStore((s) => s.settings?.reciteMode ?? 'today')
  const update = useSettingsStore((s) => s.update)
  const options: { value: ReciteMode; label: string; title: string }[] = [
    { value: 'today', label: t('study.modeToday'), title: t('study.modeTodayHint') },
    { value: 'shuffle', label: t('study.modeShuffle'), title: t('study.modeShuffleHint') }
  ]
  return (
    <div className={styles.modeSwitch} role="radiogroup" aria-label={t('study.mode')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mode === o.value}
          title={o.title}
          className={mode === o.value ? styles.modeOn : undefined}
          onClick={() => void update('reciteMode', o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 没有可背的题目 */
export function ReciteEmpty({ selected, filtered }: { selected: number; filtered: boolean }) {
  const { t } = useTranslation()
  const noSelection = selected === 0
  return (
    <div className={styles.page}>
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
        <Link to="/" className="btn btn-primary">
          {t('read.goSelect')}
        </Link>
      </div>
    </div>
  )
}

interface CardProps {
  question: Question
  bankName: string
  /** 题目上方的标签(本轮第几题、新题、错题本等) */
  badges?: ReactNode
  revealed: boolean
  onReveal: () => void
  onHide: () => void
  cardRef: RefObject<HTMLElement | null>
}

/** 题目卡片:答案隐藏时整个区域可点击显示 */
export function QuestionCard({ question, bankName, badges, revealed, onReveal, onHide, cardRef }: CardProps) {
  const { t } = useTranslation()
  const showEnglish = useSettingsStore((s) => s.settings?.showEnglish ?? true)
  const priorityLabel = usePriorityLabel()
  const parsed = useMemo(() => extractMeta(question.answerMd), [question.answerMd])

  return (
    <div className={styles.stage}>
      <article ref={cardRef as RefObject<HTMLElement>} className={styles.card} aria-labelledby="recite-question">
        <div className={styles.cardMeta}>
          <span className={styles.bankTag}>{bankName}</span>
          {badges}
          <MetaTags meta={parsed.meta} priorityLabel={priorityLabel} />
        </div>
        <h2 id="recite-question" className={styles.question}>
          {question.title}
        </h2>
        {showEnglish && parsed.meta.english && <p className={styles.english}>{parsed.meta.english}</p>}
        <div className={styles.divider} />

        {revealed ? (
          <div className={styles.answer}>
            <div className={styles.answerHeader}>
              <span className={styles.answerLabel}>{t('recite.answer')}</span>
              <button type="button" className="btn btn-sm" onClick={onHide}>
                {t('recite.hideAnswer')}
                <kbd className={styles.kbd}>{t('recite.space')}</kbd>
              </button>
            </div>
            {parsed.body.trim() ? (
              <MarkdownView markdown={parsed.body} bankId={question.bankId} />
            ) : (
              <p className={styles.noAnswer}>{t('read.noAnswer')}</p>
            )}
          </div>
        ) : (
          // 整个区域都可以点击:点任意位置显示答案
          <button type="button" className={styles.hidden} onClick={onReveal}>
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
  )
}

const GRADE_CLASS: Record<Grade, string> = { 1: styles.gradeAgain, 2: styles.gradeHard, 3: styles.gradeGood }

/** 自评按钮:不会 / 模糊 / 记住,下方显示下次复习时间 */
export function GradeBar({
  previews,
  onGrade,
  disabled
}: {
  previews: GradePreview[]
  onGrade: (grade: Grade) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.grades} role="group" aria-label={t('study.rateLabel')}>
      {previews.map(({ grade, intervalMs }) => (
        <button
          key={grade}
          type="button"
          className={`${styles.grade} ${GRADE_CLASS[grade]}`}
          onClick={() => onGrade(grade)}
          disabled={disabled}
        >
          <span className={styles.gradeLabel}>
            {t(`study.grade${grade}`)}
            <kbd className={styles.kbd}>{grade}</kbd>
          </span>
          <span className={styles.gradeInterval}>{formatInterval(intervalMs, t)}</span>
        </button>
      ))}
    </div>
  )
}

/** 键盘:空格显示/隐藏答案;答案显示后 1/2/3 自评;Ctrl+Z 撤销 */
export function handleStudyKeys(
  e: KeyboardEvent,
  opts: { revealed: boolean; setRevealed: (fn: (r: boolean) => boolean) => void; onGrade: (g: Grade) => void; onUndo?: () => void }
): boolean {
  if (shortcutsBlocked()) return false
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
    if (!opts.onUndo) return false
    e.preventDefault()
    opts.onUndo()
    return true
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return false
  if (e.key === ' ') {
    e.preventDefault()
    opts.setRevealed((r) => !r)
    return true
  }
  if (opts.revealed && (e.key === '1' || e.key === '2' || e.key === '3')) {
    e.preventDefault()
    opts.onGrade(Number(e.key) as Grade)
    return true
  }
  return false
}
