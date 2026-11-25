import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors'
import { markdownSnippet } from '../../../shared/markdown'
import { comparePriority, extractMeta, priorityOf, updateMeta } from '../../../shared/meta'
import {
  LIMITS,
  type PriorityScope,
  type PriorityStats,
  type Question,
  type QuestionInput,
  type QuestionSummary,
  type ReadBank,
  WRONG_BOOK_ID
} from '../../../shared/types'
import type { Db } from '../database'
import { getBank, touchBank } from './banks'
import { selectionWhere } from './selection'

const SELECT_QUESTION = `
  SELECT id, bank_id AS bankId, title, answer_md AS answerMd, sort_order AS sortOrder,
         created_at AS createdAt, updated_at AS updatedAt
    FROM questions`

export function listQuestions(db: Db, bankId: string): QuestionSummary[] {
  getBank(db, bankId)
  const rows = db.all<
    Omit<QuestionSummary, 'snippet' | 'priority' | 'studyStatus' | 'inWrongBook'> & {
      head: string
      state: number | null
      wrong: number | null
    }
  >(
    `SELECT q.id, q.bank_id AS bankId, q.title, q.sort_order AS sortOrder, q.updated_at AS updatedAt,
            substr(q.answer_md, 1, 400) AS head, c.state, c.in_wrong_book AS wrong
       FROM questions q LEFT JOIN review_cards c ON c.question_id = q.id
      WHERE q.bank_id = ? ORDER BY q.sort_order`,
    [bankId]
  )
  return rows.map(({ head, state, wrong, ...q }) => {
    const { meta, body } = extractMeta(head)
    // FSRS 状态:0 新题,1 学习中,2 复习,3 重学
    const studyStatus = state === null || state === 0 ? 'new' : state === 2 ? 'review' : 'learning'
    return {
      ...q,
      snippet: markdownSnippet(body),
      priority: meta.priority ?? null,
      studyStatus,
      inWrongBook: wrong === 1
    }
  })
}

export function getQuestion(db: Db, id: string): Question {
  const q = db.get<Question>(`${SELECT_QUESTION} WHERE id = ?`, [id])
  if (!q) throw new AppError('QUESTION_NOT_FOUND')
  return q
}

/** 校验并规范化题目内容:题干去掉首尾空白且不能为空;答案原样保存 */
function normalizeInput(input: unknown): QuestionInput {
  if (typeof input !== 'object' || input === null) throw new AppError('INVALID_ARGUMENT')
  const { title, answerMd } = input as Record<string, unknown>
  if (typeof title !== 'string' || typeof answerMd !== 'string') throw new AppError('INVALID_ARGUMENT')
  const t = title.trim()
  if (!t) throw new AppError('QUESTION_TITLE_EMPTY')
  if (t.length > LIMITS.questionTitle) throw new AppError('QUESTION_TITLE_TOO_LONG')
  if (answerMd.length > LIMITS.answer) throw new AppError('ANSWER_TOO_LONG')
  return { title: t, answerMd }
}

export function createQuestion(db: Db, bankId: string, rawInput: unknown): Question {
  const input = normalizeInput(rawInput)
  getBank(db, bankId)
  const id = randomUUID()
  const now = Date.now()
  db.transaction(() => {
    const next =
      db.get<{ n: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM questions WHERE bank_id = ?', [bankId])
        ?.n ?? 0
    db.run(
      `INSERT INTO questions (id, bank_id, title, answer_md, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, bankId, input.title, input.answerMd, next, now, now]
    )
    touchBank(db, bankId)
  })
  return getQuestion(db, id)
}

export function updateQuestion(db: Db, id: string, rawInput: unknown): Question {
  const input = normalizeInput(rawInput)
  const existing = getQuestion(db, id)
  db.transaction(() => {
    db.run('UPDATE questions SET title = ?, answer_md = ?, updated_at = ? WHERE id = ?', [
      input.title,
      input.answerMd,
      Date.now(),
      id
    ])
    touchBank(db, existing.bankId)
  })
  return getQuestion(db, id)
}

export function deleteQuestion(db: Db, id: string): void {
  const existing = getQuestion(db, id)
  db.transaction(() => {
    db.run('DELETE FROM questions WHERE id = ?', [id])
    touchBank(db, existing.bankId)
  })
}

/**
 * 看题模式:读取多个题库的全部题目。
 * 题库按题库列表的顺序排列,题目按题库内顺序排列;不存在的题库 id 直接忽略。
 */
export function listQuestionsForBanks(db: Db, bankIds: unknown): ReadBank[] {
  if (!Array.isArray(bankIds) || !bankIds.every((x) => typeof x === 'string')) throw new AppError('INVALID_ARGUMENT')
  if (bankIds.length === 0) return []
  const marks = bankIds.map(() => '?').join(', ')
  const banks = db.all<{ id: string; name: string }>(
    `SELECT id, name FROM banks WHERE id IN (${marks}) ORDER BY sort_order, created_at`,
    bankIds
  )
  const questions = db.all<Question>(
    `${SELECT_QUESTION} WHERE bank_id IN (${marks}) ORDER BY sort_order`,
    bankIds
  )
  const result = banks.map((b) => ({ ...b, questions: questions.filter((q) => q.bankId === b.id) }))
  // 错题本:按加入时间排列,已在其他勾选题库中出现的题目不重复列出
  if (bankIds.includes(WRONG_BOOK_ID)) {
    const shown = new Set(questions.map((q) => q.id))
    const wrong = db
      .all<Question>(
        `SELECT q.id, q.bank_id AS bankId, q.title, q.answer_md AS answerMd, q.sort_order AS sortOrder,
                q.created_at AS createdAt, q.updated_at AS updatedAt
           FROM questions q JOIN review_cards c ON c.question_id = q.id
          WHERE c.in_wrong_book = 1 ORDER BY c.wrong_added_at`
      )
      .filter((q) => !shown.has(q.id))
    result.push({ id: WRONG_BOOK_ID, name: '', questions: wrong })
  }
  return result
}

/** 批量追加题目(导入用);在调用方的事务中执行 */
export function insertQuestions(db: Db, bankId: string, items: QuestionInput[]): void {
  const inputs = items.map((item) => normalizeInput(item))
  db.transaction(() => {
    let next =
      db.get<{ n: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM questions WHERE bank_id = ?', [bankId])
        ?.n ?? 0
    const now = Date.now()
    for (const input of inputs) {
      db.run(
        `INSERT INTO questions (id, bank_id, title, answer_md, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), bankId, input.title, input.answerMd, next++, now, now]
      )
    }
    touchBank(db, bankId)
  })
}

