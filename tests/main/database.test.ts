import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBank, listBanks } from '../../src/main/db/repositories/banks'
import { createQuestion } from '../../src/main/db/repositories/questions'
import { getAllSettings, setSetting } from '../../src/main/db/repositories/settings'
import { SCHEMA_VERSION } from '../../src/main/db/migrations'
import { openTestDb } from '../helpers'

let dir: string | null = null
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

describe('Db 与迁移', () => {
  it('迁移到最新版本', async () => {
    const db = await openTestDb()
    expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(SCHEMA_VERSION)
  })

  it('写入后保存到磁盘,重新打开数据还在', async () => {
    dir = mkdtempSync(join(tmpdir(), 'qb-'))
    const file = join(dir, 'app.db')
    let db = await openTestDb(file)
    const bank = createBank(db, 'Java 基础')
    createQuestion(db, bank.id, { title: '题干', answerMd: '答案' })
    setSetting(db, 'theme', 'dark')
    db.close()

    db = await openTestDb(file)
    expect(listBanks(db)).toMatchObject([{ name: 'Java 基础', questionCount: 1 }])
    expect(getAllSettings(db).theme).toBe('dark')
    db.close()
  })

  it('保存后外键约束仍然生效', async () => {
    dir = mkdtempSync(join(tmpdir(), 'qb-'))
    const db = await openTestDb(join(dir, 'app.db'))
    createBank(db, 'A') // 触发一次保存(export 会重开连接)
    expect(() =>
      db.run('INSERT INTO questions (id, bank_id, title, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?)', [
        'q',
        'missing',
        't',
        0,
        0,
        0
      ])
    ).toThrow()
    db.close()
  })

  it('事务出错时回滚', async () => {
    const db = await openTestDb()
    expect(() =>
      db.transaction(() => {
        createBank(db, 'A')
        throw new Error('boom')
      })
    ).toThrow('boom')
    expect(listBanks(db)).toHaveLength(0)
  })
})
