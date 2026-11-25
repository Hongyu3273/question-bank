import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToastStore } from '../stores/toast'
import { BookIcon, ExamIcon, FolderIcon, HomeIcon, SettingsIcon, ShuffleIcon } from './icons'
import styles from './Sidebar.module.css'

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)

export default function Sidebar() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)

  return (
    <nav className={styles.sidebar} aria-label={t('nav.label')}>
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden="true">
          题
        </div>
        <span className={styles.brandName}>{t('app.name')}</span>
      </div>

      <NavLink to="/" end className={navClass}>
        <HomeIcon />
        {t('nav.home')}
      </NavLink>
      <NavLink to="/read" className={navClass}>
        <BookIcon />
        {t('nav.read')}
      </NavLink>
      <NavLink to="/recite" className={navClass}>
        <ShuffleIcon />
        {t('nav.recite')}
      </NavLink>
      {/* 考试模式只保留入口 */}
      <button type="button" className={styles.item} onClick={() => showToast(t('common.notAvailable'))}>
        <ExamIcon />
        <span className={styles.grow}>{t('nav.exam')}</span>
        <span className={styles.badge}>{t('common.comingSoon')}</span>
      </button>
      <NavLink to="/manage" className={navClass}>
        <FolderIcon />
        {t('nav.manage')}
      </NavLink>
      <NavLink to="/settings" className={navClass}>
        <SettingsIcon />
        {t('nav.settings')}
      </NavLink>
    </nav>
  )
}
