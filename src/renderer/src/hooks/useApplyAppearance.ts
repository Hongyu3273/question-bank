import { useEffect, useState } from 'react'
import i18n from '../i18n'
import type { FontSize, Settings } from '@shared/types'

const FONT_SCALE: Record<FontSize, string> = { s: '0.9', m: '1', l: '1.15' }

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

/** 把主题、字号、语言设置应用到页面 */
export function useApplyAppearance(settings: Settings | null): void {
  const systemDark = useSystemDark()

  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
    root.dataset.theme = dark ? 'dark' : 'light'
    root.style.setProperty('--font-scale', FONT_SCALE[settings.fontSize])
    root.lang = settings.language
    if (i18n.language !== settings.language) void i18n.changeLanguage(settings.language)
  }, [settings, systemDark])
}
