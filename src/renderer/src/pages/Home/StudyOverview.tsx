// 首页的学习概况:连续天数、今天的自评、最近 7 天、未来 7 天到期、每个题库的掌握情况

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StudyStats } from '@shared/types'
import styles from './StudyOverview.module.css'

/** YYYY-MM-DD → 11/26 */
const shortDay = (day: string) => {
  const [, m, d] = day.split('-')
  return `${Number(m)}/${Number(d)}`
}

function Bars({
  days,
  label,
  todayIndex,
  tone
}: {
  days: { day: string; count: number }[]
  label: (day: string, i: number) => string
  todayIndex: number
  tone: 'accent' | 'review'
}) {
  const { t } = useTranslation()
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div className={styles.bars}>
      {days.map((d, i) => (
        <div key={d.day} className={styles.barCol} title={t('overview.barTitle', { day: d.day, count: d.count })}>
          <span className={styles.barValue}>{d.count > 0 ? d.count : ''}</span>
          <div className={styles.barTrack}>
            <div
              className={`${styles.bar} ${tone === 'review' ? styles.barReview : ''} ${i === todayIndex ? styles.barToday : ''}`}
              style={{ height: `${Math.max(d.count > 0 ? 6 : 0, Math.round((d.count / max) * 100))}%` }}
            />
          </div>
          <span className={i === todayIndex ? `${styles.barLabel} ${styles.barLabelToday}` : styles.barLabel}>
            {label(d.day, i)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function StudyOverview({ refreshKey }: { refreshKey: number }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<StudyStats | null>(null)

  useEffect(() => {
    void window.api.study.stats().then(setStats)
  }, [refreshKey])

  if (!stats || stats.banks.length === 0) return null
  const { grades } = stats
  const ratedToday = grades.again + grades.hard + grades.good

  return (
    <section className={styles.overview} aria-labelledby="home-overview">
      <h2 id="home-overview" className={styles.title}>
        {t('overview.title')}
      </h2>

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardLabel}>{t('overview.streak')}</div>
          <div className={styles.big}>
            {stats.streak}
            <span className={styles.unit}>{t('overview.days', { count: stats.streak })}</span>
          </div>
          <div className={styles.sub}>
            {ratedToday > 0
              ? t('overview.today', { count: ratedToday, minutes: Math.max(1, stats.minutes) })
              : stats.streak > 0
                ? t('overview.keepStreak')
                : t('overview.startToday')}
          </div>
          {ratedToday > 0 && (
            <div className={styles.grades}>
              <span className={styles.gradeAgain}>{t('overview.again', { count: grades.again })}</span>
              <span className={styles.gradeHard}>{t('overview.hard', { count: grades.hard })}</span>
              <span className={styles.gradeGood}>{t('overview.good', { count: grades.good })}</span>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>{t('overview.last7')}</div>
          <Bars
            days={stats.last7}
            todayIndex={6}
            tone="accent"
            label={(day, i) => (i === 6 ? t('overview.todayShort') : shortDay(day))}
          />
        </div>

        <div className={styles.card}>
          <div className={styles.cardLabel}>{t('overview.next7')}</div>
          <Bars
            days={stats.next7}
            todayIndex={0}
            tone="review"
            label={(day, i) => (i === 0 ? t('overview.todayShort') : i === 1 ? t('overview.tomorrow') : shortDay(day))}
          />
        </div>
      </div>

      <div className={styles.banks}>
        {stats.banks.map((b) => {
          const percent = b.total === 0 ? 0 : Math.round((b.learned / b.total) * 100)
          return (
            <div key={b.id} className={styles.bankRow}>
              <span className={styles.bankName} title={b.name}>
                {b.name}
              </span>
              <div className={styles.bankTrack} aria-hidden="true">
                <div style={{ width: `${percent}%` }} />
              </div>
              <span className={styles.bankNumbers}>
                {t('overview.learned', { learned: b.learned, total: b.total })}
                {b.wrongBook > 0 && <span className={styles.bankWrong}>{t('overview.wrong', { count: b.wrongBook })}</span>}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
