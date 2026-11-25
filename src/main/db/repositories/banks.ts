import type { BankSummary } from '../../../shared/types'
import type { Db } from '../database'

export function listBanks(db: Db): BankSummary[] {
  return db.all<BankSummary>(
    `SELECT b.id, b.name, b.sort_order AS sortOrder, b.created_at AS createdAt, b.updated_at AS updatedAt,
            COUNT(q.id) AS questionCount
       FROM banks b
       LEFT JOIN questions q ON q.bank_id = b.id
      GROUP BY b.id
      ORDER BY b.sort_order, b.created_at`
  )
}
