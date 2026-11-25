import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirmStore } from '../stores/confirm'
import styles from './ConfirmHost.module.css'

/** 渲染全局确认弹窗。使用原生 <dialog>:自带焦点管理,Esc 关闭 */
export default function ConfirmHost() {
  const { t } = useTranslation()
  const request = useConfirmStore((s) => s.request)
  const settle = useConfirmStore((s) => s.settle)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
  }, [request])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault()
        settle(false)
      }}
    >
      {request && (
        <>
          <h2 id="confirm-title" className={styles.title}>
            {request.title}
          </h2>
          {request.message && <p className={styles.message}>{request.message}</p>}
          <div className={styles.actions}>
            <button type="button" className="btn" onClick={() => settle(false)}>
              {request.cancelLabel ?? t('common.cancel')}
            </button>
            <button
              type="button"
              className={request.danger ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={() => settle(true)}
              autoFocus
            >
              {request.confirmLabel ?? t('common.confirm')}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
