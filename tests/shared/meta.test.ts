import { describe, expect, it } from 'vitest'
import {
  comparePriority,
  composeAnswer,
  extractMeta,
  NO_PRIORITY,
  priorityKey,
  priorityOf,
  updateMeta
} from '../../src/shared/meta'

const ANSWER = `*English: Tell me about yourself.*

> 优先级：高 ｜ 分类：通用 HR 高频 ｜ 出处：SEEK：雇主 Interview Builder

60–90 秒,按「现在—过去—将来」。

> 普通引用不受影响`

describe('extractMeta', () => {
  it('取出英文题干、优先级、分类、出处,正文去掉这两行', () => {
    const { meta, body } = extractMeta(ANSWER)
    expect(meta).toEqual({
      english: 'Tell me about yourself.',
      priority: '高',
      category: '通用 HR 高频',
      source: 'SEEK：雇主 Interview Builder'
    })
    expect(body.startsWith('60–90 秒')).toBe(true)
    expect(body).toContain('> 普通引用不受影响')
  })

  it('支持半角符号和英文键名;没有元信息时原样返回', () => {
    expect(extractMeta('> Priority: High | Category: Java\n\n正文').meta).toEqual({ priority: 'High', category: 'Java' })
    expect(extractMeta('> 优先级:中\n正文').meta.priority).toBe('中')
    expect(extractMeta('普通答案\n> 优先级：高')).toEqual({ meta: {}, body: '普通答案\n> 优先级：高' })
    expect(priorityOf('没有元信息')).toBeNull()
  })

  it('优先级排序:高、中、低', () => {
    expect(['低', '其他', '高', '中'].sort(comparePriority)).toEqual(['高', '中', '低', '其他'])
  })
})

describe('composeAnswer / updateMeta', () => {
  it('组合后再解析,内容一致', () => {
    const meta = { english: 'Why?', priority: '高', category: 'Java', source: 'SEEK：x' }
    const md = composeAnswer(meta, '正文\n\n- 列表')
    expect(md).toBe('*English: Why?*\n\n> 优先级：高 ｜ 分类：Java ｜ 出处：SEEK：x\n\n正文\n\n- 列表')
    expect(extractMeta(md)).toEqual({ meta, body: '正文\n\n- 列表' })
  })

  it('没有元信息时只返回正文;只有元信息时不留多余空行', () => {
    expect(composeAnswer({}, '正文')).toBe('正文')
    expect(composeAnswer({ priority: '低' }, '')).toBe('> 优先级：低')
  })

  it('修改、新增、删除优先级,保留其他元信息和正文', () => {
    const original = '*English: A*\n\n> 优先级：低 ｜ 分类：x\n\n正文'
    expect(updateMeta(original, { priority: '高' })).toBe('*English: A*\n\n> 优先级：高 ｜ 分类：x\n\n正文')
    expect(updateMeta('正文', { priority: '中' })).toBe('> 优先级：中\n\n正文')
    expect(updateMeta(original, { priority: '' })).toBe('*English: A*\n\n> 分类：x\n\n正文')
    expect(updateMeta('> 优先级：高\n\n正文', { priority: '' })).toBe('正文')
  })

  it('未设置优先级的筛选键', () => {
    expect(priorityKey('正文')).toBe(NO_PRIORITY)
    expect(priorityKey('> 优先级：高\n正文')).toBe('高')
  })
})
