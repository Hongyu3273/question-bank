// 记忆曲线:用 FSRS 算法安排每道题的复习时间,生成"今日任务"。
//
// 规则(详见项目文档《知识题库-背单词扩展方案》):
// - 自评三档:1 不会、2 模糊、3 记住
// - 每个题库单独设置每日新题数和每日复习上限;勾选多个题库时合并
// - 新题按优先级(高 → 中 → 低 → 未设置)出,同一优先级按题库和题目顺序
// - 答"不会"的题进错题本;之后在不同的两天各答一次"记住"自动移出
// - 每天从 dayStartHour 点开始(默认凌晨 4 点)
//
// 今日任务不单独保存队列,每次都根据卡片和当天的自评记录重新计算,
// 所以修改设置、增删题目后会立即生效。

import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type FSRS, type Grade as FsrsGrade } from 'ts-fsrs'
import { AppError } from '../../shared/errors'
import { comparePriority, priorityOf } from '../../shared/meta'
import {
  GRADES,
  STUDY_LIMITS,
  WRONG_BOOK_ID,
  type Grade,
  type GradeCounts,
  type GradePreview,
  type StudyStats,
  type StudyCard,
  type StudyLimits,
  type StudyState,
  type TodayCounts,
  type TodaySummary
} from '../../shared/types'
import type { Db } from '../db/database'
import { getQuestion } from '../db/repositories/questions'
import { selectionWhere, wrongBookCount } from '../db/repositories/selection'
import { getAllSettings, readInternal, writeInternal } from '../db/repositories/settings'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function makeScheduler(fuzz: boolean): FSRS {
  return fsrs(
    generatorParameters({
      enable_fuzz: fuzz,
      // 一道新题答"记住"直接进入按天复习;答"不会"10 分钟后再出现
      learning_steps: ['10m'],
      relearning_steps: ['10m'],
      maximum_interval: 3650
    })
  )
}

let scheduler = makeScheduler(true)

/** 测试用:关闭随机扰动,让间隔可预测 */
export function setSchedulerFuzz(fuzz: boolean): void {
  scheduler = makeScheduler(fuzz)
}

const RATING: Record<Grade, FsrsGrade> = {
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good
}

// ---------- 日期 ----------

const pad = (n: number) => String(n).padStart(2, '0')

/** 学习日:凌晨 dayStartHour 点之前算前一天。返回 YYYY-MM-DD(本地时间) */
export function studyDay(now: number, dayStartHour: number): string {
  const d = new Date(now - dayStartHour * HOUR)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今天这个学习日结束的时刻 */
export function studyDayEnd(now: number, dayStartHour: number): number {
  const d = new Date(now - dayStartHour * HOUR)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, dayStartHour).getTime()
}

// ---------- 卡片读写 ----------

interface CardRow {
  question_id: string
  state: number
  due: number
  stability: number
  difficulty: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: number | null
  in_wrong_book: number
  wrong_streak: number
  wrong_streak_day: string | null
  wrong_added_at: number | null
}

const CARD_COLUMNS =
  'question_id, state, due, stability, difficulty, scheduled_days, learning_steps, reps, lapses, last_review, in_wrong_book, wrong_streak, wrong_streak_day, wrong_added_at'

function readCard(db: Db, questionId: string): CardRow | undefined {
  return db.get<CardRow>(`SELECT ${CARD_COLUMNS} FROM review_cards WHERE question_id = ?`, [questionId])
}

