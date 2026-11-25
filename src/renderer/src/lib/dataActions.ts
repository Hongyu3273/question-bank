import type { TFunction } from 'i18next'
import { useImportStore } from '../stores/import'
import { useToastStore } from '../stores/toast'
import { errorMessage } from './errors'

const toast = (message: string, ms?: number) => useToastStore.getState().show(message, ms)

/** 选择文件导入题库;结果显示在导入结果弹窗里 */
export async function startImport(t: TFunction): Promise<void> {
  try {
    await useImportStore.getState().start()
  } catch (err) {
    toast(errorMessage(err, t), 3000)
  }
}

/** 导出题库为 zip */
export async function exportBank(bankId: string, t: TFunction): Promise<void> {
  try {
    const r = await window.api.io.exportBank(bankId)
    if (!r.canceled) toast(t('data.savedTo', { path: r.path }), 3500)
  } catch (err) {
    toast(errorMessage(err, t), 3000)
  }
}

/** 保存导入模板 */
export async function saveTemplate(kind: 'markdown' | 'excel', t: TFunction): Promise<void> {
  try {
    const r = await window.api.io.saveTemplate(kind)
    if (!r.canceled) toast(t('data.savedTo', { path: r.path }), 3500)
  } catch (err) {
    toast(errorMessage(err, t), 3000)
  }
}
