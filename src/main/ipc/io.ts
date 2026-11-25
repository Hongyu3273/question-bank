import { app, BrowserWindow, dialog, ipcMain, nativeTheme, type IpcMainInvokeEvent } from 'electron'
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { AppError, parseErrorCode } from '../../shared/errors'
import { IPC, type SaveResult } from '../../shared/ipc'
import type { ImportResult } from '../../shared/types'
import { closeDb, dbFilePath, getDb, openDb } from '../db/connection'
import { getAllSettings } from '../db/repositories/settings'
import type { AssetStore } from '../services/assets'
import { autoBackupPath, listAutoBackups } from '../services/autoBackup'
import { createBackup, readBackup, replaceData } from '../services/backup'
import { log } from '../services/logger'
import { excelTemplate, exportBankZip, markdownTemplate } from '../services/exporter'
import { importLoaded, loadImportFile, resolveConflict } from '../services/importer'

const MAX_FILE_BYTES = 1024 * 1024 * 1024

/** 对话框文字跟随界面语言 */
function texts() {
  const zh = getAllSettings(getDb()).language !== 'en'
  return {
    importTitle: zh ? '导入题库' : 'Import question banks',
    bankFiles: zh ? '题库文件' : 'Question bank files',
    exportTitle: zh ? '导出题库' : 'Export question bank',
    templateTitle: zh ? '保存模板' : 'Save template',
    backupTitle: zh ? '备份全部数据' : 'Back up all data',
    restoreTitle: zh ? '从备份恢复' : 'Restore from backup',
    backupFiles: zh ? '题库备份' : 'Question bank backup',
    zip: zh ? 'Zip 压缩包' : 'Zip archive',
    excel: 'Excel'
  }
}

const windowOf = (e: IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender) ?? undefined

async function saveTo(
  e: IpcMainInvokeEvent,
  title: string,
  defaultName: string,
  filter: { name: string; extensions: string[] },
  data: Uint8Array
): Promise<SaveResult> {
  const win = windowOf(e)
  const options = { title, defaultPath: join(app.getPath('documents'), defaultName), filters: [filter] }
  const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (canceled || !filePath) return { canceled: true }
  await writeFile(filePath, data)
  return { canceled: false, path: filePath }
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** 自动备份所在的文件夹 */
export function autoBackupDir(): string {
  return join(app.getPath('userData'), 'backups')
}

export function registerIoIpc(assets: AssetStore, assetsRoot: string): void {
  ipcMain.handle(IPC.ioImport, async (e) => {
    const t = texts()
    const win = windowOf(e)
    const options: Electron.OpenDialogOptions = {
      title: t.importTitle,
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: t.bankFiles, extensions: ['zip', 'md', 'xlsx'] }]
    }
    const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (canceled || filePaths.length === 0) return { canceled: true }

    const results: ImportResult[] = []
    for (const path of filePaths) {
      const file = basename(path)
      try {
        if ((await stat(path)).size > MAX_FILE_BYTES) throw new AppError('ARCHIVE_TOO_LARGE')
        const loaded = await loadImportFile(path, await readFile(path))
        results.push(...importLoaded(getDb(), assets, loaded))
      } catch (err) {
        console.error(err)
        results.push({ file, status: 'failed', error: parseErrorCode(err) ?? 'UNKNOWN' })
      }
    }
    return { canceled: false, results }
  })

  ipcMain.handle(IPC.ioResolveConflict, (_e, token: unknown, choice: unknown) =>
    resolveConflict(getDb(), assets, token, choice)
  )

  ipcMain.handle(IPC.ioExportBank, async (e, bankId: unknown) => {
    if (typeof bankId !== 'string') throw new AppError('INVALID_ARGUMENT')
    const t = texts()
    const { fileName, data } = exportBankZip(getDb(), assets, bankId)
    return saveTo(e, t.exportTitle, fileName, { name: t.zip, extensions: ['zip'] }, data)
  })

  ipcMain.handle(IPC.ioSaveTemplate, async (e, kind: unknown) => {
    const t = texts()
    const language = getAllSettings(getDb()).language
    if (kind === 'markdown') {
      const { fileName, data } = markdownTemplate(language)
      return saveTo(e, t.templateTitle, fileName, { name: t.zip, extensions: ['zip'] }, data)
    }
    if (kind === 'excel') {
      const { fileName, data } = await excelTemplate(language)
      return saveTo(e, t.templateTitle, fileName, { name: t.excel, extensions: ['xlsx'] }, data)
    }
    throw new AppError('INVALID_ARGUMENT')
  })

  ipcMain.handle(IPC.ioBackup, async (e) => {
    const t = texts()
    const zh = getAllSettings(getDb()).language !== 'en'
    const name = `${zh ? '知识题库备份' : 'question-bank-backup'}-${timestamp()}.qbak`
    const data = createBackup(getDb(), assets, app.getVersion())
    return saveTo(e, t.backupTitle, name, { name: t.backupFiles, extensions: ['qbak'] }, data)
  })

  ipcMain.handle(IPC.ioRestore, async (e) => {
    const t = texts()
    const win = windowOf(e)
    const options: Electron.OpenDialogOptions = {
      title: t.restoreTitle,
      properties: ['openFile'],
      filters: [{ name: t.backupFiles, extensions: ['qbak', 'zip'] }]
    }
    const { canceled, filePaths } = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (canceled || filePaths.length === 0) return { canceled: true }

    await restoreFrom(await readFile(filePaths[0]))
    return { canceled: false }
  })

  /** 用备份文件的内容替换全部数据 */
  const restoreFrom = async (bytes: Uint8Array) => {
    const backup = readBackup(bytes)
    closeDb()
    const file = dbFilePath()
    await replaceData(file, assetsRoot, backup, async () => {
      await openDb(file)
    })
    nativeTheme.themeSource = getAllSettings(getDb()).theme
    log('info', 'data restored from backup')
  }

  const backupDir = autoBackupDir()
  ipcMain.handle(IPC.ioAutoBackups, () => listAutoBackups(backupDir))
  ipcMain.handle(IPC.ioRestoreAuto, async (_e, name: unknown) => {
    await restoreFrom(await readFile(autoBackupPath(backupDir, name)))
  })
}
