import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../src/main/db/database'
import { createBank, listBanks } from '../../src/main/db/repositories/banks'
import { createQuestion, listQuestionsForBanks } from '../../src/main/db/repositories/questions'
import { getAllSettings, setSetting } from '../../src/main/db/repositories/settings'
import { readZip, safeEntryPath, writeZip } from '../../src/main/services/archive'
import { AssetStore } from '../../src/main/services/assets'
import { createBackup, readBackup } from '../../src/main/services/backup'
import { excelTemplate, exportBankZip, markdownTemplate, safeFileName } from '../../src/main/services/exporter'
import { importLoaded, loadImportFile, resolveConflict } from '../../src/main/services/importer'
import { openTestDb } from '../helpers'

const enc = (s: string) => new TextEncoder().encode(s)
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

let db: Db
let root: string
let assets: AssetStore
beforeEach(async () => {
  db = await openTestDb()
  root = mkdtempSync(join(tmpdir(), 'qb-io-'))
  assets = new AssetStore(root)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const bankZip = (name: string, md: string, images: Record<string, Uint8Array> = {}) =>
  writeZip(
    new Map<string, Uint8Array>([
      [`${name}/questions.md`, enc(md)],
      ...Object.entries(images).map(([k, v]) => [`${name}/${k}`, v] as [string, Uint8Array])
    ])
  )

const MD = '# Java 基础\n\n## q1\n\n---answer---\n\n答案 ![](images/a.png)\n\n## q2\n---answer---\nb\n'

describe('压缩包', () => {
  it('拒绝不安全的路径,忽略 macOS 元数据', () => {
    expect(safeEntryPath('../x.md')).toBeNull()
    expect(safeEntryPath('/etc/passwd')).toBeNull()
    expect(safeEntryPath('C:\\x.md')).toBeNull()
    expect(safeEntryPath('a\\b\\c.png')).toBe('a/b/c.png')
    expect(safeEntryPath('__MACOSX/a/._x.md')).toBeNull()
    const zip = writeZip(new Map([['a/../../evil.md', enc('x')]]))
    expect(() => readZip(zip)).toThrow('ARCHIVE_UNSAFE')
  })

  it('中文文件名打包后能原样读回', () => {
    const files = readZip(writeZip(new Map([['题库/questions.md', enc('内容')]])))
    expect([...files.keys()]).toEqual(['题库/questions.md'])
  })

  it('超出大小限制时报错', () => {
    const zip = writeZip(new Map([['a.md', new Uint8Array(1000)]]))
    expect(() => readZip(zip, { maxEntries: 10, maxEntryBytes: 100, maxTotalBytes: 1000 })).toThrow('ARCHIVE_TOO_LARGE')
  })
})

describe('导入', () => {
  it('导入 zip:题目、图片都写入,图片可以通过地址读取', async () => {
    const loaded = await loadImportFile('Java.zip', bankZip('Java', MD, { 'images/a.png': PNG }))
    const [result] = importLoaded(db, assets, loaded)
    expect(result).toMatchObject({ status: 'imported', name: 'Java 基础', questionCount: 2 })
    const bankId = (result as { bankId: string }).bankId
    expect(listQuestionsForBanks(db, [bankId])[0].questions.map((q) => q.title)).toEqual(['q1', 'q2'])
    expect(readFileSync(assets.resolveUrl(`qb-asset://${bankId}/images/a.png`)!)).toEqual(Buffer.from(PNG))
  })

  it('有问题时整个文件不导入,列出问题', async () => {
    const loaded = await loadImportFile('bad.zip', bankZip('bad', '# x\n## q\n没有分隔线\n## q2\n---answer---\n![](images/no.png)'))
    expect(importLoaded(db, assets, loaded)).toEqual([
      {
        file: 'bad.zip',
        status: 'invalid',
        issues: [
          { code: 'SEPARATOR_MISSING', question: 1, line: 2 },
          { code: 'IMAGE_MISSING', question: 1, detail: 'images/no.png' }
        ]
      }
    ])
    expect(listBanks(db)).toHaveLength(0)
  })

  it('同名时等待选择:另存为新题库 / 覆盖 / 跳过', async () => {
    const first = importLoaded(db, assets, await loadImportFile('a.zip', bankZip('A', MD, { 'images/a.png': PNG })))
    const bankId = (first[0] as { bankId: string }).bankId

    const conflict = importLoaded(db, assets, await loadImportFile('a.zip', bankZip('A', MD, { 'images/a.png': PNG })))
    expect(conflict[0]).toMatchObject({ status: 'conflict', name: 'Java 基础' })
    const saved = resolveConflict(db, assets, (conflict[0] as { token: string }).token, 'saveAsNew')
    expect(saved).toMatchObject({ status: 'imported', name: 'Java 基础 (2)', replaced: false })

    const md2 = '# Java 基础\n## 只有一题\n---answer---\nx'
    const again = importLoaded(db, assets, await loadImportFile('a.zip', bankZip('A', md2)))
    const replaced = resolveConflict(db, assets, (again[0] as { token: string }).token, 'overwrite')
    expect(replaced).toMatchObject({ status: 'imported', bankId, replaced: true, questionCount: 1 })
    expect(listQuestionsForBanks(db, [bankId])[0].questions.map((q) => q.title)).toEqual(['只有一题'])
    expect(existsSync(join(root, bankId))).toBe(false) // 新题库没有图片,旧图片已清除

    const third = importLoaded(db, assets, await loadImportFile('a.zip', bankZip('A', md2)))
    const token = (third[0] as { token: string }).token
    expect(resolveConflict(db, assets, token, 'skip')).toMatchObject({ status: 'skipped' })
    expect(() => resolveConflict(db, assets, token, 'skip')).toThrow('IMPORT_EXPIRED')
    expect(readdirSync(root).filter((d) => d.startsWith('.staging'))).toEqual([])
  })

  it('导入单独的 .md 和 Excel 模板', async () => {
    const md = importLoaded(db, assets, await loadImportFile('笔记.md', enc('## q\n---answer---\na')))
    expect(md[0]).toMatchObject({ status: 'imported', name: '笔记', questionCount: 1 })
    const tpl = await excelTemplate('zh-CN')
    const xlsx = importLoaded(db, assets, await loadImportFile(tpl.fileName, tpl.data))
    expect(xlsx[0]).toMatchObject({ status: 'imported', name: '示例题库', questionCount: 2 })
  })

  it('Markdown 模板可以直接导入', async () => {
    const tpl = markdownTemplate('zh-CN')
    const result = importLoaded(db, assets, await loadImportFile(tpl.fileName, tpl.data))
    expect(result[0]).toMatchObject({ status: 'imported', questionCount: 2 })
  })
})

describe('导出', () => {
  it('导出后再导入,题目和图片一致', async () => {
    const [r] = importLoaded(db, assets, await loadImportFile('a.zip', bankZip('A', MD, { 'images/a.png': PNG })))
    const bankId = (r as { bankId: string }).bankId
    const exported = exportBankZip(db, assets, bankId)
    expect(exported.fileName).toBe('Java 基础.zip')

    const db2 = await openTestDb()
    const assets2 = new AssetStore(mkdtempSync(join(tmpdir(), 'qb-io2-')))
    const [r2] = importLoaded(db2, assets2, await loadImportFile(exported.fileName, exported.data))
    const id2 = (r2 as { bankId: string }).bankId
    const strip = (qs: { title: string; answerMd: string }[]) => qs.map(({ title, answerMd }) => ({ title, answerMd }))
    expect(strip(listQuestionsForBanks(db2, [id2])[0].questions)).toEqual(
      strip(listQuestionsForBanks(db, [bankId])[0].questions)
    )
    expect(assets2.readBankFiles(id2)).toEqual(assets.readBankFiles(bankId))
  })

  it('文件名去掉不能使用的字符', () => {
    expect(safeFileName('a/b:c*?')).toBe('a_b_c__')
  })
})

describe('备份', () => {
  it('备份包含数据库和图片,能读回', async () => {
    const bank = createBank(db, 'A')
    createQuestion(db, bank.id, { title: 'q', answerMd: 'a' })
    setSetting(db, 'theme', 'dark')
    assets.saveImage(bank.id, PNG, 'image/png')
    const data = createBackup(db, assets, '1.0.0')
    const backup = readBackup(data)
    expect([...backup.assets.keys()][0]).toMatch(new RegExp(`^${bank.id}/images/[0-9a-f]{16}\\.png$`))

    // 用备份内容打开数据库
    const dir = mkdtempSync(join(tmpdir(), 'qb-bak-'))
    const file = join(dir, 'app.db')
    require('node:fs').writeFileSync(file, backup.db)
    const restored = await openTestDb(file)
    expect(listBanks(restored).map((b) => b.name)).toEqual(['A'])
    expect(getAllSettings(restored).theme).toBe('dark')
    rmSync(dir, { recursive: true, force: true })
  })

  it('拒绝不是备份的文件', () => {
    expect(() => readBackup(enc('hello'))).toThrow('BACKUP_INVALID')
    expect(() => readBackup(writeZip(new Map([['manifest.json', enc('{"app":"x"}')]])))).toThrow('BACKUP_INVALID')
    const future = writeZip(
      new Map([
        ['manifest.json', enc('{"app":"question-bank","schemaVersion":999}')],
        ['app.db', enc('SQLite format 3\u0000')]
      ])
    )
    expect(() => readBackup(future)).toThrow('BACKUP_TOO_NEW')
  })
})

// 用真实题库验证(本机有这些文件时才运行;题库内容不放进仓库)
const REAL = process.env.QB_REAL_ZIPS ?? '/mnt/user-data/uploads/Desktop/question-bank/题库导入'
describe.skipIf(!existsSync(REAL))('真实题库', () => {
  it('11 个题库全部导入,导出后再导入内容一致', async () => {
    let total = 0
    let images = 0
    for (const f of readdirSync(REAL).filter((x) => x.endsWith('.zip')).sort()) {
      const loaded = await loadImportFile(f, readFileSync(join(REAL, f)))
      const [r] = importLoaded(db, assets, loaded)
      expect(r.status, f).toBe('imported')
      const id = (r as { bankId: string }).bankId
      total += (r as { questionCount: number }).questionCount
      images += assets.readBankFiles(id).size

      const exported = exportBankZip(db, assets, id)
      const db2 = await openTestDb()
      const assets2 = new AssetStore(mkdtempSync(join(tmpdir(), 'qb-real-')))
      const [r2] = importLoaded(db2, assets2, await loadImportFile(exported.fileName, exported.data))
      const id2 = (r2 as { bankId: string }).bankId
      const pick = (d: Db, i: string) => listQuestionsForBanks(d, [i])[0].questions.map((q) => [q.title, q.answerMd])
      expect(pick(db2, id2)).toEqual(pick(db, id))
    }
    expect(total).toBe(1239)
    expect(images).toBe(533)
  }, 120_000)
})
