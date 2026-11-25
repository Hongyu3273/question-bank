import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { autoBackupPath, KEEP_AUTO_BACKUPS, listAutoBackups, runDailyBackup } from '../../src/main/services/autoBackup'

const day = (d: number) => new Date(2026, 10, d, 9)

describe('每日自动备份', () => {
  it('每天只备份一次,只保留最近 7 份', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qb-auto-'))
    let made = 0
    const make = () => {
      made++
      return new Uint8Array([1, 2, 3])
    }
    expect(runDailyBackup(dir, make, day(1))).toBe('auto-2026-11-01.qbak')
    expect(runDailyBackup(dir, make, day(1))).toBeNull()
    expect(made).toBe(1)
    for (let d = 2; d <= 10; d++) runDailyBackup(dir, make, day(d))
    const list = listAutoBackups(dir)
    expect(list).toHaveLength(KEEP_AUTO_BACKUPS)
    expect(list[0]).toMatchObject({ name: 'auto-2026-11-10.qbak', date: '2026-11-10', size: 3 })
    expect(list.at(-1)!.date).toBe('2026-11-04')
    expect(readdirSync(dir).some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('只接受自动备份文件名', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qb-auto-'))
    writeFileSync(join(dir, 'auto-2026-11-01.qbak'), 'x')
    expect(autoBackupPath(dir, 'auto-2026-11-01.qbak')).toBe(join(dir, 'auto-2026-11-01.qbak'))
    expect(() => autoBackupPath(dir, '../app.db')).toThrow()
    expect(() => autoBackupPath(dir, 'auto-2026-11-02.qbak')).toThrow()
  })
})
