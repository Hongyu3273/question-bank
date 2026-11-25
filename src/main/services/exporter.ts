import writeXlsxFile from 'write-excel-file/node'
import type { Db } from '../db/database'
import { getBank } from '../db/repositories/banks'
import { listQuestionsForBanks } from '../db/repositories/questions'
import { writeZip } from './archive'
import type { AssetStore } from './assets'
import { serializeQuestionsMarkdown } from './bankFormat'

/** 文件名中不能出现的字符替换为下划线 */
export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '') || 'bank'
}

/** 导出题库:<题库名>/questions.md + <题库名>/images/,与导入格式相同 */
export function exportBankZip(db: Db, assets: AssetStore, bankId: string): { fileName: string; data: Uint8Array } {
  const bank = getBank(db, bankId)
  const questions = listQuestionsForBanks(db, [bankId])[0]?.questions ?? []
  const folder = safeFileName(bank.name)
  const entries = new Map<string, Uint8Array>()
  entries.set(`${folder}/questions.md`, new TextEncoder().encode(serializeQuestionsMarkdown(bank.name, questions)))
  for (const [path, content] of assets.readBankFiles(bankId)) entries.set(`${folder}/${path}`, content)
  return { fileName: `${folder}.zip`, data: writeZip(entries) }
}

/** Markdown 模板:一个示例题库的压缩包 */
export function markdownTemplate(language: string): { fileName: string; data: Uint8Array } {
  const zh = language !== 'en'
  const name = zh ? '示例题库' : 'Sample bank'
  const md = zh
    ? `# ${name}

## HashMap 的底层数据结构是什么?

---answer---

JDK 8 以后是 **数组 + 链表 + 红黑树**:

- 链表长度超过 8 且数组长度 ≥ 64 时,链表转为红黑树
- 默认容量 16,负载因子 0.75

\`\`\`java
Map<String, Integer> map = new HashMap<>();
\`\`\`

## 什么是时间复杂度?

---answer---

衡量算法运行时间随输入规模增长的趋势,例如二分查找是 $O(\\log n)$。

| 算法 | 复杂度 |
| --- | --- |
| 二分查找 | O(log n) |
| 冒泡排序 | O(n²) |

<!-- 图片:把图片放进与 questions.md 同级的 images 文件夹,在答案里用 Markdown 图片语法引用 images/文件名.png -->
`
    : `# ${name}

## What is the underlying structure of HashMap?

---answer---

Since JDK 8 it is **array + linked list + red-black tree**.

- A bucket's list becomes a tree when it exceeds 8 entries and the table has at least 64 buckets
- Default capacity 16, load factor 0.75

## What is time complexity?

---answer---

How running time grows with input size, e.g. binary search is $O(\\log n)$.
`
  const entries = new Map<string, Uint8Array>([[`${name}/questions.md`, new TextEncoder().encode(md)]])
  return { fileName: `${name}.zip`, data: writeZip(entries) }
}

/** Excel 模板:表头"题干""答案"加两行示例 */
export async function excelTemplate(language: string): Promise<{ fileName: string; data: Uint8Array }> {
  const zh = language !== 'en'
  // 前两列必填,后面的列可以删掉或留空
  const header = zh ? ['题干', '答案', '优先级', '分类', '英文题干'] : ['Question', 'Answer', 'Priority', 'Category', 'English']
  const rows = zh
    ? [
        ['HashMap 的底层数据结构是什么?', 'JDK 8 以后是 **数组 + 链表 + 红黑树**', '高', 'Java 集合', 'What is the underlying structure of HashMap?'],
        ['什么是时间复杂度?', '衡量算法运行时间随输入规模增长的趋势', '中', '算法', '']
      ]
    : [
        ['What is the underlying structure of HashMap?', 'Since JDK 8: **array + linked list + red-black tree**', 'High', 'Java', ''],
        ['What is time complexity?', 'How running time grows with input size', 'Medium', 'Algorithms', '']
      ]
  const buffer = await writeXlsxFile(
    [header.map((value) => ({ value, fontWeight: 'bold' as const })), ...rows.map((r) => r.map((value) => ({ value })))],
    { columns: [{ width: 50 }, { width: 80 }, { width: 10 }, { width: 20 }, { width: 50 }] }
  ).toBuffer()
  return { fileName: zh ? '示例题库.xlsx' : 'sample-bank.xlsx', data: new Uint8Array(buffer) }
}
