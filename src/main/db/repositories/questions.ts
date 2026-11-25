import { randomUUID } from 'node:crypto'
import { AppError } from '../../../shared/errors'
import { LIMITS, type Question, type QuestionInput, type QuestionSummary } from '../../../shared/types'
import type { Db } from '../database'
import { getBank, touchBank } from './banks'

const SELECT_QUESTION = `
  SELECT id, bank_id AS bankId, title, answer_md AS answerMd, sort_order AS sortOrder,
         created_at AS createdAt, updated_at AS updatedAt
    FROM questions`

export function listQuestions(db: Db, bankId: string): QuestionSummary[] {
  getBank(db, bankId)
  return db.all<QuestionSummary>(
    'SELECT id, bank_id AS bankId, title, sort_order AS sortOrder FROM questions WHERE bank_id = ? ORDER BY sort_order',
    [bankId]
  )
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