/** 所选题库中各优先级的题目数量 */
export function priorityStats(db: Db, bankIds: unknown): PriorityStats {
  if (!Array.isArray(bankIds) || !bankIds.every((x) => typeof x === 'string')) throw new AppError('INVALID_ARGUMENT')
  if (bankIds.length === 0) return { total: 0, counts: [], unlabeled: 0 }
  const where = selectionWhere(bankIds as string[])
  const rows = db.all<{ head: string }>(
    `SELECT substr(q.answer_md, 1, 1000) AS head FROM questions q WHERE ${where.sql}`,
    where.params
  )
  const counts = new Map<string, number>()
  let unlabeled = 0
  for (const { head } of rows) {
    const p = priorityOf(head)
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1)
    else unlabeled++
  }
  return {
    total: rows.length,
    counts: [...counts.entries()].sort(([a], [b]) => comparePriority(a, b)).map(([priority, count]) => ({ priority, count })),
    unlabeled
  }
}

/** 按给定顺序重排一个题库的题目;ids 必须恰好包含该题库的所有题目 */
export function reorderQuestions(db: Db, bankId: string, ids: unknown): void {
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) throw new AppError('INVALID_ARGUMENT')
  getBank(db, bankId)
  const existing = db.all<{ id: string }>('SELECT id FROM questions WHERE bank_id = ?', [bankId]).map((r) => r.id)
  if (ids.length !== existing.length || new Set(ids).size !== ids.length || !existing.every((id) => ids.includes(id))) {
    throw new AppError('INVALID_ARGUMENT')
  }
  db.transaction(() => {
    ids.forEach((id, i) => db.run('UPDATE questions SET sort_order = ? WHERE id = ?', [i, id]))
  })
}

/**
 * 批量设置一个题库的优先级。priority 为 null 时清除优先级。
 * scope 为 missing 时只修改还没有优先级的题目。返回修改的题目数量。
 */
export function setBankPriority(db: Db, bankId: string, priority: unknown, scope: unknown): number {
  if (!(priority === null || (typeof priority === 'string' && priority.trim() && priority.length <= 20))) {
    throw new AppError('INVALID_ARGUMENT')
  }
  if (scope !== 'missing' && scope !== 'all') throw new AppError('INVALID_ARGUMENT')
  getBank(db, bankId)
  const rows = db.all<{ id: string; answerMd: string }>('SELECT id, answer_md AS answerMd FROM questions WHERE bank_id = ?', [
    bankId
  ])
  const value = priority === null ? '' : priority.trim()
  let changed = 0
  db.transaction(() => {
    const now = Date.now()
    for (const r of rows) {
      const current = priorityOf(r.answerMd)
      if ((scope as PriorityScope) === 'missing' && current) continue
      if ((current ?? '') === value) continue
      db.run('UPDATE questions SET answer_md = ?, updated_at = ? WHERE id = ?', [
        updateMeta(r.answerMd, { priority: value }),
        now,
        r.id
      ])
      changed++
    }
    if (changed > 0) touchBank(db, bankId)
  })
  return changed
}
