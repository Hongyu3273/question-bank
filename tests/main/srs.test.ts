import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../src/main/db/database'
import { createBank, getBank } from '../../src/main/db/repositories/banks'
import { createQuestion, listQuestions, listQuestionsForBanks } from '../../src/main/db/repositories/questions'
import { setSetting } from '../../src/main/db/repositories/settings'
import { commitCandidate } from '../../src/main/services/importer'
import { startRecite } from '../../src/main/services/recite'
import {
  extend,
  rate,
  removeFromWrongBook,
  resetBankProgress,
  setSchedulerFuzz,
  setStudyLimits,
  studyDay,
  studyDayEnd,
  studyState,
  studyStats,
  todaySummary,
  undo,
  wrongBookIds
} from '../../src/main/services/srs'
import { WRONG_BOOK_ID, type StudyState } from '../../src/shared/types'
import { openTestDb } from '../helpers'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
/** 本地时间 2026-03-10 10:00 */
const T0 = new Date(2026, 2, 10, 10, 0).getTime()

let db: Db
let a: string
let b: string

const card = (s: StudyState) => {
  if (s.status !== 'card') throw new Error(`expected card, got ${s.status}`)
  return s.card
}

/** 从今日任务中一直答 grade,直到做完,返回依次出现的题干 */
function drain(ids: string[], grade: 1 | 2 | 3, now: number, max = 100): string[] {
  const seen: string[] = []
  for (let i = 0; i < max; i++) {
    const s = studyState(db, ids, [], now)
    if (s.status !== 'card') return seen
    seen.push(s.card.question.title)
    rate(db, s.card.question.id, grade, now)
  }
  throw new Error('did not finish')
}

const fake = { stageImages: () => 'x', discardStaged: () => {}, replaceBankImages: () => {} } as never

beforeEach(async () => {
  setSchedulerFuzz(false)
  db = await openTestDb()
  a = createBank(db, 'A').id
  b = createBank(db, 'B').id
  createQuestion(db, a, { title: 'a1', answerMd: '' })
  createQuestion(db, a, { title: 'a2', answerMd: '> 优先级：高' })
  createQuestion(db, a, { title: 'a3', answerMd: '> 优先级：中' })
  createQuestion(db, b, { title: 'b1', answerMd: '' })
})

describe('学习日', () => {
  it('凌晨 4 点前算前一天', () => {
    expect(studyDay(new Date(2026, 2, 10, 3, 59).getTime(), 4)).toBe('2026-03-09')
    expect(studyDay(new Date(2026, 2, 10, 4, 0).getTime(), 4)).toBe('2026-03-10')
    expect(studyDayEnd(T0, 4)).toBe(new Date(2026, 2, 11, 4, 0).getTime())
  })
})

