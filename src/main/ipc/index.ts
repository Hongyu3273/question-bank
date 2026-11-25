import { app, ipcMain, nativeTheme } from 'electron'
import { AppError } from '../../shared/errors'
import { IPC } from '../../shared/ipc'
import type { AppInfo } from '../../shared/types'
import { getDb } from '../db/connection'
import { createBank, deleteBank, getBank, listBanks, renameBank } from '../db/repositories/banks'
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  listQuestionsForBanks,
  updateQuestion
} from '../db/repositories/questions'
import { getAllSettings, isSettingKey, isValidSettingValue, setSetting } from '../db/repositories/settings'
import type { AssetStore } from '../services/assets'

/** 界面传来的参数不可信,先确认类型 */
function str(value: unknown): string {
  if (typeof value !== 'string') throw new AppError('INVALID_ARGUMENT')
  return value
}

export function registerIpc(assets: AssetStore): void {
  // 题库
  ipcMain.handle(IPC.banksList, () => listBanks(getDb()))
  ipcMain.handle(IPC.banksCreate, (_e, name: unknown) => createBank(getDb(), name))
  ipcMain.handle(IPC.banksRename, (_e, id: unknown, name: unknown) => renameBank(getDb(), str(id), name))
  ipcMain.handle(IPC.banksDelete, (_e, id: unknown) => {
    const bankId = str(id)
    getBank(getDb(), bankId)
    deleteBank(getDb(), bankId)
    assets.deleteBank(bankId)
  })

  // 题目
  ipcMain.handle(IPC.questionsList, (_e, bankId: unknown) => listQuestions(getDb(), str(bankId)))
  ipcMain.handle(IPC.questionsGet, (_e, id: unknown) => getQuestion(getDb(), str(id)))
  ipcMain.handle(IPC.questionsCreate, (_e, bankId: unknown, input: unknown) =>
    createQuestion(getDb(), str(bankId), input)
  )
  ipcMain.handle(IPC.questionsUpdate, (_e, id: unknown, input: unknown) => updateQuestion(getDb(), str(id), input))
  ipcMain.handle(IPC.questionsDelete, (_e, id: unknown) => deleteQuestion(getDb(), str(id)))
  ipcMain.handle(IPC.questionsSaveImage, (_e, bankId: unknown, data: unknown, mimeType: unknown) => {
    const id = str(bankId)
    getBank(getDb(), id)
    if (!(data instanceof Uint8Array)) throw new AppError('INVALID_ARGUMENT')
    return assets.saveImage(id, data, str(mimeType))
  })

  // 看题
  ipcMain.handle(IPC.readList, (_e, bankIds: unknown) => listQuestionsForBanks(getDb(), bankIds))

  // 设置
  ipcMain.handle(IPC.settingsGetAll, () => getAllSettings(getDb()))
  ipcMain.handle(IPC.settingsSet, (_e, key: unknown, value: unknown) => {
    if (!isSettingKey(key) || !isValidSettingValue(key, value)) throw new AppError('INVALID_ARGUMENT')
    setSetting(getDb(), key, value)
    // 主题同步给系统层,窗口标题栏和 prefers-color-scheme 会随之变化
    if (key === 'theme') nativeTheme.themeSource = value as typeof nativeTheme.themeSource
  })

  ipcMain.handle(IPC.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform
  }))
}
