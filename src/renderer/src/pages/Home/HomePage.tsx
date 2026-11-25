import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { NO_PRIORITY } from '@shared/meta'
import type { BankSummary, PriorityStats, ReciteStatus } from '@shared/types'
import { BookIcon, CheckIcon, ExamIcon, FolderIcon, ShuffleIcon, UploadIcon } from '../../components/icons'
import PageHeader from '../../components/PageHeader'
import PriorityFilter from '../../components/PriorityFilter'
import { startImport } from '../../lib/dataActions'
import { useImportStore } from '../../stores/import'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import styles from './HomePage.module.css'

const NO_IDS: string[] = []
const sameList = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

export default function HomePage() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const priorityFilter = useSettingsStore((s) => s.settings?.priorityFilter ?? NO_IDS)
  const readPosition = useSettingsStore((s) => s.settings?.readPosition ?? null)
  const updateSetting = useSettingsStore((s) => s.update)
  const importVersion = useImportStore((s) => s.version)

  const [banks, setBanks] = useState<BankSummary[] | null>(null)
  const [stats, setStats] = useState<PriorityStats | null>(null)
  const [lastRead, setLastRead] = useState<string | null>(null)
  const [recite, setRecite] = useState<ReciteStatus | null>(null)

  useEffect(() => {
    void window.api.banks.list().then(setBanks)
  }, [importVersion])

  useEffect(() => {
    void window.api.recite.status().then(setRecite)
  }, [])

  // 看题模式上次读到的题目(题目已删除时不显示)
  useEffect(() => {
    if (!readPosition) return setLastRead(null)
    window.api.questions
      .get(readPosition)
      .then((q) => setLastRead(q.title))
      .catch(() => setLastRead(null))
  }, [readPosition])

  // 已删除的题库不计入勾选
  const selected = (banks ?? []).filter((b) => selectedIds.includes(b.id))
  const selectedKey = selected.map((b) => b.id).join(',')

  // 所选题库的优先级分布
  useEffect(() => {
    const ids = selectedKey ? selectedKey.split(',') : []
    void window.api.read.priorities(ids).then(setStats)
  }, [selectedKey, importVersion])

  // 当前筛选下的题目数量
  const filtered =
    !stats || priorityFilter.length === 0
      ? (stats?.total ?? 0)
      : stats.counts.filter((c) => priorityFilter.includes(c.priority)).reduce((n, c) => n + c.count, 0) +
        (priorityFilter.includes(NO_PRIORITY) ? stats.unlabeled : 0)

  const setSelection = (ids: string[]) => void updateSetting('selectedBankIds', ids)
  const toggle = (id: string) =>
    setSelection(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])

  // 背题进度只在勾选的题库和筛选与上次背题时相同时显示
  const sameRecite =
    recite !== null && sameList(selected.map((b) => b.id), recite.bankIds) && sameList(priorityFilter, recite.priorities)

  // 没有可看的题目时,阻止进入看题和背题
  const guard = (e: MouseEvent) => {
    if (selected.length === 0) {
      e.preventDefault()
      showToast(t('home.needSelection'))
    } else if (filtered === 0) {
      e.preventDefault()
      showToast(t('home.noFilteredQuestions'))
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t('home.title')} subtitle={t('home.subtitle')} />

      <div className={styles.content}>
        {/* 第一步:选择题库 */}
        <section className={styles.section} aria-labelledby="home-banks">
          <div className={styles.sectionHeader}>
            <h2 id="home-banks" className={styles.sectionTitle}>
              <span className={styles.step}>1</span>
              {t('home.banks')}
            </h2>
            {banks && banks.length > 0 && (
              <div className={styles.sectionActions}>
                <span className={styles.summary}>
                  {t('home.selectedSummary', { banks: selected.length, questions: filtered })}
                </span>
                <button type="button" className={styles.linkButton} onClick={() => setSelection(banks.map((b) => b.id))}>
                  {t('home.selectAll')}
                </button>
                <button type="button" className={styles.linkButton} onClick={() => setSelection([])}>
                  {t('home.selectNone')}
                </button>
                <Link to="/manage" className={styles.linkButton}>
                  {t('home.manageBanks')}
                </Link>
              </div>
            )}
          </div>

          {banks && banks.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <FolderIcon size={26} />
              </div>
              <div className={styles.emptyTitle}>{t('home.emptyTitle')}</div>
              <p className={styles.emptyDesc}>{t('home.emptyDesc')}</p>
              <div className={styles.emptyActions}>
                <button type="button" className="btn" onClick={() => void startImport(t)}>
                  <UploadIcon size={16} />
                  {t('data.import')}
                </button>
                <Link to="/manage" className="btn btn-primary">
                  {t('home.emptyAction')}
                </Link>
              </div>
            </div>
          )}

          {banks && banks.length > 0 && (
            <div className={styles.bankGrid}>
              {banks.map((bank) => {
                const on = selectedIds.includes(bank.id)
                return (
                  <label key={bank.id} className={on ? `${styles.bankChip} ${styles.bankChipOn}` : styles.bankChip}>
                    <input type="checkbox" checked={on} onChange={() => toggle(bank.id)} className="sr-only" />
                    <span className={styles.check} aria-hidden="true">
                      {on && <CheckIcon size={12} />}
                    </span>
                    <span className={styles.bankName} title={bank.name}>
                      {bank.name}
                    </span>
                    <span className={styles.bankCount}>{bank.questionCount}</span>
                  </label>
                )
              })}
            </div>
          )}

          {/* 按优先级筛选(看题和背题共用) */}
          {stats && (
            <PriorityFilter
              stats={stats}
              selected={priorityFilter}
              onChange={(v) => void updateSetting('priorityFilter', v)}
            />
          )}
        </section>

        {/* 第二步:选择模式 */}
        <section className={styles.section} aria-labelledby="home-modes">
          <div className={styles.sectionHeader}>
            <h2 id="home-modes" className={styles.sectionTitle}>
              <span className={styles.step}>2</span>
              {t('home.modes')}
            </h2>
          </div>
          <div className={styles.modes}>
            <Link to="/read" className={styles.mode} onClick={guard}>
              <div className={styles.modeIcon}>
                <BookIcon size={20} />
              </div>
              <div className={styles.modeTitle}>{t('nav.read')}</div>
              <p className={styles.modeDesc}>{t('home.readDesc')}</p>
              {lastRead && <div className={styles.modeMeta}>{t('home.lastRead', { title: lastRead })}</div>}
              <div className={styles.modeAction}>{lastRead ? t('home.continueReading') : t('home.readAction')}</div>
            </Link>

            <Link to="/recite" className={styles.mode} onClick={guard}>
              <div className={styles.modeIcon}>
                <ShuffleIcon size={20} />
              </div>
              <div className={styles.modeTitle}>{t('nav.recite')}</div>
              <p className={styles.modeDesc}>{t('home.reciteDesc')}</p>
              {recite && sameRecite && (
                <div className={styles.modeProgress}>
                  <div className={styles.modeProgressText}>
                    <span>{t('recite.roundLabel', { round: recite.round })}</span>
                    <span>
                      {recite.index} / {recite.total}
                    </span>
                  </div>
                  <div className={styles.modeProgressBar}>
                    <div style={{ width: `${Math.round((recite.index / recite.total) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className={styles.modeAction}>
                {recite && sameRecite ? t('home.continueReciting') : t('home.reciteAction')}
              </div>
            </Link>

            <button
              type="button"
              className={`${styles.mode} ${styles.modeDisabled}`}
              onClick={() => showToast(t('common.notAvailable'))}
            >
              <div className={styles.modeTop}>
                <div className={`${styles.modeIcon} ${styles.modeIconMuted}`}>
                  <ExamIcon size={20} />
                </div>
                <span className={styles.soonBadge}>{t('common.comingSoon')}</span>
              </div>
              <div className={styles.modeTitle}>{t('nav.exam')}</div>
              <p className={styles.modeDesc}>{t('home.examDesc')}</p>
              <div className={styles.modeActionMuted}>{t('home.examAction')}</div>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
