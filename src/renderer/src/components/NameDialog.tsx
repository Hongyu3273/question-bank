import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './NameDialog.module.css'

interface Props {
  open: boolean
  title: string
  description?: string
  label: string
  placeholder: string
  initialValue?: string
  maxLength: number
  submitLabel: string
  /** 提交名称;抛出错误时把错误信息显示在输入框下方,弹窗保持打开 */
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
  errorText: (err: unknown) => string
}

/** 输入名称的弹窗(新建、重命名题库) */
export default function NameDialog({
  open,
  title,
  description,
  label,
  placeholder,
  initialValue = '',
  maxLength,
  submitLabel,
  onSubmit,
  onClose,
  errorText
}: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setValue(initialValue)
      setError(null)
      setBusy(false)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialValue])

  const submit = async () => {
    if (busy) return
    if (!value.trim()) {
      setError(t('errors.BANK_NAME_EMPTY'))
      return
    }
    setBusy(true)
    try {
      await onSubmit(value)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="name-dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <h2 id="name-dialog-title" className={styles.title}>
            {title}
          </h2>
          {description && <p className={styles.description}>{description}</p>}
          <label className={styles.field}>
            <span className={styles.label}>{label}</span>
            <input
              className="input"
              value={value}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'name-dialog-error' : undefined}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
            />
          </label>
          <div className={styles.meta}>
            {error ? (
              <span id="name-dialog-error" role="alert" className={styles.error}>
                {error}
              </span>
            ) : (
              <span />
            )}
            <span className={styles.counter}>
              {value.length}/{maxLength}
            </span>
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
              {submitLabel}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
