import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { NO_PRIORITY } from '@shared/meta'

/** 优先级标签文字:高 → "高优先级" / "High" */
export function usePriorityLabel(): (p: string) => string {
  const { t } = useTranslation()
  return useCallback(
    (p: string) =>
      p === NO_PRIORITY ? t('meta.none') : t(`meta.priority.${p}`, { defaultValue: t('meta.priorityOther', { p }) }),
    [t]
  )
}
