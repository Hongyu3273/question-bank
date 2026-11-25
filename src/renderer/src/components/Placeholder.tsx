import { useTranslation } from 'react-i18next'
import styles from './Placeholder.module.css'

interface Props {
  title: string
  description: string
}

/** 尚未实现的页面占位 */
export default function Placeholder({ title, description }: Props) {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.card}>
        <span className={styles.badge}>{t('placeholder.inProgress')}</span>
        <p className={styles.desc}>{description}</p>
      </div>
    </div>
  )
}
