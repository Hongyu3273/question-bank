// 题库文件格式:Markdown(questions.md)的解析与生成,以及 Excel 表格行的解析。
// 只处理文本,不读写文件,方便单独测试。

import { composeAnswer } from '../../shared/meta'
import { LIMITS } from '../../shared/types'
import type { ImportIssue } from '../../shared/types'

export interface ParsedQuestion {
  title: string
  answerMd: string
}

export interface ParsedBank {
  /** 文件中 # 一级标题给出的题库名;没有时为 null */
  name: string | null
  questions: ParsedQuestion[]
}

export const ANSWER_SEPARATOR = '---answer---'

const FENCE = /^ {0,3}(`{3,}|~{3,})/

/** 逐行遍历,标记每一行是否在代码块内 */
function* linesWithFence(text: string): Generator<{ line: string; no: number; inCode: boolean }> {
  let fence: string | null = null
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = FENCE.exec(line)
    if (m) {
      const marker = m[1]
      if (fence === null) {
        fence = marker
        yield { line, no: i + 1, inCode: true }
        continue
      }
      if (marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) {
        fence = null
        yield { line, no: i + 1, inCode: true }
        continue
      }
    }
    yield { line, no: i + 1, inCode: fence !== null }
  }
}

function trimBlankLines(lines: string[]): string {
  let start = 0
  let end = lines.length
  while (start < end && !lines[start].trim()) start++
  while (end > start && !lines[end - 1].trim()) end--
  return lines.slice(start, end).join('\n')
}

/**
 * 解析 questions.md。
 * - 第一道题之前的 "# 标题" 是题库名
 * - 每个 "## " 开始一道题,标题文字为题干
 * - 题干之后单独一行 ---answer---,其后直到下一个 "## " 为答案
 * - 代码块内的 "##" 和 ---answer--- 不参与解析
 */
export function parseQuestionsMarkdown(raw: string): { bank: ParsedBank; issues: ImportIssue[] } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const issues: ImportIssue[] = []
  let name: string | null = null

  interface Draft {
    title: string
    line: number
    separator: boolean
    before: string[]
    answer: string[]
  }
  const drafts: Draft[] = []
  let current: Draft | null = null

  for (const { line, no, inCode } of linesWithFence(text)) {
    if (!inCode && /^##\s/.test(line)) {
      current = { title: line.replace(/^##\s+/, '').trim(), line: no, separator: false, before: [], answer: [] }
      drafts.push(current)
      continue
    }
    if (!current) {
      if (!inCode && name === null && /^#\s/.test(line)) name = line.replace(/^#\s+/, '').trim() || null
      continue
    }
    if (!inCode && !current.separator && line.trim() === ANSWER_SEPARATOR) {
      current.separator = true
      continue
    }
    if (current.separator) current.answer.push(line)
    else current.before.push(line)
  }

  const questions: ParsedQuestion[] = []
  drafts.forEach((d, i) => {
    const question = i + 1
    if (!d.title) issues.push({ code: 'TITLE_EMPTY', question, line: d.line })
    else if (d.title.length > LIMITS.questionTitle) issues.push({ code: 'TITLE_TOO_LONG', question, line: d.line })
    if (!d.separator) {
      issues.push({ code: 'SEPARATOR_MISSING', question, line: d.line })
      return
    }
    if (d.before.some((l) => l.trim())) issues.push({ code: 'TEXT_BEFORE_SEPARATOR', question, line: d.line })
    const answerMd = trimBlankLines(d.answer)
    if (answerMd.length > LIMITS.answer) issues.push({ code: 'ANSWER_TOO_LONG', question, line: d.line })
    questions.push({ title: d.title, answerMd })
  })

  if (drafts.length === 0) issues.push({ code: 'NO_QUESTIONS' })
  return { bank: { name, questions }, issues }
}

/** 答案中引用的图片路径(不含网络图片),统一去掉开头的 ./ */
export function imageRefs(answerMd: string): string[] {
  const refs: string[] = []
  for (const { line, inCode } of linesWithFence(answerMd)) {
    if (inCode) continue
    for (const m of line.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g)) {
      const src = m[1]
      if (/^[a-z][a-z0-9+.-]*:/i.test(src)) continue
      refs.push(src.replace(/^\.\//, ''))
    }
  }
  return refs
}

/** 检查答案里引用的图片是否都存在 */
export function checkImages(questions: ParsedQuestion[], available: Set<string>): ImportIssue[] {
  const issues: ImportIssue[] = []
  questions.forEach((q, i) => {
    for (const ref of imageRefs(q.answerMd)) {
      if (!available.has(ref)) issues.push({ code: 'IMAGE_MISSING', question: i + 1, detail: ref })
    }
  })
  return issues
}

/**
 * 生成 questions.md。
 * 答案中会被误认为新题目的行做最小改动:代码块外的 "## " 标题降为 "### ",单独的 ---answer--- 行加转义。
 */
export function serializeQuestionsMarkdown(name: string, questions: ParsedQuestion[]): string {
  const parts = [`# ${name}`, '']
  for (const q of questions) {
    const answer: string[] = []
    for (const { line, inCode } of linesWithFence(q.answerMd.replace(/\r\n?/g, '\n'))) {
      if (!inCode && /^##\s/.test(line)) answer.push(`#${line}`)
      else if (!inCode && line.trim() === ANSWER_SEPARATOR) answer.push(`\\${line}`)
      else answer.push(line)
    }
    parts.push(`## ${q.title.replace(/\s*\n\s*/g, ' ')}`, '', ANSWER_SEPARATOR, '')
    if (q.answerMd.trim()) parts.push(answer.join('\n'), '')
  }
  return parts.join('\n')
}

const TITLE_HEADERS = ['题干', '题目', '问题', 'question', 'title']
const ANSWER_HEADERS = ['答案', '参考答案', 'answer']
const PRIORITY_HEADERS = ['优先级', 'priority']
const CATEGORY_HEADERS = ['分类', 'category']
const ENGLISH_HEADERS = ['英文题干', '英文', 'english']
const SOURCE_HEADERS = ['出处', '来源', 'source']

type Cell = string | number | boolean | Date | null

function cellText(value: Cell | undefined): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

/**
 * 解析 Excel 第一个工作表:第一行为表头,需要"题干""答案"两列;
 * 可选"优先级""分类""英文题干""出处"列,写入答案开头的元信息。
 */
export function parseSheetRows(rows: Cell[][]): { questions: ParsedQuestion[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = []
  const header = (rows[0] ?? []).map((c) => cellText(c).trim().toLowerCase())
  const titleCol = header.findIndex((h) => TITLE_HEADERS.includes(h))
  const answerCol = header.findIndex((h) => ANSWER_HEADERS.includes(h))
  if (titleCol === -1 || answerCol === -1) {
    return { questions: [], issues: [{ code: 'EXCEL_HEADER_MISSING' }] }
  }
  const col = (names: string[]) => header.findIndex((h) => names.includes(h))
  const extra = {
    priority: col(PRIORITY_HEADERS),
    category: col(CATEGORY_HEADERS),
    english: col(ENGLISH_HEADERS),
    source: col(SOURCE_HEADERS)
  }
  const cell = (row: Cell[], i: number) => (i === -1 ? '' : cellText(row[i]).replace(/\s*\n\s*/g, ' ').trim())
  const questions: ParsedQuestion[] = []
  rows.slice(1).forEach((row, i) => {
    const line = i + 2
    const title = cellText(row[titleCol]).replace(/\s*\n\s*/g, ' ').trim()
    const body = cellText(row[answerCol]).replace(/\r\n?/g, '\n').trim()
    const answerMd = composeAnswer(
      {
        priority: cell(row, extra.priority),
        category: cell(row, extra.category),
        english: cell(row, extra.english),
        source: cell(row, extra.source)
      },
      body
    )
    if (!title && !body) return
    if (!title) {
      issues.push({ code: 'TITLE_EMPTY', row: line })
      return
    }
    if (title.length > LIMITS.questionTitle) issues.push({ code: 'TITLE_TOO_LONG', row: line })
    if (answerMd.length > LIMITS.answer) issues.push({ code: 'ANSWER_TOO_LONG', row: line })
    questions.push({ title, answerMd })
  })
  if (questions.length === 0 && issues.length === 0) issues.push({ code: 'NO_QUESTIONS' })
  return { questions, issues }
}
