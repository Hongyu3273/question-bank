import { useToastStore } from '../stores/toast'
import styles from './ToastHost.module.css'

/** 全局提示,显示在窗口顶部中间 */
export default function ToastHost() {
  const message = useToastStore((s) => s.message)
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {message && <div className={styles.toast}>{message}</div>}
    </div>
  )
}
