// 导入格式说明里的示例必须能被真实的解析器正确读取,避免说明和代码不一致。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { imageRefs, parseQuestionsMarkdown, parseSheetRows } from '../../src/main/services/bankFormat'
import { extractMeta } from '../../src/shared/meta'

const dir = join(__dirname, '../../src/renderer/src/assets')

/** 取出 ```markdown 代码块 */
function markdownBlocks(text: string): string[] {
  return [...text.matchAll(/```markdown\n([\s\S]*?)\n```/g)].map((m) => m[1])
}

/** 取出 Excel 一节的表格(表头和第一行数据) */
function excelTable(text: string): string[][] {
  const section = text.slice(text.search(/## (四、Excel|4\. Excel)/))
  const rows = section.split('\n').filter((l) => l.startsWith('|') && !/^\|[-| ]+\|$/.test(l))
  return rows.slice(0, 2).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
}

describe.each([
  ['zh-CN', '高'],
  ['en', '高']
])('import guide %s', (lang, priority) => {
  const text = readFileSync(join(dir, `import-guide.${lang}.md`), 'utf8')
  const [basic, meta] = markdownBlocks(text)

  it('Markdown 示例可以无错误解析', () => {
    const { bank, issues } = parseQuestionsMarkdown(basic)
    expect(issues).toEqual([])
    expect(bank.name).toBeTruthy()
    expect(bank.questions).toHaveLength(2)
    expect(imageRefs(bank.questions[1].answerMd)).toEqual(['images/jvm.png'])
  })

  it('题目信息示例能解析出英文题干、优先级、分类、出处', () => {
    const { bank, issues } = parseQuestionsMarkdown(meta)
    expect(issues).toEqual([])
    const m = extractMeta(bank.questions[0].answerMd).meta
    expect(m.english).toBe('Tell me about yourself.')
    expect(m.priority).toBe(priority)
    expect(m.category).toBeTruthy()
    expect(m.source).toBe('SEEK')
  })

  it('Excel 示例表头全部能识别', () => {
    const { questions, issues } = parseSheetRows(excelTable(text))
    expect(issues).toEqual([])
    expect(questions).toHaveLength(1)
    const m = extractMeta(questions[0].answerMd).meta
    expect(m.priority).toBe('高')
    expect(m.english).toBeTruthy()
    expect(m.category).toBeTruthy()
    expect(m.source).toBeTruthy()
  })
})