describe('今日任务', () => {
  it('新题按优先级出,未设置优先级的排最后', () => {
    expect(drain([a], 3, T0)).toEqual(['a2', 'a3', 'a1'])
  })

  it('每个题库按每日新题数截取,完成后显示 done', () => {
    setStudyLimits(db, [a], { newPerDay: 2, reviewPerDay: 100 })
    expect(todaySummary(db, [a, b], [], T0).counts.newLeft).toBe(3)
    expect(drain([a, b], 3, T0).sort()).toEqual(['a2', 'a3', 'b1'])
    const s = studyState(db, [a, b], [], T0)
    expect(s.status).toBe('done')
    if (s.status === 'done') expect(s.moreNew).toBe(1)
  })

  it('再学几道新题', () => {
    setStudyLimits(db, [a], { newPerDay: 1, reviewPerDay: 100 })
    drain([a], 3, T0)
    extend(db, 'new', 1, T0)
    expect(drain([a], 3, T0)).toEqual(['a3'])
    expect(studyState(db, [a], [], T0).status).toBe('done')
  })

  it('当前题目保持不变,直到自评', () => {
    const first = card(studyState(db, [a], [], T0)).question.id
    expect(card(studyState(db, [a], [], T0 + MIN)).question.id).toBe(first)
  })

  it('答"不会"的题 10 分钟后再出现,答"记住"后按天复习', () => {
    setStudyLimits(db, [a], { newPerDay: 1, reviewPerDay: 100 })
    const c = card(studyState(db, [a], [], T0))
    expect(c.previews.map((p) => Math.round(p.intervalMs / MIN))).toEqual([10, 15, 2 * 24 * 60])
    rate(db, c.question.id, 1, T0)
    // 没有别的题了:仍然要把这道重学完才算完成
    expect(card(studyState(db, [a], [], T0 + MIN)).question.id).toBe(c.question.id)
    rate(db, c.question.id, 3, T0 + 10 * MIN)
    expect(studyState(db, [a], [], T0 + 11 * MIN).status).toBe('done')
    // 到期后进入复习
    const later = T0 + 3 * DAY
    const s = studyState(db, [a], [], later)
    expect(card(s).question.id).toBe(c.question.id)
    expect(card(s).isNew).toBe(false)
  })

  it('每日复习上限', () => {
    setStudyLimits(db, [a], { newPerDay: 3, reviewPerDay: 1 })
    drain([a], 3, T0)
    setStudyLimits(db, [a], { newPerDay: 0, reviewPerDay: 1 })
    const later = T0 + 10 * DAY
    expect(todaySummary(db, [a], [], later).counts.reviewLeft).toBe(1)
    expect(drain([a], 3, later)).toHaveLength(1)
    expect(studyState(db, [a], [], later).status).toBe('done')
  })

  it('提前复习明天到期的题', () => {
    setStudyLimits(db, [a], { newPerDay: 1, reviewPerDay: 100 })
    drain([a], 3, T0) // a2 两天后到期
    setStudyLimits(db, [a], { newPerDay: 0, reviewPerDay: 100 })
    const nextDay = T0 + DAY
    const s = studyState(db, [a], [], nextDay)
    expect(s.status === 'done' && s.ahead).toBe(1)
    extend(db, 'ahead', 5, nextDay)
    expect(drain([a], 3, nextDay)).toEqual(['a2'])
  })

  it('优先级筛选也作用于今日任务', () => {
    expect(drain([a], 3, T0).length).toBe(3)
    const fresh = createBank(db, 'C').id
    createQuestion(db, fresh, { title: 'c1', answerMd: '> 优先级：低' })
    createQuestion(db, fresh, { title: 'c2', answerMd: '> 优先级：高' })
    expect(card(studyState(db, [fresh], ['低'], T0)).question.title).toBe('c1')
  })
})

describe('错题本', () => {
  it('不会 → 加入;在不同的两天答"记住"后移出', () => {
    setStudyLimits(db, [a], { newPerDay: 1, reviewPerDay: 100 })
    const c = card(studyState(db, [a], [], T0))
    rate(db, c.question.id, 1, T0)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(1)
    // 同一天两次"记住"只算一次
    rate(db, c.question.id, 3, T0 + 10 * MIN)
    rate(db, c.question.id, 3, T0 + 20 * MIN)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(1)
    rate(db, c.question.id, 3, T0 + 3 * DAY)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(0)
  })

  it('"模糊"打断连续记录', () => {
    const c = card(studyState(db, [a], [], T0))
    rate(db, c.question.id, 1, T0)
    rate(db, c.question.id, 3, T0 + 10 * MIN)
    rate(db, c.question.id, 2, T0 + DAY)
    rate(db, c.question.id, 3, T0 + 2 * DAY)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(1)
  })

  it('可以像题库一样勾选,也可以手动移出', () => {
    const c = card(studyState(db, [a], [], T0))
    rate(db, c.question.id, 1, T0)
    expect(startRecite(db, [WRONG_BOOK_ID])?.question.id).toBe(c.question.id)
    const read = listQuestionsForBanks(db, [WRONG_BOOK_ID])
    expect(read.map((r) => r.id)).toEqual([WRONG_BOOK_ID])
    expect(read[0].questions.map((q) => q.id)).toEqual([c.question.id])
    removeFromWrongBook(db, c.question.id)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(0)
  })
})

