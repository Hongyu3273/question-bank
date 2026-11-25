// 答案开头的元信息:
//   *English: Tell me about yourself.*
//   > 优先级:高 | 分类:通用 HR 高频 | 出处:SEEK
// 只在显示和筛选时解析,存储的答案保持原样(导入导出无损)。

export interface QuestionMeta {
  /** 英文题干 */
  english?: string
  /** 优先级,如 高 / 中 / 低 */
  priority?: string
  /** 分类 */
  category?: string
  /** 出处 */
  source?: string
}

const KEYS: Record<string, keyof QuestionMeta> = {
  优先级: 'priority',
  priority: 'priority',
  分类: 'category',
  category: 'category',
  出处: 'source',
  来源: 'source',
  source: 'source'
}

const ENGLISH = /^\*English:\s*(.+?)\*\s*$/i
const META_LINE = /^>\s*(优先级|priority|分类|category)\s*[：:]/i

/** 解析元信息行(> 优先级:高 | 分类:… | 出处:…) */
function parseMetaLine(line: string, meta: QuestionMeta): void {
  for (const part of line.replace(/^>\s*/, '').split(/\s*[｜|]\s*/)) {
    const m = /^([^：:]+)[：:]\s*(.*)$/.exec(part.trim())
    if (!m) continue
    const key = KEYS[m[1].trim().toLowerCase()] ?? KEYS[m[1].trim()]
    const value = m[2].trim()
    if (key && value && key !== 'english') meta[key] = value
  }
}

/**
 * 从答案开头取出元信息,返回元信息和去掉这些行之后的正文。
 * 只检查开头的几行非空内容,正文中间的同类文字不受影响。
 */
export function extractMeta(answerMd: string): { meta: QuestionMeta; body: string } {
  const lines = answerMd.split('\n')
  const meta: QuestionMeta = {}
  let i = 0
  let consumed = 0
  for (let seen = 0; i < lines.length && seen < 3; i++) {
    const line = lines[i].trim()
    if (!line) continue
    seen++
    const en = ENGLISH.exec(line)
    if (en && !meta.english) {
      meta.english = en[1].trim()
      consumed = i + 1
    } else if (META_LINE.test(line) && !meta.priority && !meta.category) {
      parseMetaLine(line, meta)
      consumed = i + 1
    } else {
      break
    }
  }
  if (consumed === 0) return { meta, body: answerMd }
  return { meta, body: lines.slice(consumed).join('\n').replace(/^\s*\n/, '') }
}

/** 只取优先级(筛选用) */
export function priorityOf(answerMd: string): string | null {
  return extractMeta(answerMd.slice(0, 1000)).meta.priority ?? null
}

/** 优先级的排序:高、中、低在前,其他按字母 */
export function comparePriority(a: string, b: string): number {
  const order = ['高', '中', '低', 'high', 'medium', 'low']
  const ia = order.indexOf(a.toLowerCase())
  const ib = order.indexOf(b.toLowerCase())
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  return a.localeCompare(b)
}
