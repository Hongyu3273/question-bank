import type { Db } from './database'

type Migration = (db: Db) => void

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
  },
  // v2:背题会话记录优先级筛选条件(JSON 数组,空数组表示全部)
  (db) => {
    db.exec(`ALTER TABLE recite_session ADD COLUMN filter TEXT NOT NULL DEFAULT '[]'`)
  },
  // v3:记忆曲线(FSRS)。每道题一张复习卡片,每次自评一条记录;题库增加每日新题数和复习上限
  (db) => {
    db.exec(`
      ALTER TABLE banks ADD COLUMN new_per_day INTEGER NOT NULL DEFAULT 10;
      ALTER TABLE banks ADD COLUMN review_per_day INTEGER NOT NULL DEFAULT 100;

      CREATE TABLE review_cards (
        question_id       TEXT PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
        state             INTEGER NOT NULL,
        due               INTEGER NOT NULL,
        stability         REAL NOT NULL,
        difficulty        REAL NOT NULL,
        scheduled_days    INTEGER NOT NULL,
        learning_steps    INTEGER NOT NULL,
        reps              INTEGER NOT NULL,
        lapses            INTEGER NOT NULL,
        last_review       INTEGER,
        in_wrong_book     INTEGER NOT NULL DEFAULT 0,
        wrong_streak      INTEGER NOT NULL DEFAULT 0,
        wrong_streak_day  TEXT,
        wrong_added_at    INTEGER
      );
      CREATE INDEX idx_review_cards_due ON review_cards(due);
      CREATE INDEX idx_review_cards_wrong ON review_cards(in_wrong_book);

      CREATE TABLE review_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id     TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        bank_id         TEXT NOT NULL,
        grade           INTEGER NOT NULL,
        reviewed_at     INTEGER NOT NULL,
        day             TEXT NOT NULL,
        was_new         INTEGER NOT NULL,
        counted_review  INTEGER NOT NULL,
        ahead           INTEGER NOT NULL DEFAULT 0,
        prev_card       TEXT
      );
      CREATE INDEX idx_review_logs_day ON review_logs(day, bank_id);
    `)
  }
]

export const SCHEMA_VERSION = migrations.length

export function runMigrations(db: Db): void {
  const current = db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
  if (current > SCHEMA_VERSION) {
    throw new Error(`数据库版本(${current})高于当前程序支持的版本(${SCHEMA_VERSION}),请更新软件。`)
  }
  if (current === SCHEMA_VERSION) return
  db.transaction(() => {
    for (let v = current; v < SCHEMA_VERSION; v++) {
      migrations[v](db)
      db.exec(`PRAGMA user_version = ${v + 1}`)
    }
  })
}
