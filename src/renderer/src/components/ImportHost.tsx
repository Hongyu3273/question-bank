import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportIssue, ImportResult } from '@shared/types'
import { errorMessage } from '../lib/errors'
import { useImportStore } from '../stores/import'
import { useToastStore } from '../stores/toast'
import { CheckIcon } from './icons'
import styles from './ImportHost.module.css'

const MAX_ISSUES = 20

function IssueList({ issues }: { issues: ImportIssue[] }) {
  const { t } = useTranslation()
  const where = (i: ImportIssue) =>
    i.row !== undefined
      ? t('import.atRow', { row: i.row })
      : i.question !== undefined
        ? i.line !== undefined
          ? t('import.atQuestionLine', { question: i.question, line: i.line })
          : t('import.atQuestion', { question: i.question })
        : ''
  return (
    <ul className={styles.issues}>
      {issues.slice(0, MAX_ISSUES).map((i, n) => (
        <li key={n}>
          {where(i) && <span className={styles.where}>{where(i)}</span>}
          {t(`import.issue.${i.code}`, { detail: i.detail ?? '' })}
        </li>
      ))}
      {issues.length > MAX_ISSUES && <li>{t('import.moreIssues', { count: issues.length - MAX_ISSUES })}</li>}
    </ul>
  )
}

function ResultRow({ result }: { result: ImportResult }) {
  const { t } = useTranslation()
  const resolve = useImportStore((s) => s.resolve)
  const toast = useToastStore((s) => s.show)
  const [busy, setBusy] = useState(false)

  const choose = async (token: string, choice: 'overwrite' | 'saveAsNew' | 'skip') => {
    setBusy(true)
    try {
      await resolve(token, choice)
    } catch (err) {
      toast(errorMessage(err, t), 3000)
    } finally {
      setBusy(false)
    }
  }

  switch (result.status) {
    case 'imported':
      return (
        <li className={styles.row}>
          <span className={`${styles.mark} ${styles.ok}`}>
            <CheckIcon size={14} />
          </span>
          <div className={styles.main}>
            <div className={styles.name}>{result.name}</div>
            <div className={styles.detail}>
              {t('common.questionCount', { count: result.questionCount })}
              {result.replaced && <span className={styles.tag}>{t('import.replaced')}</span>}
            </div>
          </div>
        </li>
      )
    case 'conflict':
      return (
        <li className={styles.row}>
          <span className={`${styles.mark} ${styles.warn}`}>!</span>
          <div className={styles.main}>
            <div className={styles.name}>{result.name}</div>
            <div className={styles.detail}>{t('import.conflict', { count: result.questionCount })}</div>
            <div className={styles.choices}>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => choose(result.token, 'overwrite')}>
                {t('import.overwrite')}
              </button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => choose(result.token, 'saveAsNew')}>
                {t('import.saveAsNew')}
              </button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => choose(result.token, 'skip')}>
                {t('import.skip')}
              </button>
            </div>
          </div>
        </li>
      )
    case 'skipped':
      return (
        <li className={styles.row}>
          <span className={styles.mark}>–</span>
          <div className={styles.main}>
            <div className={styles.name}>{result.name}</div>
            <div className={styles.detail}>{t('import.skipped')}</div>
          </div>
        </li>
      )
    case 'invalid':
      return (
        <li className={styles.row}>
          <span className={`${styles.mark} ${styles.bad}`}>×</span>
          <div className={styles.main}>
            <div className={styles.name}>{result.file}</div>
            <div className={styles.detail}>{t('import.invalid', { count: result.issues.length })}</div>
            <IssueList issues={result.issues} />
          </div>
        </li>
      )
    case 'failed':
      return (
        <li className={styles.row}>
          <span className={`${styles.mark} ${styles.bad}`}>×</span>
          <div className={styles.main}>
            <div className={styles.name}>{result.file}</div>
            <div className={styles.detail}>{t(`errors.${result.error}`, { defaultValue: t('errors.UNKNOWN') })}</div>
          </div>
        </li>
      )
  }
}

/** 导入结果弹窗:汇总、逐个显示结果、处理同名冲突 */
export default function ImportHost() {
  const { t } = useTranslation()
  const { open, results, close, resolveAll } = useImportStore()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const imported = results.filter((r) => r.status === 'imported')
  const conflicts = results.filter((r) => r.status === 'conflict').length
  const problems = results.filter((r) => r.status === 'invalid' || r.status === 'failed').length
  const questions = imported.reduce((n, r) => n + (r.status === 'imported' ? r.questionCount : 0), 0)

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="import-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      {open && (
        <>
          <h2 id="import-title" className={styles.title}>
            {t('import.title')}
          </h2>
          <p className={styles.summary}>
            {t('import.summary', { banks: imported.length, questions })}
            {conflicts > 0 && ` · ${t('import.summaryConflicts', { count: conflicts })}`}
            {problems > 0 && ` · ${t('import.summaryProblems', { count: problems })}`}
          </p>

          {conflicts > 1 && (
            <div className={styles.bulk}>
              <span>{t('import.allConflicts')}</span>
              <button type="button" className="btn btn-sm" onClick={() => void resolveAll('overwrite')}>
                {t('import.overwriteAll')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void resolveAll('saveAsNew')}>
                {t('import.saveAsNewAll')}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void resolveAll('skip')}>
                {t('import.skipAll')}
              </button>
            </div>
          )}

          <ul className={styles.list}>
            {results.map((r, i) => (
              <ResultRow key={r.status === 'conflict' ? r.token : `${r.file}-${i}`} result={r} />
            ))}
          </ul>

          <div className={styles.actions}>
            {conflicts > 0 && <span className={styles.hint}>{t('import.closeHint')}</span>}
            <button type="button" className="btn btn-primary" onClick={close} autoFocus>
              {t('import.done')}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