describe('撤销', () => {
  it('恢复卡片、错题本和当前题目', () => {
    const c = card(studyState(db, [a], [], T0))
    rate(db, c.question.id, 1, T0)
    expect(undo(db, T0)).toBe(c.question.id)
    const s = studyState(db, [a], [], T0)
    expect(card(s).question.id).toBe(c.question.id)
    expect(card(s).isNew).toBe(true)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(0)
    expect(undo(db, T0)).toBeNull()
  })
})

describe('进度保留与重置', () => {
  it('导入覆盖时题干相同的题保留进度', () => {
    drain([a], 3, T0)
    commitCandidate(db, fake, { name: 'A', questions: [{ title: 'a2', answerMd: 'new' }, { title: 'x', answerMd: '' }], images: new Map() }, a)
    const s = todaySummary(db, [a], [], T0)
    // a2 已学过;只剩 x 一道新题,今日新题配额(10)已用 3
    expect(s.counts.newLeft).toBe(1)
    expect(s.counts.doneToday).toBe(1)
  })

  it('重置题库进度', () => {
    for (let i = 0; i < 3; i++) rate(db, card(studyState(db, [a], [], T0)).question.id, 1, T0)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(3)
    resetBankProgress(db, a)
    expect(todaySummary(db, [a], [], T0).counts.newLeft).toBe(3)
    expect(todaySummary(db, [a], [], T0).wrongBook).toBe(0)
  })

  it('题库带有默认学习设置', () => {
    expect(getBank(db, a)).toMatchObject({ newPerDay: 10, reviewPerDay: 100 })
  })

  it('换日时间可设置', () => {
    setSetting(db, 'dayStartHour', 0)
    drain([a], 3, new Date(2026, 2, 10, 23, 0).getTime())
    // 0 点后是新的一天,新题配额重新计算(题目都学过了,所以没有新题)
    expect(todaySummary(db, [a], [], new Date(2026, 2, 11, 0, 30).getTime()).counts.doneToday).toBe(0)
  })
})

describe('学习统计', () => {
  it('连续天数、最近 7 天、未来 7 天、题库掌握情况', () => {
    setStudyLimits(db, [a], { newPerDay: 1, reviewPerDay: 100 })
    // 前天、昨天各学一道,今天还没学
    rate(db, card(studyState(db, [a], [], T0 - 2 * DAY)).question.id, 3, T0 - 2 * DAY)
    rate(db, card(studyState(db, [a], [], T0 - DAY)).question.id, 1, T0 - DAY)
    let s = studyStats(db, T0)
    expect(s.studiedToday).toBe(false)
    expect(s.streak).toBe(2)
    expect(s.last7.map((d) => d.count)).toEqual([0, 0, 0, 0, 1, 1, 0])
    // 昨天答"不会"的题已过期,算在今天;前天答"记住"的两天后到期,也是今天
    expect(s.next7[0].count).toBe(2)
    expect(s.banks.find((x) => x.id === a)).toMatchObject({ total: 3, learned: 2, wrongBook: 1 })
    rate(db, card(studyState(db, [a], [], T0)).question.id, 2, T0)
    rate(db, card(studyState(db, [a], [], T0 + MIN)).question.id, 3, T0 + MIN)
    s = studyStats(db, T0 + 2 * MIN)
    expect(s.streak).toBe(3)
    expect(s.grades).toEqual({ again: 0, hard: 1, good: 1 })
    expect(s.minutes).toBe(2)
  })

  it('完成页显示自评分布', () => {
    setStudyLimits(db, [a], { newPerDay: 1, reviewPerDay: 100 })
    drain([a], 3, T0)
    const s = studyState(db, [a], [], T0)
    expect(s.status === 'done' && s.grades).toEqual({ again: 0, hard: 0, good: 1 })
  })

  it('题目列表带学习状态', () => {
    const c = card(studyState(db, [a], [], T0))
    rate(db, c.question.id, 1, T0)
    const list = listQuestions(db, a)
    const item = list.find((q) => q.id === c.question.id)!
    expect(item).toMatchObject({ studyStatus: 'learning', inWrongBook: true })
    expect(list.filter((q) => q.studyStatus === 'new')).toHaveLength(2)
    expect(wrongBookIds(db)).toEqual([c.question.id])
  })
})
