import type Database from 'better-sqlite3'
import type { BankSummary } from '../../../shared/types'

export function listBanks(db: Database.Database): BankSummary[] {
  return db
    .prepare(
      `SELECT b.id, b.name, b.sort_order AS sortOrder, b.created_at AS createdAt, b.updated_at AS updatedAt,
              COUNT(q.id) AS questionCount
         FROM banks b
         LEFT JOIN questions q ON q.bank_id = b.id
        GROUP BY b.id
        ORDER BY b.sort_order, b.created_at`
    )
    .all() as BankSummary[]
}
