import type Database from 'better-sqlite3'

type Migration = (db: Database.Database) => void

/**
 * 数据库迁移列表。下标 i 的迁移把数据库从版本 i 升级到 i + 1。
 * 已发布的迁移不要修改,只在末尾追加新的迁移。
 */
const migrations: Migration[] = [
  // v1:初始表结构
  (db) => {
    db.exec(`
      CREATE TABLE banks (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE questions (
        id          TEXT PRIMARY KEY,
        bank_id     TEXT NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        answer_md   TEXT NOT NULL DEFAULT '',
        sort_order  INTEGER NOT NULL,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
      CREATE INDEX idx_questions_bank ON questions(bank_id, sort_order);

      CREATE TABLE settings (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
      );

      CREATE TABLE recite_session (
        id          INTEGER PRIMARY KEY CHECK (id = 1),
        bank_ids    TEXT NOT NULL,
        queue       TEXT NOT NULL,
        position    INTEGER NOT NULL,
        round       INTEGER NOT NULL DEFAULT 1,
        updated_at  INTEGER NOT NULL
      );
    `)
  }
]

export const SCHEMA_VERSION = migrations.length

export function runMigrations(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  if (current > SCHEMA_VERSION) {
    throw new Error(`数据库版本(${current})高于当前程序支持的版本(${SCHEMA_VERSION}),请更新软件。`)
  }
  const upgrade = db.transaction(() => {
    for (let v = current; v < SCHEMA_VERSION; v++) {
      migrations[v](db)
      db.pragma(`user_version = ${v + 1}`)
    }
  })
  upgrade()
}
