import { app } from 'electron'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { Db } from './database'
import { runMigrations } from './migrations'

let db: Db | null = null

/** 打开数据库并执行迁移。应用启动时调用一次。 */
export async function openDb(file = join(app.getPath('userData'), 'app.db')): Promise<Db> {
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
