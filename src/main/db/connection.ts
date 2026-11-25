import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

/** 打开数据库并执行迁移。应用启动时调用一次。 */
export function openDb(file = join(app.getPath('userData'), 'app.db')): Database.Database {
  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('数据库尚未打开')
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
