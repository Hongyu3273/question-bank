import { useTranslation } from 'react-i18next'
import { NO_PRIORITY } from '@shared/meta'
import type { PriorityStats } from '@shared/types'
import { usePriorityLabel } from '../hooks/usePriorityLabel'
import styles from './PriorityFilter.module.css'

interface Props {
  stats: PriorityStats
  /** 选中的优先级;空数组表示全部 */
  selected: string[]
  onChange: (selected: string[]) => void
  /** 紧凑样式(用于看题页顶部) */
  compact?: boolean
}

/** 按优先级筛选的标签组:全部 / 高 / 中 / 低 / 未设置(可多选) */
export default function PriorityFilter({ stats, selected, onChange, compact }: Props) {
  const { t } = useTranslation()
  const label = usePriorityLabel()
  const options = [
    ...stats.counts.map((c) => ({ value: c.priority, count: c.count })),
    ...(stats.unlabeled > 0 ? [{ value: NO_PRIORITY, count: stats.unlabeled }] : [])
  ]
  if (options.length <= 1) return null

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value])

  const chip = (on: boolean) => (on ? `${styles.chip} ${styles.on}` : styles.chip)

  return (
    <div className={compact ? `${styles.row} ${styles.compact}` : styles.row} role="group" aria-label={t('home.priorityFilter')}>
      <span className={styles.label}>{t('home.priorityFilter')}</span>
      <button type="button" className={chip(selected.length === 0)} aria-pressed={selected.length === 0} onClick={() => onChange([])}>
        {t('home.allPriorities')}
        <span className={styles.count}>{stats.total}</span>
      </button>
      {options.map(({ value, count }) => {
        const on = selected.includes(value)
        return (
          <button key={value} type="button" className={chip(on)} aria-pressed={on} onClick={() => toggle(value)}>
            {label(value)}
            <span className={styles.count}>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