function writeCard(db: Db, row: CardRow): void {
  db.run(
    `INSERT OR REPLACE INTO review_cards (${CARD_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.question_id,
      row.state,
      row.due,
      row.stability,
      row.difficulty,
      row.scheduled_days,
      row.learning_steps,
      row.reps,
      row.lapses,
      row.last_review,
      row.in_wrong_book,
      row.wrong_streak,
      row.wrong_streak_day,
      row.wrong_added_at
    ]
  )
}

function toFsrs(row: CardRow | undefined, now: number): Card {
  if (!row || row.state === State.New) return createEmptyCard(new Date(now))
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review === null ? undefined : new Date(row.last_review)
  } as Card
}

function previewsFor(row: CardRow | undefined, now: number): GradePreview[] {
  const outcomes = scheduler.repeat(toFsrs(row, now), new Date(now))
  return GRADES.map((grade) => ({ grade, intervalMs: outcomes[RATING[grade]].card.due.getTime() - now }))
}

// ---------- 今日任务 ----------

interface Selection {
  bankIds: string[]
  priorities: string[]
}

function parseSelection(rawIds: unknown, rawPriorities: unknown): Selection {
  const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')
  if (!isStrings(rawIds) || !isStrings(rawPriorities)) throw new AppError('INVALID_ARGUMENT')
  return { bankIds: [...new Set(rawIds)].sort(), priorities: [...new Set(rawPriorities)].sort() }
}

interface Candidate {
  id: string
  bankId: string
  bankOrder: number
  sortOrder: number
  priority: string | null
  card: CardRow | undefined
}

/** 当天额外加量:再学几道新题、提前复习几道 */
interface Extra {
  day: string
  newCount: number
  aheadCount: number
}

function readExtra(db: Db, day: string): Extra {
  const e = readInternal<Extra>(db, 'srs.extra')
  return e && e.day === day ? e : { day, newCount: 0, aheadCount: 0 }
}

interface Plan {
  /** 今天答错、正在重新学的题,按到期时间排序 */
  learning: Candidate[]
  reviews: Candidate[]
  news: Candidate[]
  /** 新题配额之外还没学过的题 */
  moreNew: number
  /** 明天到期、可以提前复习的题 */
  aheadPool: Candidate[]
  doneToday: number
}

/** 计算今日任务 */
function plan(db: Db, sel: Selection, now: number): Plan {
  const { dayStartHour } = getAllSettings(db)
  const day = studyDay(now, dayStartHour)
  const dayEnd = studyDayEnd(now, dayStartHour)
  const where = selectionWhere(sel.bankIds)

  const rows = db.all<
    { id: string; bank_id: string; bank_order: number; sort_order: number; head: string } & Partial<CardRow>
  >(
    `SELECT q.id, q.bank_id, b.sort_order AS bank_order, q.sort_order, substr(q.answer_md, 1, 1000) AS head,
            c.question_id, c.state, c.due, c.stability, c.difficulty, c.scheduled_days, c.learning_steps,
            c.reps, c.lapses, c.last_review, c.in_wrong_book, c.wrong_streak, c.wrong_streak_day, c.wrong_added_at
       FROM questions q
       JOIN banks b ON b.id = q.bank_id
       LEFT JOIN review_cards c ON c.question_id = q.id
      WHERE ${where.sql}`,
    where.params
  )
  const wanted = new Set(sel.priorities)
  const candidates: Candidate[] = []
  for (const r of rows) {
    const priority = priorityOf(r.head)
    if (wanted.size > 0 && !wanted.has(priority ?? '__none__')) continue
    candidates.push({
      id: r.id,
      bankId: r.bank_id,
      bankOrder: r.bank_order,
      sortOrder: r.sort_order,
      priority,
      card: r.question_id ? (r as CardRow) : undefined
    })
  }

  // 每个题库今天已经学了几道新题、复习了几道
  const logs = db.all<{ bank_id: string; news: number; reviews: number; aheads: number; total: number }>(
    `SELECT bank_id,
            SUM(was_new) AS news,
            COUNT(DISTINCT CASE WHEN counted_review = 1 THEN question_id END) AS reviews,
            COUNT(DISTINCT CASE WHEN ahead = 1 THEN question_id END) AS aheads,
            COUNT(*) AS total
       FROM review_logs WHERE day = ? GROUP BY bank_id`,
    [day]
  )
  const done = new Map(logs.map((l) => [l.bank_id, l]))
  const limits = new Map(
    db
      .all<{ id: string; new_per_day: number; review_per_day: number }>('SELECT id, new_per_day, review_per_day FROM banks')
      .map((b) => [b.id, b])
  )
  const banksInPlay = new Set(candidates.map((c) => c.bankId))
  const doneToday = [...banksInPlay].reduce((n, id) => n + (done.get(id)?.total ?? 0), 0)

  const learning = candidates
    .filter((c) => c.card && (c.card.state === State.Learning || c.card.state === State.Relearning))
    .sort((a, b) => a.card!.due - b.card!.due)

  // 到期复习:每个题库按上限截取,最早到期的先复习
  const reviews: Candidate[] = []
  const dueByBank = groupBy(
    candidates.filter((c) => c.card?.state === State.Review && c.card.due < dayEnd).sort((a, b) => a.card!.due - b.card!.due),
    (c) => c.bankId
  )
  for (const [bankId, list] of dueByBank) {
    const quota = Math.max(0, (limits.get(bankId)?.review_per_day ?? 0) - (done.get(bankId)?.reviews ?? 0))
    reviews.push(...list.slice(0, quota))
  }
  reviews.sort((a, b) => a.card!.due - b.card!.due)

  // 新题:每个题库按配额截取;"再学几道"的加量从剩下的新题中按全局顺序补
  const newOrder = (a: Candidate, b: Candidate) =>
    byPriority(a.priority, b.priority) || a.bankOrder - b.bankOrder || a.sortOrder - b.sortOrder
  const allNew = candidates.filter((c) => !c.card || c.card.state === State.New).sort(newOrder)
  const extra = readExtra(db, day)
  const news: Candidate[] = []
  const leftover: Candidate[] = []
  let overflow = 0
  for (const [bankId, list] of groupBy(allNew, (c) => c.bankId)) {
    const limit = limits.get(bankId)?.new_per_day ?? 0
    const used = done.get(bankId)?.news ?? 0
    const quota = Math.max(0, limit - used)
    overflow += Math.max(0, used - limit)
    news.push(...list.slice(0, quota))
    leftover.push(...list.slice(quota))
  }
  // 勾选的题库今天还没有新题记录时,也要算上它们超出配额的部分
  for (const id of banksInPlay) {
    if (!allNew.some((c) => c.bankId === id)) {
      const used = done.get(id)?.news ?? 0
      overflow += Math.max(0, used - (limits.get(id)?.new_per_day ?? 0))
    }
  }
  leftover.sort(newOrder)
  const extraNew = Math.max(0, extra.newCount - overflow)
  news.push(...leftover.slice(0, extraNew))
  news.sort(newOrder)

  // 提前复习:明天这个学习日内到期的题
  const aheadAll = candidates
    .filter((c) => c.card?.state === State.Review && c.card.due >= dayEnd && c.card.due < dayEnd + DAY)
    .sort((a, b) => a.card!.due - b.card!.due)
  const aheadDone = [...banksInPlay].reduce((n, id) => n + (done.get(id)?.aheads ?? 0), 0)
  const aheadQuota = Math.max(0, extra.aheadCount - aheadDone)

  return {
    learning,
    reviews: [...reviews, ...aheadAll.slice(0, aheadQuota)],
    news,
    moreNew: Math.max(0, leftover.length - extraNew),
    aheadPool: aheadAll.slice(aheadQuota),
    doneToday
  }
}

/** 优先级高的在前,未设置优先级的排最后 */
function byPriority(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return comparePriority(a, b)
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

function countsOf(p: Plan): TodayCounts {
  return { newLeft: p.news.length, reviewLeft: p.reviews.length, learningLeft: p.learning.length, doneToday: p.doneToday }
}

/** 下一道题:到期的重学题 → 复习和新题交替 → 还没到时间的重学题 */
function pick(p: Plan, now: number, currentId: string | null): Candidate | null {
  const all = [...p.learning, ...p.reviews, ...p.news]
  if (currentId) {
    const current = all.find((c) => c.id === currentId)
    if (current) return current
  }
  const dueLearning = p.learning.find((c) => c.card!.due <= now)
  if (dueLearning) return dueLearning
  if (p.reviews.length > 0 || p.news.length > 0) {
    return p.reviews.length >= p.news.length ? p.reviews[0] : p.news[0]
  }
  return p.learning[0] ?? null
}

function selectionKey(sel: Selection): string {
  return JSON.stringify(sel)
}

function canUndo(db: Db, now: number): boolean {
  const day = studyDay(now, getAllSettings(db).dayStartHour)
  return !!db.get('SELECT 1 FROM review_logs WHERE day = ? LIMIT 1', [day])
}

/** 今日任务的当前状态;当前题目会被记住,刷新页面不会换题 */
export function studyState(db: Db, rawIds: unknown, rawPriorities: unknown, now = Date.now()): StudyState {
  const sel = parseSelection(rawIds, rawPriorities)
  if (sel.bankIds.length === 0) return { status: 'empty' }
  return db.transaction(() => {
    const p = plan(db, sel, now)
    const saved = readInternal<{ key: string; questionId: string }>(db, 'srs.current')
    const key = selectionKey(sel)
    const next = pick(p, now, saved?.key === key ? saved.questionId : null)
    if (!next) {
      const hasQuestions = db.get(
        `SELECT 1 FROM questions q WHERE ${selectionWhere(sel.bankIds).sql} LIMIT 1`,
        selectionWhere(sel.bankIds).params
      )
      if (!hasQuestions) return { status: 'empty' }
      return {
        status: 'done',
        counts: countsOf(p),
        canUndo: canUndo(db, now),
        moreNew: p.moreNew,
        ahead: p.aheadPool.length,
        wrongBook: wrongBookCount(db),
        ...todayEffort(db, studyDay(now, getAllSettings(db).dayStartHour))
      }
    }
    if (saved?.questionId !== next.id || saved.key !== key) writeInternal(db, 'srs.current', { key, questionId: next.id })
    const question = getQuestion(db, next.id)
    const bank = db.get<{ name: string }>('SELECT name FROM banks WHERE id = ?', [question.bankId])
    const card: StudyCard = {
      question,
      bankName: bank?.name ?? '',
      isNew: !next.card || next.card.state === State.New,
      inWrongBook: next.card?.in_wrong_book === 1,
      previews: previewsFor(next.card, now)
    }
    return { status: 'card', card, counts: countsOf(p), canUndo: canUndo(db, now) }
  })
}

/** 首页显示的今日任务数量 */
export function todaySummary(db: Db, rawIds: unknown, rawPriorities: unknown, now = Date.now()): TodaySummary {
  const sel = parseSelection(rawIds, rawPriorities)
  const counts =
    sel.bankIds.length === 0
      ? { newLeft: 0, reviewLeft: 0, learningLeft: 0, doneToday: 0 }
      : db.transaction(() => countsOf(plan(db, sel, now)))
  return { counts, wrongBook: wrongBookCount(db) }
}

/** 下次复习间隔(背题"全部刷一遍"模式显示在按钮上) */
export function gradePreviews(db: Db, questionId: string, now = Date.now()): GradePreview[] {
  return previewsFor(readCard(db, questionId), now)
}

export function isInWrongBook(db: Db, questionId: string): boolean {
  return readCard(db, questionId)?.in_wrong_book === 1
}

/** 自评一道题,更新复习时间和错题本 */
export function rate(db: Db, rawQuestionId: unknown, rawGrade: unknown, now = Date.now()): void {
  if (typeof rawQuestionId !== 'string' || !GRADES.includes(rawGrade as Grade)) throw new AppError('INVALID_ARGUMENT')
  const grade = rawGrade as Grade
  db.transaction(() => {
    const question = getQuestion(db, rawQuestionId)
    const { dayStartHour } = getAllSettings(db)
    const day = studyDay(now, dayStartHour)
    const dayEnd = studyDayEnd(now, dayStartHour)
    const prev = readCard(db, question.id)
    const result = scheduler.next(toFsrs(prev, now), new Date(now), RATING[grade]).card

    const row: CardRow = {
      question_id: question.id,
      state: result.state,
      due: result.due.getTime(),
      stability: result.stability,
      difficulty: result.difficulty,
      scheduled_days: result.scheduled_days,
      learning_steps: result.learning_steps,
      reps: result.reps,
      lapses: result.lapses,
      last_review: result.last_review ? result.last_review.getTime() : now,
      in_wrong_book: prev?.in_wrong_book ?? 0,
      wrong_streak: prev?.wrong_streak ?? 0,
      wrong_streak_day: prev?.wrong_streak_day ?? null,
      wrong_added_at: prev?.wrong_added_at ?? null
    }
    // 错题本:不会 → 加入;模糊 → 连续记录清零;记住 → 每天最多记一次,满两次移出
    if (grade === 1) {
      if (!row.in_wrong_book) row.wrong_added_at = now
      row.in_wrong_book = 1
      row.wrong_streak = 0
      row.wrong_streak_day = null
    } else if (grade === 2) {
      row.wrong_streak = 0
      row.wrong_streak_day = null
    } else if (row.in_wrong_book && row.wrong_streak_day !== day) {
      row.wrong_streak += 1
      row.wrong_streak_day = day
      if (row.wrong_streak >= 2) {
        row.in_wrong_book = 0
        row.wrong_streak = 0
        row.wrong_streak_day = null
        row.wrong_added_at = null
      }
    }
    writeCard(db, row)

    const wasNew = !prev || prev.state === State.New
    const wasReview = prev?.state === State.Review
    const ahead = wasReview && prev.due >= dayEnd
    db.run(
      `INSERT INTO review_logs (question_id, bank_id, grade, reviewed_at, day, was_new, counted_review, ahead, prev_card)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        question.id,
        question.bankId,
        grade,
        now,
        day,
        wasNew ? 1 : 0,
        wasReview && !ahead ? 1 : 0,
        ahead ? 1 : 0,
        prev ? JSON.stringify(prev) : null
      ]
    )
    // 评完后换下一题
    const saved = readInternal<{ key: string; questionId: string }>(db, 'srs.current')
    if (saved?.questionId === question.id) writeInternal(db, 'srs.current', null)
  })
}

