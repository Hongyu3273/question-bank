import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../stores/ui'
import styles from './ShortcutHelp.module.css'

const GROUPS: { title: string; items: [string[], string][] }[] = [
  { title: 'global', items: [[['?'], 'help'], [['Esc'], 'close']] },
  {
    title: 'read',
    items: [
      [['Ctrl', 'F'], 'search'],
      [['Enter'], 'nextMatch'],
      [['Shift', 'Enter'], 'prevMatch'],
      [['←', '→'], 'focusSwitch']
    ]
  },
  {
    title: 'recite',
    items: [
      [['Space'], 'toggleAnswer'],
      [['←', '→'], 'switchQuestion']
    ]
  },
  {
    title: 'manage',
    items: [
      [['Ctrl', 'S'], 'save'],
      [['↑', '↓'], 'switchQuestion'],
      [['Alt', '↑ / ↓'], 'reorder']
    ]
  }
]

/** 快捷键说明。任意页面按 ? 打开 */
export default function ShortcutHelp() {
  const { t } = useTranslation()
  const open = useUiStore((s) => s.shortcutsOpen)
  const setOpen = useUiStore((s) => s.setShortcutsOpen)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable="true"], .cm-editor')) return
      if (document.querySelector('dialog[open]')) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="shortcuts-title"
      onCancel={(e) => {
        e.preventDefault()
        setOpen(false)
      }}
    >
      {open && (
        <>
          <h2 id="shortcuts-title" className={styles.title}>
            {t('shortcuts.title')}
          </h2>
          <div className={styles.groups}>
            {GROUPS.map((g) => (
              <section key={g.title}>
                <h3 className={styles.groupTitle}>{t(`shortcuts.group_${g.title}`)}</h3>
                <dl className={styles.list}>
                  {g.items.map(([keys, action]) => (
                    <div key={action + keys.join()} className={styles.row}>
                      <dt>{t(`shortcuts.${action}`)}</dt>
                      <dd>
                        {keys.map((k) => (
                          <kbd key={k} className={styles.kbd}>
                            {k === 'Space' ? t('recite.space') : k}
                          </kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)} autoFocus>
              {t('import.done')}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
