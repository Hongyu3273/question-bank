import { useEffect, useState } from 'react'

const read = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')

/** 当前实际生效的主题(跟随系统时已解析为浅色或深色) */
export function useResolvedTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])
  return theme
}
