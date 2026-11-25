import { AppError } from '../../shared/errors'
import type { Question, ReciteState, ReciteStatus } from '../../shared/types'
import { priorityKey } from '../../shared/meta'
import type { Db } from '../db/database'
import { getQuestion } from '../db/repositories/questions'
import { selectionWhere } from '../db/repositories/selection'
import { gradePreviews, isInWrongBook } from './srs'

interface SessionRow {
  filter: string
  bank_ids: string
  queue: string
  position: number
  round: number
}

interface Session {
  bankIds: string[]
  /** 优先级筛选;空数组表示全部 */
  priorities: string[]
  queue: string[]
  position: number
  round: number
}

export type Random = () => number

/** Fisher–Yates 洗牌,返回新数组 */
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const normalizeIds = (ids: string[]) => [...new Set(ids)].sort()

function readSession(db: Db): Session | null {
  const row = db.get<SessionRow>('SELECT bank_ids, filter, queue, position, round FROM recite_session WHERE id = 1')
  if (!row) return null
  try {
    return {
      bankIds: JSON.parse(row.bank_ids) as string[],
      priorities: JSON.parse(row.filter) as string[],
      queue: JSON.parse(row.queue) as string[],
      position: row.position,
      round: row.round
    }
  } catch {
    return null
  }
}

function writeSession(db: Db, s: Session): void {
  db.run(
    `INSERT INTO recite_session (id, bank_ids, filter, queue, position, round, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET bank_ids = excluded.bank_ids, filter = excluded.filter, queue = excluded.queue,
       position = excluded.position, round = excluded.round, updated_at = excluded.updated_at`,
    [JSON.stringify(s.bankIds), JSON.stringify(s.priorities), JSON.stringify(s.queue), s.position, s.round, Date.now()]
  )
}

/** 所选题库当前的题目 id;有优先级筛选时只取这些优先级的题目 */
function questionIds(db: Db, bankIds: string[], priorities: string[]): string[] {
  if (bankIds.length === 0) return []
  const where = selectionWhere(bankIds)
  if (priorities.length === 0) {
    return db.all<{ id: string }>(`SELECT q.id FROM questions q WHERE ${where.sql}`, where.params).map((r) => r.id)
  }
  const wanted = new Set(priorities)
  return db
    .all<{ id: string; head: string }>(
      `SELECT q.id, substr(q.answer_md, 1, 1000) AS head FROM questions q WHERE ${where.sql}`,
      where.params
    )
    .filter((r) => wanted.has(priorityKey(r.head)))
    .map((r) => r.id)
}

/**
 * 把会话整理成可展示的状态:跳过已删除的题目;本轮题目都被删光时开始新一轮。
 * 所选题库已经没有题目时返回 null。
 */
function resolve(db: Db, s: Session, random: Random, roundCompleted = false): ReciteState | null {
  let changed = false
  for (;;) {
    if (s.position >= s.queue.length) {
      const ids = questionIds(db, s.bankIds, s.priorities)
      if (ids.length === 0) {
        db.run('DELETE FROM recite_session WHERE id = 1')
        return null
      }
      // 本轮剩下的题目被删除后走到了末尾:视为一轮结束
      if (s.queue.length > 0) roundCompleted = true
      s = { ...s, queue: shuffle(ids, random), position: 0, round: s.round + (s.queue.length > 0 ? 1 : 0) }
      changed = true
      continue
    }
    let question: Question
    try {
      question = getQuestion(db, s.queue[s.position])
    } catch {
      // 题目已被删除:从本轮队列中移除
      s = { ...s, queue: s.queue.filter((_, i) => i !== s.position) }
      changed = true
      continue
    }
    if (changed) writeSession(db, s)
    const bank = db.get<{ name: string }>('SELECT name FROM banks WHERE id = ?', [question.bankId])
    return {
      question,
      bankName: bank?.name ?? '',
      index: s.position + 1,
      total: s.queue.length,
      round: s.round,
      roundCompleted,
      previews: gradePreviews(db, question.id),
      inWrongBook: isInWrongBook(db, question.id)
    }
  }
}

function requireSession(db: Db): Session {
  const s = readSession(db)
  if (!s) throw new AppError('RECITE_NO_SESSION')
  return s
}

/**
 * 进入背题模式:勾选的题库与上次相同时继续上次的进度,否则重新洗牌开始。
 * 所选题库没有题目时返回 null。
 */
export function startRecite(
  db: Db,
  rawIds: unknown,
  rawPriorities: unknown = [],
  random: Random = Math.random
): ReciteState | null {
  const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
  if (!isStrings(rawIds) || !isStrings(rawPriorities)) throw new AppError('INVALID_ARGUMENT')
  const bankIds = normalizeIds(rawIds)
  const priorities = normalizeIds(rawPriorities)
  const existing = readSession(db)
  if (
    existing &&
    JSON.stringify(existing.bankIds) === JSON.stringify(bankIds) &&
    JSON.stringify(existing.priorities) === JSON.stringify(priorities)
  ) {
    return db.transaction(() => resolve(db, existing, random))
  }
  return db.transaction(() => {
    const ids = questionIds(db, bankIds, priorities)
    if (ids.length === 0) {
      db.run('DELETE FROM recite_session WHERE id = 1')
      return null
    }
    const s: Session = { bankIds, priorities, queue: shuffle(ids, random), position: 0, round: 1 }
    writeSession(db, s)
    return resolve(db, s, random)
  })
}

/** 下一题;本轮最后一题之后自动洗牌开始新一轮(新增的题目从这时加入) */
export function nextQuestion(db: Db, random: Random = Math.random): ReciteState | null {
  return db.transaction(() => {
    const s = requireSession(db)
    const atEnd = s.position + 1 >= s.queue.length
    const next: Session = atEnd
      ? { ...s, queue: shuffle(questionIds(db, s.bankIds, s.priorities), random), position: 0, round: s.round + 1 }
      : { ...s, position: s.position + 1 }
    writeSession(db, next)
    return resolve(db, next, random, atEnd)
  })
}

/** 上一题;只在本轮内回退 */
export function prevQuestion(db: Db, random: Random = Math.random): ReciteState | null {
  return db.transaction(() => {
    const s = requireSession(db)
    const prev: Session = { ...s, position: Math.max(0, s.position - 1) }
    writeSession(db, prev)
    return resolve(db, prev, random)
  })
}

/** 重新洗牌:用所选题库的当前题目重新排序,从第一题开始,轮次不变 */
export function reshuffle(db: Db, random: Random = Math.random): ReciteState | null {
  return db.transaction(() => {
    const s = requireSession(db)
    const next: Session = { ...s, queue: shuffle(questionIds(db, s.bankIds, s.priorities), random), position: 0 }
    writeSession(db, next)
    return resolve(db, next, random)
  })
}

/** 首页显示用:当前会话的进度,不改变会话 */
export function reciteStatus(db: Db): ReciteStatus | null {
  const s = readSession(db)
  if (!s || s.queue.length === 0) return null
  return {
    bankIds: s.bankIds,
    priorities: s.priorities,
    index: Math.min(s.position + 1, s.queue.length),
    total: s.queue.length,
    round: s.round
  }
}
