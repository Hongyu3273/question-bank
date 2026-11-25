import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToastStore } from '../stores/toast'
import { useUiStore } from '../stores/ui'
import {
  BookIcon,
  ExamIcon,
  FolderIcon,
  HomeIcon,
  KeyboardIcon,
  PanelLeftIcon,
  SettingsIcon,
  ShuffleIcon
} from './icons'
import styles from './Sidebar.module.css'

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)

/** 左侧导航;可以收起为只显示图标的窄栏 */
export default function Sidebar() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const openShortcuts = useUiStore((s) => s.setShortcutsOpen)

  const link = (to: string, icon: ReactNode, label: string, end = false) => (
    <NavLink to={to} end={end} className={navClass} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
      {icon}
      <span className={styles.label}>{label}</span>
    </NavLink>
  )

  return (
    <nav className={collapsed ? `${styles.sidebar} ${styles.collapsed}` : styles.sidebar} aria-label={t('nav.label')}>
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden="true">
          题
        </div>
        <span className={styles.brandName}>{t('app.name')}</span>
      </div>

      {link('/', <HomeIcon />, t('nav.home'), true)}
      {link('/read', <BookIcon />, t('nav.read'))}
      {link('/recite', <ShuffleIcon />, t('nav.recite'))}
      {/* 考试模式只保留入口 */}
      <button
        type="button"
        className={styles.item}
        onClick={() => showToast(t('common.notAvailable'))}
        title={collapsed ? `${t('nav.exam')}(${t('common.comingSoon')})` : undefined}
        aria-label={collapsed ? t('nav.exam') : undefined}
      >
        <ExamIcon />
        <span className={styles.label}>{t('nav.exam')}</span>
        <span className={styles.badge}>{t('common.comingSoon')}</span>
      </button>
      {link('/manage', <FolderIcon />, t('nav.manage'))}
      {link('/settings', <SettingsIcon />, t('nav.settings'))}

      <div className={styles.spacer} />

      <button
        type="button"
        className={styles.item}
        onClick={() => openShortcuts(true)}
        title={`${t('shortcuts.title')} (?)`}
        aria-label={collapsed ? t('shortcuts.title') : undefined}
      >
        <KeyboardIcon />
        <span className={styles.label}>{t('shortcuts.title')}</span>
      </button>
      <button
        type="button"
        className={styles.item}
        onClick={toggle}
        aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
        title={collapsed ? t('nav.expand') : t('nav.collapse')}
        aria-expanded={!collapsed}
      >
        <PanelLeftIcon />
        <span className={styles.label}>{t('nav.collapse')}</span>
      </button>
    </nav>
  )
}
