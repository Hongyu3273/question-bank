import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  /** 标题左侧(返回按钮、侧栏开关等) */
  leading?: ReactNode
  /** 右侧操作 */
  actions?: ReactNode
}

/** 所有页面统一的顶部栏:标题、说明、操作按钮(小号) */
export default function PageHeader({ title, subtitle, leading, actions }: Props) {
  return (
    <header className={styles.header}>
      {leading}
      <div className={styles.heading}>
        {typeof title === 'string' ? <h1 className={styles.title}>{title}</h1> : title}
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}

export const pageHeaderStyles = styles
