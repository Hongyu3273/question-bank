import { app } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { Db } from './database'
import { runMigrations } from './migrations'

let db: Db | null = null

/** 数据库文件路径 */
export function dbFilePath(): string {
  return join(app.getPath('userData'), 'app.db')
}

/** 打开数据库并执行迁移。应用启动时、恢复备份后调用。 */
export async function openDb(file = dbFilePath()): Promise<Db> {
  const require = createRequire(__filename)
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  db = await Db.open(file, wasmPath)
  runMigrations(db)
  return db
}

export function getDb(): Db {
  if (!db) throw new Error('数据库尚未打开')
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