/** 撤销今天最后一次自评,返回那道题的 id;没有可撤销的记录时返回 null */
export function undo(db: Db, now = Date.now()): string | null {
  return db.transaction(() => {
    const day = studyDay(now, getAllSettings(db).dayStartHour)
    const log = db.get<{ id: number; question_id: string; prev_card: string | null }>(
      'SELECT id, question_id, prev_card FROM review_logs WHERE day = ? ORDER BY id DESC LIMIT 1',
      [day]
    )
    if (!log) return null
    if (log.prev_card) writeCard(db, JSON.parse(log.prev_card) as CardRow)
    else db.run('DELETE FROM review_cards WHERE question_id = ?', [log.question_id])
    db.run('DELETE FROM review_logs WHERE id = ?', [log.id])
    const saved = readInternal<{ key: string; questionId: string }>(db, 'srs.current')
    if (saved) writeInternal(db, 'srs.current', { key: saved.key, questionId: log.question_id })
    return log.question_id
  })
}

/** 今日任务完成后加量:再学 count 道新题,或提前复习 count 道明天的题 */
export function extend(db: Db, kind: unknown, count: unknown, now = Date.now()): void {
  if ((kind !== 'new' && kind !== 'ahead') || !Number.isInteger(count) || (count as number) < 1 || (count as number) > 999) {
    throw new AppError('INVALID_ARGUMENT')
  }
  const day = studyDay(now, getAllSettings(db).dayStartHour)
  const extra = readExtra(db, day)
  if (kind === 'new') extra.newCount += count as number
  else extra.aheadCount += count as number
  writeInternal(db, 'srs.extra', extra)
}

