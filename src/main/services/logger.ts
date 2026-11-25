// 日志:写到数据文件夹下的 logs/main.log,超过 1 MB 时轮换为 main.1.log(只保留一份旧日志)。
// 打包后的软件没有命令行窗口,出问题时把这个文件发过来就能排查。

import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX_BYTES = 1024 * 1024
let dir: string | null = null

export type LogLevel = 'info' | 'warn' | 'error'

/** 设置日志目录;在 app ready 后调用一次 */
export function initLogger(logDir: string): void {
  dir = logDir
  mkdirSync(dir, { recursive: true })
}

export function logDirectory(): string | null {
  return dir
}

function describe(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ''}`.trimEnd()
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function log(level: LogLevel, message: string, detail?: unknown): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${detail === undefined ? '' : ` ${describe(detail)}`}\n`
  if (level === 'error') console.error(line.trimEnd())
  else console.log(line.trimEnd())
  if (!dir) return
  try {
    const file = join(dir, 'main.log')
    if (existsSync(file) && statSync(file).size > MAX_BYTES) {
      const old = join(dir, 'main.1.log')
      rmSync(old, { force: true })
      renameSync(file, old)
    }
    appendFileSync(file, line, 'utf8')
  } catch {
    // 写日志失败不能影响正常使用
  }
}
