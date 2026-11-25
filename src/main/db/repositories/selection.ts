// 首页勾选的"题库"转成 SQL 条件。错题本(WRONG_BOOK_ID)不是真正的题库,
// 它代表 review_cards 中 in_wrong_book = 1 的题目。

import { WRONG_BOOK_ID } from '../../../shared/types'
import type { Db } from '../database'

/**
 * 返回 WHERE 条件和参数。alias 是 questions 表的别名。
 * 没有勾选任何题库时条件恒为假。
 */
export function selectionWhere(bankIds: readonly string[], alias = 'q'): { sql: string; params: string[] } {
  const banks = bankIds.filter((id) => id !== WRONG_BOOK_ID)
  const parts: string[] = []
  if (banks.length > 0) parts.push(`${alias}.bank_id IN (${banks.map(() => '?').join(', ')})`)
  if (bankIds.includes(WRONG_BOOK_ID)) {
    parts.push(`${alias}.id IN (SELECT question_id FROM review_cards WHERE in_wrong_book = 1)`)
  }
  return { sql: parts.length > 0 ? `(${parts.join(' OR ')})` : '0', params: banks }
}

/** 错题本中的题目数量 */
export function wrongBookCount(db: Db): number {
  return db.get<{ n: number }>('SELECT COUNT(*) AS n FROM review_cards WHERE in_wrong_book = 1')?.n ?? 0
}
