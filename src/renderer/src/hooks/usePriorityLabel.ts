import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/** 优先级标签文字:高 → "高优先级" / "High" */
export function usePriorityLabel(): (p: string) => string {
  const { t } = useTranslation()
  return useCallback((p: string) => t(`meta.priority.${p}`, { defaultValue: t('meta.priorityOther', { p }) }), [t])
}
