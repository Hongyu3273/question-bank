import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LIMITS } from '@shared/types'
import styles from './ManagePage.module.css'

interface Props {
  initialValue?: string
  placeholder: string
  ariaLabel: string
  /** 提交名称;失败时抛出的错误信息会显示在输入框下方 */
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
  errorText: (err: unknown) => string
}

/** 新建或重命名题库时的行内输入框:点保存或按回车保存,点取消或按 Esc 取消 */
export default function NameInput({ initialValue = '', placeholder, ariaLabel, onSubmit, onCancel, errorText }: Props) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    // 重命名时名称没变,直接结束编辑
    if (initialValue && value.trim() === initialValue.trim()) {
      onCancel()
      return
    }
    setBusy(true)
    try {
      await onSubmit(value)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className={styles.nameInput}>
      <input
        className="input"
        style={{ height: 36, fontSize: '0.875rem' }}
        value={value}
        maxLength={LIMITS.bankName}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
      />
      {error && (
        <div role="alert" className={styles.nameInputError}>
          {error}
        </div>
      )}
      <div className={styles.nameInputActions}>
        <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void submit()} disabled={busy}>
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
