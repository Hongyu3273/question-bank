import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors'
import { LIMITS, type BankSummary } from '../../../shared/types'
import type { Db } from '../database'

const SELECT_SUMMARY = `
  SELECT b.id, b.name, b.sort_order AS sortOrder, b.created_at AS createdAt, b.updated_at AS updatedAt,
         COUNT(q.id) AS questionCount
    FROM banks b
    LEFT JOIN questions q ON q.bank_id = b.id`

export function listBanks(db: Db): BankSummary[] {
  return db.all<BankSummary>(`${SELECT_SUMMARY} GROUP BY b.id ORDER BY b.sort_order, b.created_at`)
}

export function getBank(db: Db, id: string): BankSummary {
  const bank = db.get<BankSummary>(`${SELECT_SUMMARY} WHERE b.id = ? GROUP BY b.id`, [id])
  if (!bank) throw new AppError('BANK_NOT_FOUND')
  return bank
}

/** 校验并规范化题库名:去掉首尾空白,不能为空、不能过长、不能与其他题库重名 */
function normalizeName(db: Db, raw: unknown, excludeId?: string): string {
  if (typeof raw !== 'string') throw new AppError('INVALID_ARGUMENT')
  const name = raw.trim()
  if (!name) throw new AppError('BANK_NAME_EMPTY')
  if (name.length > LIMITS.bankName) throw new AppError('BANK_NAME_TOO_LONG')
  const clash = db.get<{ id: string }>('SELECT id FROM banks WHERE name = ?', [name])
  if (clash && clash.id !== excludeId) throw new AppError('BANK_NAME_EXISTS')
  return name
}

export function createBank(db: Db, rawName: unknown): BankSummary {
  const name = normalizeName(db, rawName)
  const id = randomUUID()
  const now = Date.now()
  const next = db.get<{ n: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM banks')?.n ?? 0
  db.run('INSERT INTO banks (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    name,
    next,
    now,
    now
  ])
  return getBank(db, id)
}

export function renameBank(db: Db, id: string, rawName: unknown): void {
  getBank(db, id)
  const name = normalizeName(db, rawName, id)
  db.run('UPDATE banks SET name = ?, updated_at = ? WHERE id = ?', [name, Date.now(), id])
}

/** 删除题库;题目通过外键级联删除 */
export function deleteBank(db: Db, id: string): void {
  getBank(db, id)
  db.run('DELETE FROM banks WHERE id = ?', [id])
}

export function touchBank(db: Db, id: string): void {
  db.run('UPDATE banks SET updated_at = ? WHERE id = ?', [Date.now(), id])
}
