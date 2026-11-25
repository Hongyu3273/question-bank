import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FontSize, Language, Settings, ThemeMode } from '@shared/types'
import { useSettingsStore } from '../../stores/settings'
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

  useEffect(() => {
    void window.api.app.info().then((info) => setVersion(info.version))
  }, [])

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('settings.title')}</h1>

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

        <section className={styles.section} aria-labelledby="settings-about">
          <h2 id="settings-about" className={styles.sectionTitle}>
            {t('settings.about')}
          </h2>
          <div className={styles.item}>
            <span className={styles.itemLabel}>{t('settings.version', { version })}</span>
          </div>
        </section>
      </div>
    </div>
  )
}
