// 每日自动备份:每天第一次运行时把全部数据备份到数据文件夹下的 backups/,保留最近 7 份。

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AutoBackup } from '../../shared/types'
import { AppError } from '../../shared/errors'

export const KEEP_AUTO_BACKUPS = 7
const NAME = /^auto-(\d{4}-\d{2}-\d{2})\.qbak$/

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 今天还没有自动备份时创建一份,并删除多余的旧备份。返回新建的文件名,没有新建时返回 null */
export function runDailyBackup(dir: string, makeBackup: () => Uint8Array, now = new Date()): string | null {
  mkdirSync(dir, { recursive: true })
  const name = `auto-${dateKey(now)}.qbak`
  let created: string | null = null
  if (!existsSync(join(dir, name))) {
    // 先写临时文件再改名,避免中途退出留下损坏的备份
    const tmp = join(dir, `${name}.tmp`)
    writeFileSync(tmp, makeBackup())
    renameSync(tmp, join(dir, name))
    created = name
  }
  const all = listAutoBackups(dir)
  for (const old of all.slice(KEEP_AUTO_BACKUPS)) rmSync(join(dir, old.name), { force: true })
  return created
}

/** 自动备份列表,最新的在前 */
export function listAutoBackups(dir: string): AutoBackup[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((name) => ({ name, match: NAME.exec(name) }))
    .filter((x): x is { name: string; match: RegExpExecArray } => x.match !== null)
    .map(({ name, match }) => ({ name, date: match[1], size: statSync(join(dir, name)).size }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** 自动备份文件的完整路径;只接受 auto-YYYY-MM-DD.qbak 这样的文件名 */
export function autoBackupPath(dir: string, name: unknown): string {
  if (typeof name !== 'string' || !NAME.test(name) || !existsSync(join(dir, name))) {
    throw new AppError('INVALID_ARGUMENT')
  }
  return join(dir, name)
}
