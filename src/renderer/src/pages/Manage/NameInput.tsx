import { useState } from 'react'
import { LIMITS } from '@shared/types'

interface Props {
  initialValue?: string
  placeholder: string
  ariaLabel: string
  /** 提交名称;失败时抛出的错误信息会显示在输入框下方 */
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
  errorText: (err: unknown) => string
}

/** 新建或重命名题库时的行内输入框:回车保存,Esc 取消,失去焦点时有改动则保存 */
export default function NameInput({ initialValue = '', placeholder, ariaLabel, onSubmit, onCancel, errorText }: Props) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!value.trim() || value.trim() === initialValue.trim()) {
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
    <div>
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
        onBlur={() => {
          if (!error) void submit()
        }}
      />
      {error && (
        <div role="alert" style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
