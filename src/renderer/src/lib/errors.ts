import type { TFunction } from 'i18next'
import { parseErrorCode } from '@shared/errors'

/** 把主进程返回的错误翻译成当前语言的提示 */
export function errorMessage(err: unknown, t: TFunction): string {
  const code = parseErrorCode(err)
  if (code) return t(`errors.${code}`)
  console.error(err)
  return t('errors.UNKNOWN')
}