/** 手动把题目移出错题本 */
export function removeFromWrongBook(db: Db, questionId: unknown): void {
  if (typeof questionId !== 'string') throw new AppError('INVALID_ARGUMENT')
  db.run(
    `UPDATE review_cards SET in_wrong_book = 0, wrong_streak = 0, wrong_streak_day = NULL, wrong_added_at = NULL
      WHERE question_id = ?`,
    [questionId]
  )
}

function validLimits(raw: unknown): StudyLimits {
  const v = raw as StudyLimits
  const ok = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max
  if (!v || !ok(v.newPerDay, STUDY_LIMITS.newPerDay) || !ok(v.reviewPerDay, STUDY_LIMITS.reviewPerDay)) {
    throw new AppError('INVALID_ARGUMENT')
  }
  return { newPerDay: v.newPerDay, reviewPerDay: v.reviewPerDay }
}

/** 设置一个或多个题库的每日新题数和复习上限 */
export function setStudyLimits(db: Db, bankIds: unknown, raw: unknown): void {
  if (!Array.isArray(bankIds) || !bankIds.every((x) => typeof x === 'string')) throw new AppError('INVALID_ARGUMENT')
  const limits = validLimits(raw)
  db.transaction(() => {
    for (const id of bankIds) {
      db.run('UPDATE banks SET new_per_day = ?, review_per_day = ? WHERE id = ?', [
        limits.newPerDay,
        limits.reviewPerDay,
        id
      ])
    }
  })
}

