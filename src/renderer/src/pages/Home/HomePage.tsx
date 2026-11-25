import { useEffect, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { BankSummary } from '@shared/types'
import { BookIcon, ExamIcon, ShuffleIcon } from '../../components/icons'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import styles from './HomePage.module.css'

const NO_IDS: string[] = []

export default function HomePage() {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.show)
  const selectedIds = useSettingsStore((s) => s.settings?.selectedBankIds ?? NO_IDS)
  const readPosition = useSettingsStore((s) => s.settings?.readPosition ?? null)
  const updateSetting = useSettingsStore((s) => s.update)
  const [banks, setBanks] = useState<BankSummary[] | null>(null)
  const [lastRead, setLastRead] = useState<string | null>(null)

  useEffect(() => {
    void window.api.banks.list().then(setBanks)
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
  const totalQuestions = selected.reduce((sum, b) => sum + b.questionCount, 0)

  const setSelection = (ids: string[]) => void updateSetting('selectedBankIds', ids)
  const toggle = (id: string) =>
    setSelection(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])

  // 没有勾选题库时,阻止进入看题和背题
  const guard = (e: MouseEvent) => {
    if (selected.length === 0) {
      e.preventDefault()
      showToast(t('home.needSelection'))
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('home.title')}</h1>
          <p className={styles.subtitle}>{t('home.subtitle')}</p>
        </div>
        <div className={styles.summary}>
          {t('home.selectedSummary', { banks: selected.length, questions: totalQuestions })}
        </div>
      </header>

      <section className={styles.modes} aria-label={t('home.modes')}>
        <Link to="/read" className={styles.mode} onClick={guard}>
          <div className={styles.modeIcon}>
            <BookIcon size={22} />
          </div>
          <div className={styles.modeTitle}>{t('nav.read')}</div>
          <p className={styles.modeDesc}>{t('home.readDesc')}</p>
          {lastRead && <div className={styles.modeMeta}>{t('home.lastRead', { title: lastRead })}</div>}
          <div className={styles.modeAction}>{lastRead ? t('home.continueReading') : t('home.readAction')}</div>
        </Link>

        <Link to="/recite" className={styles.mode} onClick={guard}>
          <div className={styles.modeIcon}>
            <ShuffleIcon size={22} />
          </div>
          <div className={styles.modeTitle}>{t('nav.recite')}</div>
          <p className={styles.modeDesc}>{t('home.reciteDesc')}</p>
          <div className={styles.modeAction}>{t('home.reciteAction')}</div>
        </Link>

        <button
          type="button"
          className={`${styles.mode} ${styles.modeDisabled}`}
          onClick={() => showToast(t('common.notAvailable'))}
        >
          <div className={styles.modeTop}>
            <div className={`${styles.modeIcon} ${styles.modeIconMuted}`}>
              <ExamIcon size={22} />
            </div>
            <span className={styles.soonBadge}>{t('common.comingSoon')}</span>
          </div>
          <div className={styles.modeTitle}>{t('nav.exam')}</div>
          <p className={styles.modeDesc}>{t('home.examDesc')}</p>
          <div className={styles.modeActionMuted}>{t('home.examAction')}</div>
        </button>
      </section>

      <section className={styles.banks} aria-label={t('home.banks')}>
        <div className={styles.banksHeader}>
          <h2 className={styles.banksTitle}>{t('home.banks')}</h2>
          <div className={styles.banksActions}>
            {banks && banks.length > 0 && (
              <button type="button" className={styles.linkButton} onClick={() => setSelection(banks.map((b) => b.id))}>
                {t('home.selectAll')}
              </button>
            )}
            <Link to="/manage">{t('home.manageBanks')}</Link>
          </div>
        </div>

        {banks && banks.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{t('home.emptyTitle')}</div>
            <p className={styles.emptyDesc}>{t('home.emptyDesc')}</p>
            <Link to="/manage" className="btn btn-primary">
              {t('home.emptyAction')}
            </Link>
          </div>
        )}

        {banks?.map((bank) => (
          <label key={bank.id} className={styles.bankRow}>
            <input type="checkbox" checked={selectedIds.includes(bank.id)} onChange={() => toggle(bank.id)} />
            <span className={styles.bankName}>{bank.name}</span>
            <span className={styles.bankCount}>{t('common.questionCount', { count: bank.questionCount })}</span>
          </label>
        ))}
      </section>
    </div>
  )
}
