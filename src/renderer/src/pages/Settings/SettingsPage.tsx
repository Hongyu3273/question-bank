import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FontSize, Language, Settings, ThemeMode } from '@shared/types'
import { DownloadIcon, FolderIcon, UploadIcon } from '../../components/icons'
import ImportGuide from '../../components/ImportGuide'
import PageHeader from '../../components/PageHeader'
import { saveTemplate } from '../../lib/dataActions'
import { errorMessage } from '../../lib/errors'
import { confirmDialog } from '../../stores/confirm'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../../stores/toast'
import styles from './SettingsPage.module.css'

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? `${styles.segment} ${styles.segmentOn}` : styles.segment}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings) as Settings
  const update = useSettingsStore((s) => s.update)
  const [version, setVersion] = useState('')
  const toast = useToastStore((s) => s.show)
  const [busy, setBusy] = useState(false)

  const backup = async () => {
    setBusy(true)
    try {
      const r = await window.api.io.backup()
      if (!r.canceled) toast(t('data.savedTo', { path: r.path }), 3500)
    } catch (err) {
      toast(errorMessage(err, t), 3000)
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    const ok = await confirmDialog({
      title: t('data.restoreConfirmTitle'),
      message: t('data.restoreConfirmMessage'),
      confirmLabel: t('data.chooseBackup'),
      danger: true
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await window.api.io.restore()
      // 数据已全部替换,重新加载界面
      if (!r.canceled) window.location.reload()
    } catch (err) {
      toast(errorMessage(err, t), 4000)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void window.api.app.info().then((info) => setVersion(info.version))
  }, [])

  return (
    <div className={styles.page}>
      <PageHeader title={t('settings.title')} />

      <div className={styles.content}>
      <div className={styles.sections}>
        <section className={styles.section} aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className={styles.sectionTitle}>
            {t('settings.appearance')}
          </h2>
          <div className={styles.item}>
            <span className={styles.itemLabel}>{t('settings.theme')}</span>
            <Segmented<ThemeMode>
              label={t('settings.theme')}
              value={settings.theme}
              onChange={(v) => void update('theme', v)}
              options={[
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
                { value: 'system', label: t('settings.themeSystem') }
              ]}
            />
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>{t('settings.fontSize')}</span>
            <Segmented<FontSize>
              label={t('settings.fontSize')}
              value={settings.fontSize}
              onChange={(v) => void update('fontSize', v)}
              options={[
                { value: 's', label: t('settings.fontSmall') },
                { value: 'm', label: t('settings.fontMedium') },
                { value: 'l', label: t('settings.fontLarge') }
              ]}
            />
          </div>
          <div className={styles.item}>
            <div className={styles.itemText}>
              <div className={styles.itemLabel}>{t('settings.showEnglish')}</div>
              <div className={styles.itemDesc}>{t('settings.showEnglishDesc')}</div>
            </div>
            <Segmented<'on' | 'off'>
              label={t('settings.showEnglish')}
              value={settings.showEnglish ? 'on' : 'off'}
              onChange={(v) => void update('showEnglish', v === 'on')}
              options={[
                { value: 'on', label: t('settings.show') },
                { value: 'off', label: t('settings.hide') }
              ]}
            />
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>{t('settings.language')}</span>
            <Segmented<Language>
              label={t('settings.language')}
              value={settings.language}
              onChange={(v) => void update('language', v)}
              options={[
                { value: 'zh-CN', label: '中文' },
                { value: 'en', label: 'English' }
              ]}
            />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="settings-data">
          <h2 id="settings-data" className={styles.sectionTitle}>
            {t('data.title')}
          </h2>
          <div className={styles.item}>
            <div className={styles.itemText}>
              <div className={styles.itemLabel}>{t('data.backup')}</div>
              <div className={styles.itemDesc}>{t('data.backupDesc')}</div>
            </div>
            <button type="button" className="btn" onClick={() => void backup()} disabled={busy}>
              <DownloadIcon size={16} />
              {t('data.exportBackup')}
            </button>
          </div>
          <div className={styles.item}>
            <div className={styles.itemText}>
              <div className={styles.itemLabel}>{t('data.restore')}</div>
              <div className={`${styles.itemDesc} ${styles.warning}`}>{t('data.restoreDesc')}</div>
            </div>
            <button type="button" className="btn" onClick={() => void restore()} disabled={busy}>
              <UploadIcon size={16} />
              {t('data.chooseBackup')}
            </button>
          </div>
          <div className={styles.item}>
            <div className={styles.itemText}>
              <div className={styles.itemLabel}>{t('data.templatesTitle')}</div>
              <div className={styles.itemDesc}>{t('data.templatesDesc')}</div>
            </div>
            <button type="button" className="btn" onClick={() => void saveTemplate('markdown', t)}>
              Markdown
            </button>
            <button type="button" className="btn" onClick={() => void saveTemplate('excel', t)}>
              Excel
            </button>
            <ImportGuide />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="settings-about">
          <h2 id="settings-about" className={styles.sectionTitle}>
            {t('settings.about')}
          </h2>
          <div className={styles.item}>
            <div className={styles.itemText}>
              <div className={styles.itemLabel}>{t('settings.version', { version })}</div>
              <div className={styles.itemDesc}>
                <a href="https://github.com/Hongyu3273/question-bank" target="_blank" rel="noreferrer">
                  {t('settings.homepage')}
                </a>
              </div>
            </div>
          </div>
          <div className={styles.item}>
            <div className={styles.itemText}>
              <div className={styles.itemLabel}>{t('settings.dataFolder')}</div>
              <div className={styles.itemDesc}>{t('settings.dataFolderDesc')}</div>
            </div>
            <button type="button" className="btn" onClick={() => void window.api.app.openDataFolder()}>
              <FolderIcon size={16} />
              {t('settings.openDataFolder')}
            </button>
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