/** 清除题库的学习进度(复习记录和错题本) */
export function resetBankProgress(db: Db, bankId: unknown): void {
  if (typeof bankId !== 'string' || bankId === WRONG_BOOK_ID) throw new AppError('INVALID_ARGUMENT')
  db.transaction(() => {
    db.run('DELETE FROM review_logs WHERE bank_id = ?', [bankId])
    db.run('DELETE FROM review_cards WHERE question_id IN (SELECT id FROM questions WHERE bank_id = ?)', [bankId])
  })
}

/**
 * 导入覆盖题库前保存学习进度,覆盖后按题干恢复到新的题目上。
 * 返回恢复函数,在新题目写入后调用。
 */
export function keepProgressByTitle(db: Db, bankId: string): () => void {
  const cards = db.all<CardRow & { title: string }>(
    `SELECT q.title, ${CARD_COLUMNS.split(', ').map((c) => `c.${c}`).join(', ')}
       FROM review_cards c JOIN questions q ON q.id = c.question_id WHERE q.bank_id = ?`,
    [bankId]
  )
  const logs = db.all<Record<string, unknown> & { title: string }>(
    `SELECT q.title, l.grade, l.reviewed_at, l.day, l.was_new, l.counted_review, l.ahead, l.prev_card
       FROM review_logs l JOIN questions q ON q.id = l.question_id WHERE q.bank_id = ? ORDER BY l.id`,
    [bankId]
  )
  return () => {
    if (cards.length === 0 && logs.length === 0) return
    const ids = new Map<string, string>()
    for (const q of db.all<{ id: string; title: string }>(
      'SELECT id, title FROM questions WHERE bank_id = ? ORDER BY sort_order',
      [bankId]
    )) {
      if (!ids.has(q.title)) ids.set(q.title, q.id)
    }
    for (const { title, ...card } of cards) {
      const id = ids.get(title)
      if (id) writeCard(db, { ...(card as CardRow), question_id: id })
    }
    for (const l of logs) {
      const id = ids.get(l.title)
      if (!id) continue
      const prev = typeof l.prev_card === 'string' ? { ...(JSON.parse(l.prev_card) as CardRow), question_id: id } : null
      db.run(
        `INSERT INTO review_logs (question_id, bank_id, grade, reviewed_at, day, was_new, counted_review, ahead, prev_card)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          bankId,
          l.grade as number,
          l.reviewed_at as number,
          l.day as string,
          l.was_new as number,
          l.counted_review as number,
          l.ahead as number,
          prev ? JSON.stringify(prev) : null
        ]
      )
    }
  }
}

// ---------- 学习统计 ----------

/** 两次自评之间超过这个时间不算学习时长(可能离开了) */
const IDLE_CAP = 3 * 60_000
/** 第一次自评前大约花的时间 */
const FIRST_CARD = 30_000

/** 某个学习日的自评分布和大约用时 */
function todayEffort(db: Db, day: string): { grades: GradeCounts; minutes: number } {
  const logs = db.all<{ grade: number; reviewed_at: number }>(
    'SELECT grade, reviewed_at FROM review_logs WHERE day = ? ORDER BY reviewed_at',
    [day]
  )
  const grades = { again: 0, hard: 0, good: 0 }
  let ms = 0
  logs.forEach((l, i) => {
    if (l.grade === 1) grades.again++
    else if (l.grade === 2) grades.hard++
    else grades.good++
    ms += i === 0 ? FIRST_CARD : Math.min(IDLE_CAP, l.reviewed_at - logs[i - 1].reviewed_at)
  })
  return { grades, minutes: Math.round(ms / 60_000) }
}

/** 往前或往后第 offset 个学习日 */
function shiftDay(now: number, dayStartHour: number, offset: number): string {
  const d = new Date(now - dayStartHour * HOUR)
  return studyDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 12 + dayStartHour).getTime(), dayStartHour)
}

/** 首页的学习概况 */
export function studyStats(db: Db, now = Date.now()): StudyStats {
  const { dayStartHour } = getAllSettings(db)
  const today = studyDay(now, dayStartHour)

  const perDay = new Map(
    db
      .all<{ day: string; n: number }>('SELECT day, COUNT(*) AS n FROM review_logs GROUP BY day')
      .map((r) => [r.day, r.n])
  )
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = shiftDay(now, dayStartHour, i - 6)
    return { day, count: perDay.get(day) ?? 0 }
  })
  const studiedToday = (perDay.get(today) ?? 0) > 0
  let streak = 0
  for (let offset = studiedToday ? 0 : -1; perDay.has(shiftDay(now, dayStartHour, offset)); offset--) streak++

  // 未来 7 天到期:今天这一项包含已经过期的
  const horizon = studyDayEnd(now, dayStartHour) + 6 * DAY
  const next7 = Array.from({ length: 7 }, (_, i) => ({ day: shiftDay(now, dayStartHour, i), count: 0 }))
  const index = new Map(next7.map((d, i) => [d.day, i]))
  for (const { due } of db.all<{ due: number }>('SELECT due FROM review_cards WHERE state != 0 AND due < ?', [horizon])) {
    const i = due < now ? 0 : index.get(studyDay(due, dayStartHour))
    if (i !== undefined) next7[i].count++
  }

  const banks = db.all<{ id: string; name: string; total: number; learned: number; wrongBook: number }>(
    `SELECT b.id, b.name, COUNT(q.id) AS total,
            COALESCE(SUM(CASE WHEN c.state IS NOT NULL AND c.state != 0 THEN 1 ELSE 0 END), 0) AS learned,
            COALESCE(SUM(CASE WHEN c.in_wrong_book = 1 THEN 1 ELSE 0 END), 0) AS wrongBook
       FROM banks b
       LEFT JOIN questions q ON q.bank_id = b.id
       LEFT JOIN review_cards c ON c.question_id = q.id
      GROUP BY b.id ORDER BY b.sort_order, b.created_at`
  )

  return { streak, studiedToday, ...todayEffort(db, today), last7, next7, banks }
}

/** 错题本中所有题目的 id */
export function wrongBookIds(db: Db): string[] {
  return db.all<{ id: string }>('SELECT question_id AS id FROM review_cards WHERE in_wrong_book = 1').map((r) => r.id)
}
