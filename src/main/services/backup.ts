import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { AppError } from '../../shared/errors'
import type { Db } from '../db/database'
import { SCHEMA_VERSION } from '../db/migrations'
import { readZip, writeZip } from './archive'
import type { AssetStore } from './assets'

const APP_ID = 'question-bank'
const SQLITE_HEADER = 'SQLite format 3\u0000'

interface Manifest {
  app: string
  appVersion: string
  schemaVersion: number
  createdAt: number
}

/** 备份文件:manifest.json + app.db + assets/(全部图片),zip 格式,扩展名 .qbak */
export function createBackup(db: Db, assets: AssetStore, appVersion: string): Uint8Array {
  const entries = new Map<string, Uint8Array>()
  const manifest: Manifest = { app: APP_ID, appVersion, schemaVersion: SCHEMA_VERSION, createdAt: Date.now() }
  entries.set('manifest.json', new TextEncoder().encode(JSON.stringify(manifest, null, 2)))
  entries.set('app.db', db.exportBytes())
  const banks = db.all<{ id: string }>('SELECT id FROM banks')
  for (const { id } of banks) {
    for (const [path, content] of assets.readBankFiles(id)) entries.set(`assets/${id}/${path}`, content)
  }
  return writeZip(entries)
}

/** 读取并检查备份文件,返回数据库内容和图片 */
export function readBackup(data: Uint8Array): { db: Uint8Array; assets: Map<string, Uint8Array> } {
  let entries: Map<string, Uint8Array>
  try {
    entries = readZip(data)
  } catch {
    throw new AppError('BACKUP_INVALID')
  }
  const manifestRaw = entries.get('manifest.json')
  const db = entries.get('app.db')
  if (!manifestRaw || !db) throw new AppError('BACKUP_INVALID')
  let manifest: Manifest
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestRaw)) as Manifest
  } catch {
    throw new AppError('BACKUP_INVALID')
  }
  if (manifest.app !== APP_ID || typeof manifest.schemaVersion !== 'number') throw new AppError('BACKUP_INVALID')
  if (manifest.schemaVersion > SCHEMA_VERSION) throw new AppError('BACKUP_TOO_NEW')
  if (new TextDecoder('latin1').decode(db.slice(0, 16)) !== SQLITE_HEADER) throw new AppError('BACKUP_INVALID')
  const assets = new Map<string, Uint8Array>()
  for (const [path, content] of entries) {
    if (/^assets\/[0-9a-f-]{36}\//.test(path)) assets.set(path.slice('assets/'.length), content)
  }
  return { db, assets }
}

/**
 * 用备份替换当前数据。调用前须关闭数据库,完成后由调用方重新打开。
 * 原数据先移到临时目录;reopen 失败时自动还原。
 */
export async function replaceData(
  dbFile: string,
  assetsRoot: string,
  backup: { db: Uint8Array; assets: Map<string, Uint8Array> },
  reopen: () => Promise<void>
): Promise<void> {
  const holding = join(dirname(dbFile), `.restore-${Date.now()}`)
  mkdirSync(holding, { recursive: true })
  const moved: [string, string][] = []
  const move = (from: string, to: string) => {
    if (existsSync(from)) {
      renameSync(from, to)
      moved.push([from, to])
    }
  }
  try {
    move(dbFile, join(holding, 'app.db'))
    move(`${dbFile}.tmp`, join(holding, 'app.db.tmp'))
    move(assetsRoot, join(holding, 'assets'))

    writeFileSync(dbFile, backup.db)
    const root = resolve(assetsRoot)
    for (const [path, content] of backup.assets) {
      const file = resolve(root, path)
      if (!file.startsWith(root + sep)) throw new AppError('BACKUP_INVALID')
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content)
    }
    await reopen()
  } catch (err) {
    // 还原原来的数据
    rmSync(dbFile, { force: true })
    rmSync(assetsRoot, { recursive: true, force: true })
    for (const [from, to] of moved.reverse()) renameSync(to, from)
    rmSync(holding, { recursive: true, force: true })
    await reopen().catch(() => undefined)
    throw err
  }
  rmSync(holding, { recursive: true, force: true })
}
