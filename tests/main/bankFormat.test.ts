import { describe, expect, it } from 'vitest'
import {
  checkImages,
  imageRefs,
  parseQuestionsMarkdown,
  parseSheetRows,
  serializeQuestionsMarkdown
} from '../../src/main/services/bankFormat'

const SAMPLE = `# Java 基础

## HashMap 的底层结构?

---answer---

数组 + 链表 + 红黑树

\`\`\`java
## 这不是新题目
---answer---
\`\`\`

![](images/a.png)

## String 为什么不可变?
---answer---
常量池
`

describe('parseQuestionsMarkdown', () => {
  it('解析题库名、题干和答案,代码块内的 ## 不算新题', () => {
    const { bank, issues } = parseQuestionsMarkdown(SAMPLE)
    expect(issues).toEqual([])
    expect(bank.name).toBe('Java 基础')
    expect(bank.questions.map((q) => q.title)).toEqual(['HashMap 的底层结构?', 'String 为什么不可变?'])
    expect(bank.questions[0].answerMd).toContain('## 这不是新题目')
    expect(bank.questions[0].answerMd.startsWith('数组')).toBe(true)
    expect(bank.questions[1].answerMd).toBe('常量池')
  })

  it('处理 Windows 换行和 BOM', () => {
    const { bank } = parseQuestionsMarkdown('﻿# A\r\n\r\n## q\r\n---answer---\r\nx\r\n')
    expect(bank).toEqual({ name: 'A', questions: [{ title: 'q', answerMd: 'x' }] })
  })

  it('报告缺少分隔线、题干为空、没有题目,并给出题号和行号', () => {
    const { issues } = parseQuestionsMarkdown('# A\n\n## 第一题\n答案\n\n## \n---answer---\nx')
    expect(issues).toEqual([
      { code: 'SEPARATOR_MISSING', question: 1, line: 3 },
      { code: 'TITLE_EMPTY', question: 2, line: 6 }
    ])
    expect(parseQuestionsMarkdown('# 只有标题').issues).toEqual([{ code: 'NO_QUESTIONS' }])
  })
})

describe('图片引用', () => {
  it('提取相对路径,忽略网络图片和代码块', () => {
    const md = '![a](images/a.png) ![b](./images/b.png "t")\n![c](https://x.com/c.png)\n```\n![d](images/d.png)\n```'
    expect(imageRefs(md)).toEqual(['images/a.png', 'images/b.png'])
  })

  it('报告缺失的图片', () => {
    const issues = checkImages([{ title: 't', answerMd: '![](images/a.png)' }], new Set())
    expect(issues).toEqual([{ code: 'IMAGE_MISSING', question: 1, detail: 'images/a.png' }])
  })
})

describe('serializeQuestionsMarkdown', () => {
  it('生成后再解析,内容不变', () => {
    const { bank } = parseQuestionsMarkdown(SAMPLE)
    const again = parseQuestionsMarkdown(serializeQuestionsMarkdown('Java 基础', bank.questions))
    expect(again.issues).toEqual([])
    expect(again.bank).toEqual(bank)
  })

  it('答案中的 ## 标题降级、---answer--- 行转义,避免被当成新题', () => {
    const md = serializeQuestionsMarkdown('A', [{ title: 'q', answerMd: '## 小标题\n---answer---\n正文' }])
    const { bank, issues } = parseQuestionsMarkdown(md)
    expect(issues).toEqual([])
    expect(bank.questions).toHaveLength(1)
    expect(bank.questions[0].answerMd).toBe('### 小标题\n\\---answer---\n正文')
  })

  it('空答案的题目也能往返', () => {
    const { bank } = parseQuestionsMarkdown(serializeQuestionsMarkdown('A', [{ title: 'q', answerMd: '' }]))
    expect(bank.questions).toEqual([{ title: 'q', answerMd: '' }])
  })
})

describe('parseSheetRows', () => {
  it('按表头找到题干和答案列,跳过空行', () => {
    const { questions, issues } = parseSheetRows([
      ['编号', '题干', '答案'],
      [1, 'q1', 'a1'],
      [null, null, null],
      [3, 'q2', 42]
    ])
    expect(issues).toEqual([])
    expect(questions).toEqual([
      { title: 'q1', answerMd: 'a1' },
      { title: 'q2', answerMd: '42' }
    ])
  })

  it('支持英文表头;报告缺少表头和题干为空的行', () => {
    expect(parseSheetRows([['Question', 'Answer'], ['q', 'a']]).questions).toHaveLength(1)
    expect(parseSheetRows([['a', 'b']]).issues).toEqual([{ code: 'EXCEL_HEADER_MISSING' }])
    expect(parseSheetRows([['题干', '答案'], [null, '只有答案']]).issues).toEqual([{ code: 'TITLE_EMPTY', row: 2 }])
  })
})
