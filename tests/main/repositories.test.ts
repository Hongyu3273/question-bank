import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../src/main/db/database'
import { createBank, deleteBank, getBank, listBanks, renameBank, reorderBanks } from '../../src/main/db/repositories/banks'
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  listQuestions,
  listQuestionsForBanks,
  priorityStats,
  reorderQuestions,
  setBankPriority,
  updateQuestion
} from '../../src/main/db/repositories/questions'
import { LIMITS } from '../../src/shared/types'
import { openTestDb } from '../helpers'

let db: Db
beforeEach(async () => {
  db = await openTestDb()
})

describe('题库', () => {
  it('新建时去掉首尾空白,并按创建顺序排列', () => {
    createBank(db, '  Java 基础 ')
    createBank(db, '网络')
    expect(listBanks(db).map((b) => b.name)).toEqual(['Java 基础', '网络'])
  })

  it('名称为空、过长、重名时报错', () => {
    createBank(db, 'A')
    expect(() => createBank(db, '   ')).toThrow('BANK_NAME_EMPTY')
    expect(() => createBank(db, 'x'.repeat(LIMITS.bankName + 1))).toThrow('BANK_NAME_TOO_LONG')
    expect(() => createBank(db, 'A')).toThrow('BANK_NAME_EXISTS')
    expect(() => createBank(db, 123)).toThrow('INVALID_ARGUMENT')
  })

  it('重命名为自己原来的名字不算重名', () => {
    const a = createBank(db, 'A')
    createBank(db, 'B')
    renameBank(db, a.id, 'A')
    expect(() => renameBank(db, a.id, 'B')).toThrow('BANK_NAME_EXISTS')
    renameBank(db, a.id, 'C')
    expect(getBank(db, a.id).name).toBe('C')
  })

  it('删除题库时一并删除题目', () => {
    const a = createBank(db, 'A')
    createQuestion(db, a.id, { title: 'q', answerMd: '' })
    deleteBank(db, a.id)
    expect(listBanks(db)).toHaveLength(0)
    expect(db.get<{ c: number }>('SELECT COUNT(*) AS c FROM questions')?.c).toBe(0)
    expect(() => deleteBank(db, a.id)).toThrow('BANK_NOT_FOUND')
  })
})

describe('题目', () => {
  it('新增的题目排在末尾,题目数量随之更新', () => {
    const bank = createBank(db, 'A')
    createQuestion(db, bank.id, { title: '第一题', answerMd: 'a' })
    createQuestion(db, bank.id, { title: '第二题', answerMd: 'b' })
    expect(listQuestions(db, bank.id).map((q) => [q.title, q.sortOrder])).toEqual([
      ['第一题', 0],
      ['第二题', 1]
    ])
    expect(getBank(db, bank.id).questionCount).toBe(2)
  })

  it('修改题干和答案;答案保留原样', () => {
    const bank = createBank(db, 'A')
    const q = createQuestion(db, bank.id, { title: 't', answerMd: '' })
    const updated = updateQuestion(db, q.id, { title: ' 新题干 ', answerMd: '  - 列表\n' })
    expect(updated).toMatchObject({ title: '新题干', answerMd: '  - 列表\n', bankId: bank.id })
    expect(getQuestion(db, q.id).answerMd).toBe('  - 列表\n')
  })

  it('题干为空或参数不合法时报错', () => {
    const bank = createBank(db, 'A')
    expect(() => createQuestion(db, bank.id, { title: ' ', answerMd: '' })).toThrow('QUESTION_TITLE_EMPTY')
    expect(() => createQuestion(db, bank.id, { title: 't' })).toThrow('INVALID_ARGUMENT')
    expect(() => createQuestion(db, 'missing', { title: 't', answerMd: '' })).toThrow('BANK_NOT_FOUND')
    expect(() => createQuestion(db, bank.id, { title: 't', answerMd: 'x'.repeat(LIMITS.answer + 1) })).toThrow(
      'ANSWER_TOO_LONG'
    )
  })

  it('删除题目', () => {
    const bank = createBank(db, 'A')
    const q = createQuestion(db, bank.id, { title: 't', answerMd: '' })
    deleteQuestion(db, q.id)
    expect(listQuestions(db, bank.id)).toHaveLength(0)
    expect(() => getQuestion(db, q.id)).toThrow('QUESTION_NOT_FOUND')
  })
})

