import type { QuestionMeta } from '@shared/meta'
import styles from './MetaTags.module.css'

const PRIORITY_CLASS: Record<string, string> = {
  高: styles.high,
  high: styles.high,
  中: styles.medium,
  medium: styles.medium,
  低: styles.low,
  low: styles.low
}

interface Props {
  meta: QuestionMeta
  /** 显示出处(放大视图等空间充足的地方) */
  showSource?: boolean
  priorityLabel: (p: string) => string
}

/** 题目的优先级、分类、出处标签 */
export default function MetaTags({ meta, showSource, priorityLabel }: Props) {
  if (!meta.priority && !meta.category && !(showSource && meta.source)) return null
  return (
    <span className={styles.tags} data-search-skip>
      {meta.priority && (
        <span className={`${styles.tag} ${PRIORITY_CLASS[meta.priority.toLowerCase()] ?? ''}`}>
          {priorityLabel(meta.priority)}
        </span>
      )}
      {meta.category && (
        <span className={`${styles.tag} ${styles.category}`} title={meta.source}>
          {meta.category}
        </span>
      )}
      {showSource && meta.source && <span className={styles.source}>{meta.source}</span>}
    </span>
  )
}
