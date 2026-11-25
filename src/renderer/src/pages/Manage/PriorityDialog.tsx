import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PRIORITIES } from '@shared/meta'
import type { BankSummary, PriorityScope } from '@shared/types'
import { usePriorityLabel } from '../../hooks/usePriorityLabel'
import styles from './PriorityDialog.module.css'

interface Props {
  bank: BankSummary | null
  /** 题库中还没有优先级的题目数量 */
  missing: number
  onSubmit: (priority: string | null, scope: PriorityScope) => Promise<void>
  onClose: () => void
}

/** 批量设置题库的优先级 */
export default function PriorityDialog({ bank, missing, onSubmit, onClose }: Props) {
  const { t } = useTranslation()
  const label = usePriorityLabel()
  const ref = useRef<HTMLDialogElement>(null)
  const [priority, setPriority] = useState<string>('中')
  const [scope, setScope] = useState<PriorityScope>('missing')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (bank && !dialog.open) {
      setPriority('中')
      setScope(missing > 0 ? 'missing' : 'all')
      dialog.showModal()
    }
    if (!bank && dialog.open) dialog.close()
  }, [bank, missing])

  const submit = async () => {
    setBusy(true)
    try {
      await onSubmit(priority === '' ? null : priority, scope)
    } finally {
      setBusy(false)
    }
  }

  const option = (value: string, text: string) => (
    <label key={value || 'clear'} className={priority === value ? `${styles.option} ${styles.optionOn}` : styles.option}>
      <input type="radio" name="priority" value={value} checked={priority === value} onChange={() => setPriority(value)} />
      {text}
    </label>
  )

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="priority-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {bank && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <h2 id="priority-title" className={styles.title}>
            {t('manage.setPriorityTitle', { name: bank.name })}
          </h2>
          <p className={styles.desc}>{t('manage.setPriorityDesc')}</p>

          <fieldset className={styles.group}>
            <legend>{t('manage.priority')}</legend>
            <div className={styles.options}>
              {PRIORITIES.map((p) => option(p, label(p)))}
              {option('', t('manage.clearPriority'))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend>{t('manage.scope')}</legend>
            <label className={styles.radio}>
              <input type="radio" name="scope" checked={scope === 'missing'} disabled={missing === 0} onChange={() => setScope('missing')} />
              {t('manage.scopeMissing', { count: missing })}
            </label>
            <label className={styles.radio}>
              <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
              {t('manage.scopeAll', { count: bank.questionCount })}
            </label>
          </fieldset>

          <div className={styles.actions}>
            <button type="button" className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || (scope === 'missing' && missing === 0)}>
              {t('common.confirm')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
