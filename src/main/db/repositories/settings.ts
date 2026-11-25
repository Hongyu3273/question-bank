import type Database from 'better-sqlite3'
import { DEFAULT_SETTINGS, type Settings } from '../../../shared/types'

/** 设置项的取值校验,防止界面传入非法值写进数据库 */
const validators: { [K in keyof Settings]: (v: unknown) => v is Settings[K] } = {
  theme: (v): v is Settings['theme'] => v === 'light' || v === 'dark' || v === 'system',
  fontSize: (v): v is Settings['fontSize'] => v === 's' || v === 'm' || v === 'l',
  language: (v): v is Settings['language'] => v === 'zh-CN' || v === 'en',
  selectedBankIds: (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
}

export function isSettingKey(key: unknown): key is keyof Settings {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(validators, key)
}

export function isValidSettingValue<K extends keyof Settings>(key: K, value: unknown): value is Settings[K] {
  return validators[key](value)
}

export function getAllSettings(db: Database.Database): Settings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const result: Settings = { ...DEFAULT_SETTINGS }
  for (const { key, value } of rows) {
    if (!isSettingKey(key)) continue
    try {
      const parsed: unknown = JSON.parse(value)
      if (isValidSettingValue(key, parsed)) {
        ;(result as unknown as Record<string, unknown>)[key] = parsed
      }
    } catch {
      // 值损坏时忽略,使用默认值
    }
  }
  return result
}

export function setSetting<K extends keyof Settings>(db: Database.Database, key: K, value: Settings[K]): void {
  writeRaw(db, key, value)
}

/** 程序内部使用的键值(例如窗口位置),不对界面开放 */
export function readInternal<T>(db: Database.Database, key: string): T | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`internal.${key}`) as
    | { value: string }
    | undefined
  if (!row) return undefined
  try {
    return JSON.parse(row.value) as T
  } catch {
    return undefined
  }
}

export function writeInternal(db: Database.Database, key: string, value: unknown): void {
  writeRaw(db, `internal.${key}`, value)
}

function writeRaw(db: Database.Database, key: string, value: unknown): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, JSON.stringify(value))
}