describe('题目摘要', () => {
  it('列表返回去掉 Markdown 标记的答案摘要', () => {
    const bank = createBank(db, 'A')
    createQuestion(db, bank.id, {
      title: 't',
      answerMd: '## 要点\n\n- **数组** + 链表\n\n```java\nint x;\n```\n\n![图](images/a.png) 见[文档](https://a.b)'
    })
    expect(listQuestions(db, bank.id)[0].snippet).toBe('要点 数组 + 链表 见文档')
  })
})

describe('看题:多个题库的全部题目', () => {
  it('按题库顺序、题内顺序返回,并忽略不存在的题库', () => {
    const a = createBank(db, 'A')
    const b = createBank(db, 'B')
    createQuestion(db, b.id, { title: 'b1', answerMd: 'x' })
    createQuestion(db, a.id, { title: 'a1', answerMd: 'y' })
    createQuestion(db, a.id, { title: 'a2', answerMd: 'z' })
    const result = listQuestionsForBanks(db, [b.id, 'missing', a.id])
    expect(result.map((r) => [r.name, r.questions.map((q) => q.title)])).toEqual([
      ['A', ['a1', 'a2']],
      ['B', ['b1']]
    ])
    expect(result[0].questions[0].answerMd).toBe('y')
    expect(listQuestionsForBanks(db, [])).toEqual([])
    expect(() => listQuestionsForBanks(db, 'x')).toThrow('INVALID_ARGUMENT')
  })
})

describe('优先级统计', () => {
  it('按 高、中、低 统计,未标注的单独计数;摘要不含元信息', () => {
    const bank = createBank(db, 'A')
    createQuestion(db, bank.id, { title: 'a', answerMd: '*English: A*\n\n> 优先级：低 ｜ 分类：x\n\n正文一' })
    createQuestion(db, bank.id, { title: 'b', answerMd: '> 优先级：高\n正文' })
    createQuestion(db, bank.id, { title: 'c', answerMd: '正文' })
    expect(priorityStats(db, [bank.id])).toEqual({
      total: 3,
      counts: [
        { priority: '高', count: 1 },
        { priority: '低', count: 1 }
      ],
      unlabeled: 1
    })
    expect(listQuestions(db, bank.id)[0].snippet).toBe('正文一')
  })
})

describe('排序', () => {
  it('重排题库和题目;id 不完整或重复时拒绝', () => {
    const a = createBank(db, 'A')
    const b = createBank(db, 'B')
    reorderBanks(db, [b.id, a.id])
    expect(listBanks(db).map((x) => x.name)).toEqual(['B', 'A'])
    expect(() => reorderBanks(db, [a.id])).toThrow('INVALID_ARGUMENT')
    expect(() => reorderBanks(db, [a.id, a.id])).toThrow('INVALID_ARGUMENT')

    const q1 = createQuestion(db, a.id, { title: '1', answerMd: '' })
    const q2 = createQuestion(db, a.id, { title: '2', answerMd: '' })
    const q3 = createQuestion(db, a.id, { title: '3', answerMd: '' })
    reorderQuestions(db, a.id, [q3.id, q1.id, q2.id])
    expect(listQuestions(db, a.id).map((q) => q.title)).toEqual(['3', '1', '2'])
    expect(() => reorderQuestions(db, a.id, [q1.id, q2.id])).toThrow('INVALID_ARGUMENT')
    // 新增的题目排在最后
    createQuestion(db, a.id, { title: '4', answerMd: '' })
    expect(listQuestions(db, a.id).map((q) => q.title)).toEqual(['3', '1', '2', '4'])
  })
})

describe('批量设置优先级', () => {
  it('只补未设置的、全部覆盖、清除;列表返回优先级', () => {
    const bank = createBank(db, 'A')
    createQuestion(db, bank.id, { title: 'a', answerMd: '> 优先级：高 ｜ 分类：x\n\n正文' })
    createQuestion(db, bank.id, { title: 'b', answerMd: '正文' })
    expect(setBankPriority(db, bank.id, '中', 'missing')).toBe(1)
    expect(listQuestions(db, bank.id).map((q) => q.priority)).toEqual(['高', '中'])
    expect(setBankPriority(db, bank.id, '低', 'all')).toBe(2)
    expect(listQuestionsForBanks(db, [bank.id])[0].questions[0].answerMd).toBe('> 优先级：低 ｜ 分类：x\n\n正文')
    expect(setBankPriority(db, bank.id, null, 'all')).toBe(2)
    expect(listQuestions(db, bank.id).map((q) => q.priority)).toEqual([null, null])
    expect(listQuestionsForBanks(db, [bank.id])[0].questions[1].answerMd).toBe('正文')
    expect(() => setBankPriority(db, bank.id, '高', 'some')).toThrow('INVALID_ARGUMENT')
  })
})
