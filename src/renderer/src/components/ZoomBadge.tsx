import { useTranslation } from 'react-i18next'
import { useUiStore } from '../stores/ui'
import styles from './ZoomBadge.module.css'

/** 内容缩放不是 100% 时显示当前比例,点击恢复 */
export default function ZoomBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  const zoom = useUiStore((s) => s.contentZoom)
  const setZoom = useUiStore((s) => s.setContentZoom)
  if (zoom === 1) return null
  return (
    <button type="button" className={className ? `${styles.badge} ${className}` : styles.badge} onClick={() => setZoom(1)} title={t('zoom.hint')}>
      {Math.round(zoom * 100)}%<span className={styles.reset}>{t('zoom.reset')}</span>
    </button>
  )
}
