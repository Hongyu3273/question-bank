import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../src/main/db/database'
import { createBank } from '../../src/main/db/repositories/banks'
import { createQuestion, deleteQuestion } from '../../src/main/db/repositories/questions'
import { nextQuestion, prevQuestion, reciteStatus, reshuffle, shuffle, startRecite } from '../../src/main/services/recite'
import { NO_PRIORITY } from '../../src/shared/meta'
import { openTestDb } from '../helpers'

/** 可重复的伪随机数 */
function seeded(seed = 42) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2 ** 31
    return s / 2 ** 31
  }
}

let db: Db
let a: string
let b: string
beforeEach(async () => {
  db = await openTestDb()
  a = createBank(db, 'A').id
  b = createBank(db, 'B').id
  for (let i = 1; i <= 3; i++) createQuestion(db, a, { title: `a${i}`, answerMd: '' })
  for (let i = 1; i <= 2; i++) createQuestion(db, b, { title: `b${i}`, answerMd: '' })
})

/** 把本轮剩下的题依次取完,返回本轮全部题干 */
function takeRound(first: string) {
  const titles = [first]
  for (;;) {
    const s = nextQuestion(db, seeded())!
    if (s.roundCompleted) return { titles, next: s }
    titles.push(s.question.title)
  }
}

describe('shuffle', () => {
  it('保留所有元素', () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    expect(shuffle(items, seeded()).sort((x, y) => x - y)).toEqual(items)
  })
})

describe('背题会话', () => {
  it('合并所选题库并洗牌,一轮内每道题出现且只出现一次', () => {
    const first = startRecite(db, [a, b], [], seeded())!
    expect(first).toMatchObject({ index: 1, total: 5, round: 1, roundCompleted: false })
    const { titles, next } = takeRound(first.question.title)
    expect(titles.sort()).toEqual(['a1', 'a2', 'a3', 'b1', 'b2'])
    expect(next).toMatchObject({ index: 1, total: 5, round: 2, roundCompleted: true })
  })

  it('勾选相同时继续上次进度,勾选变化时重新开始', () => {
    startRecite(db, [a, b], [], seeded())
    nextQuestion(db)
    const again = startRecite(db, [b, a], [], seeded()) // 顺序不同视为相同
    expect(again?.index).toBe(2)
    const changed = startRecite(db, [a], [], seeded())
    expect(changed).toMatchObject({ index: 1, total: 3, round: 1 })
  })

  it('上一题只在本轮内回退', () => {
    startRecite(db, [a], [], seeded())
    expect(prevQuestion(db)?.index).toBe(1)
    nextQuestion(db)
    expect(prevQuestion(db)?.index).toBe(1)
  })

  it('跳过已删除的题目', () => {
    const first = startRecite(db, [a], [], seeded())!
    const second = nextQuestion(db)!
    prevQuestion(db)
    deleteQuestion(db, first.question.id)
    // 回到会话时,第一题已被删除,显示原来的第二题
    const resumed = startRecite(db, [a], [], seeded())!
    expect(resumed.question.id).toBe(second.question.id)
    expect(resumed.total).toBe(2)
  })

  it('新增的题目从下一轮开始出现', () => {
    const first = startRecite(db, [a], [], seeded())!
    createQuestion(db, a, { title: 'a4', answerMd: '' })
    const { titles, next } = takeRound(first.question.title)
    expect(titles).not.toContain('a4')
    expect(next.total).toBe(4)
  })

  it('重新洗牌回到第一题,轮次不变', () => {
    startRecite(db, [a, b], [], seeded())
    nextQuestion(db)
    nextQuestion(db)
    expect(reshuffle(db, seeded(7))).toMatchObject({ index: 1, total: 5, round: 1 })
  })

  it('所选题库没有题目时返回 null,首页状态为空', () => {
    const empty = createBank(db, 'C').id
    expect(startRecite(db, [empty])).toBeNull()
    expect(reciteStatus(db)).toBeNull()
    expect(() => nextQuestion(db)).toThrow('RECITE_NO_SESSION')
  })

  it('首页状态反映当前进度', () => {
    startRecite(db, [a, b], [], seeded())
    nextQuestion(db)
    expect(reciteStatus(db)).toEqual({ bankIds: [a, b].sort(), priorities: [], index: 2, total: 5, round: 1 })
  })

  it('所有题目都被删除时结束会话', () => {
    startRecite(db, [b], [], seeded())
    for (const id of db.all<{ id: string }>('SELECT id FROM questions WHERE bank_id = ?', [b])) deleteQuestion(db, id.id)
    expect(nextQuestion(db)).toBeNull()
    expect(reciteStatus(db)).toBeNull()
  })
})

describe('按优先级背题', () => {
  it('只背所选优先级的题目;筛选条件变化时重新开始', async () => {
    const c = createBank(db, 'C').id
    createQuestion(db, c, { title: '高1', answerMd: '> 优先级：高 ｜ 分类：x\n\n正文' })
    createQuestion(db, c, { title: '高2', answerMd: '> 优先级：高\n正文' })
    createQuestion(db, c, { title: '低1', answerMd: '> 优先级：低\n正文' })
    createQuestion(db, c, { title: '无标注', answerMd: '正文' })
    const s = startRecite(db, [c], ['高'], seeded())!
    expect(s.total).toBe(2)
    expect(s.question.title.startsWith('高')).toBe(true)
    expect(startRecite(db, [c], [], seeded())!.total).toBe(4)
    // 未设置优先级的题目可以单独筛选
    expect(startRecite(db, [c], [NO_PRIORITY], seeded())!.question.title).toBe('无标注')
    expect(reciteStatus(db)?.priorities).toEqual([NO_PRIORITY])
  })
})
