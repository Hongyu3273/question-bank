import { keepProgressByTitle } from './srs'
import { randomUUID } from 'node:crypto'
import { basename, extname } from 'node:path'
import readXlsxFile from 'read-excel-file/node'
import { AppError } from '../../shared/errors'
import type { ImportIssue, ImportResult } from '../../shared/types'
import type { Db } from '../db/database'
import { createBank, getBank } from '../db/repositories/banks'
import { insertQuestions } from '../db/repositories/questions'
import { readZip } from './archive'
import type { AssetStore } from './assets'
import { checkImages, parseQuestionsMarkdown, parseSheetRows, type ParsedQuestion } from './bankFormat'

/** 一个待导入的题库 */
export interface ImportCandidate {
  name: string
  questions: ParsedQuestion[]
  /** 相对路径(images/xxx.png)→ 内容 */
  images: Map<string, Uint8Array>
}

export interface LoadedFile {
  file: string
  candidates: ImportCandidate[]
  issues: ImportIssue[]
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i

const fileStem = (file: string) => basename(file, extname(file))

/**
 * 从 zip 中读取题库:每个 questions.md(或唯一的 .md 文件)是一个题库,
 * 同目录下 images/ 中的图片随题库导入。一个压缩包可以包含多个题库。
 */
export function loadZip(file: string, data: Uint8Array): LoadedFile {
  const entries = readZip(data)
  const mdFiles = [...entries.keys()].filter((p) => p.toLowerCase().endsWith('.md'))
  let sources = mdFiles.filter((p) => basename(p).toLowerCase() === 'questions.md')
  if (sources.length === 0 && mdFiles.length === 1) sources = mdFiles
  if (sources.length === 0) throw new AppError('ARCHIVE_NO_QUESTIONS')

  const candidates: ImportCandidate[] = []
  const issues: ImportIssue[] = []
  for (const source of sources.sort()) {
    const dir = source.includes('/') ? source.slice(0, source.lastIndexOf('/') + 1) : ''
    const parsed = parseQuestionsMarkdown(new TextDecoder().decode(entries.get(source)))
    const images = new Map<string, Uint8Array>()
    for (const [path, content] of entries) {
      if (path.startsWith(`${dir}images/`) && IMAGE_EXT.test(path)) images.set(path.slice(dir.length), content)
    }
    const folder = dir ? basename(dir.slice(0, -1)) : fileStem(file)
    const fileIssues = [...parsed.issues, ...checkImages(parsed.bank.questions, new Set(images.keys()))]
    issues.push(...fileIssues.map((i) => (sources.length > 1 ? { ...i, detail: i.detail ?? source } : i)))
    candidates.push({ name: parsed.bank.name || folder, questions: parsed.bank.questions, images })
  }
  return { file, candidates, issues }
}

/** 单独的 .md 文件:不带图片 */
export function loadMarkdown(file: string, text: string): LoadedFile {
  const parsed = parseQuestionsMarkdown(text)
  return {
    file,
    candidates: [{ name: parsed.bank.name || fileStem(file), questions: parsed.bank.questions, images: new Map() }],
    issues: [...parsed.issues, ...checkImages(parsed.bank.questions, new Set())]
  }
}

/** Excel(.xlsx):读取第一个工作表,题库名默认用文件名 */
export async function loadExcel(file: string, data: Uint8Array): Promise<LoadedFile> {
  let sheets: Awaited<ReturnType<typeof readXlsxFile<number>>>
  try {
    sheets = await readXlsxFile<number>(Buffer.from(data))
  } catch {
    throw new AppError('EXCEL_INVALID')
  }
  const parsed = parseSheetRows(sheets[0]?.data ?? [])
  return { file, candidates: [{ name: fileStem(file), questions: parsed.questions, images: new Map() }], issues: parsed.issues }
}

export async function loadImportFile(file: string, data: Uint8Array): Promise<LoadedFile> {
  const ext = extname(file).toLowerCase()
  if (ext === '.zip') return loadZip(file, data)
  if (ext === '.md' || ext === '.markdown') return loadMarkdown(file, new TextDecoder().decode(data))
  if (ext === '.xlsx') return loadExcel(file, data)
  throw new AppError('IMPORT_TYPE_UNSUPPORTED')
}

/** 题库名不能重复:在名称后加序号,如 "Java 基础 (2)" */
export function uniqueBankName(db: Db, name: string): string {
  const exists = (n: string) => db.get('SELECT 1 AS x FROM banks WHERE name = ?', [n]) !== undefined
  if (!exists(name)) return name
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`
    if (!exists(candidate)) return candidate
  }
}

/** 写入一个题库。target 为已有题库 id 时覆盖该题库的题目和图片 */
export function commitCandidate(
  db: Db,
  assets: AssetStore,
  candidate: ImportCandidate,
  target?: string
): { bankId: string; name: string; questionCount: number } {
  if (target) {
    const bank = getBank(db, target)
    const staged = assets.stageImages(candidate.images)
    try {
      db.transaction(() => {
        // 题干相同的题目保留学习进度
        const restore = keepProgressByTitle(db, target)
        db.run('DELETE FROM questions WHERE bank_id = ?', [target])
        insertQuestions(db, target, candidate.questions)
        restore()
      })
    } catch (err) {
      assets.discardStaged(staged)
      throw err
    }
    assets.replaceBankImages(target, staged)
    return { bankId: target, name: bank.name, questionCount: candidate.questions.length }
  }

  const bank = db.transaction(() => {
    const created = createBank(db, uniqueBankName(db, candidate.name))
    insertQuestions(db, created.id, candidate.questions)
    return created
  })
  try {
    const staged = assets.stageImages(candidate.images)
    assets.replaceBankImages(bank.id, staged)
  } catch (err) {
    db.run('DELETE FROM banks WHERE id = ?', [bank.id])
    throw err
  }
  return { bankId: bank.id, name: bank.name, questionCount: candidate.questions.length }
}

/** 等待用户选择"覆盖 / 另存 / 跳过"的同名题库 */
const pending = new Map<string, { file: string; candidate: ImportCandidate; createdAt: number }>()
const PENDING_TTL = 30 * 60 * 1000

function prunePending(): void {
  const now = Date.now()
  for (const [token, p] of pending) if (now - p.createdAt > PENDING_TTL) pending.delete(token)
}

/** 导入一个已读取的文件:有问题时整体不导入;同名时等待用户选择;否则直接写入 */
export function importLoaded(db: Db, assets: AssetStore, loaded: LoadedFile): ImportResult[] {
  const file = basename(loaded.file)
  if (loaded.issues.length > 0) return [{ file, status: 'invalid', issues: loaded.issues }]
  prunePending()
  return loaded.candidates.map((candidate): ImportResult => {
    const clash = db.get<{ id: string }>('SELECT id FROM banks WHERE name = ?', [candidate.name.trim()])
    if (clash) {
      const token = randomUUID()
      pending.set(token, { file, candidate, createdAt: Date.now() })
      return { file, status: 'conflict', token, name: candidate.name.trim(), questionCount: candidate.questions.length }
    }
    const r = commitCandidate(db, assets, candidate)
    return { file, status: 'imported', replaced: false, ...r }
  })
}

/** 处理同名冲突:overwrite 覆盖原题库,saveAsNew 另存为新题库,skip 不导入 */
export function resolveConflict(
  db: Db,
  assets: AssetStore,
  token: unknown,
  choice: unknown
): ImportResult {
  if (typeof token !== 'string' || !['overwrite', 'saveAsNew', 'skip'].includes(choice as string)) {
    throw new AppError('INVALID_ARGUMENT')
  }
  const item = pending.get(token)
  if (!item) throw new AppError('IMPORT_EXPIRED')
  pending.delete(token)
  const { file, candidate } = item
  if (choice === 'skip') return { file, status: 'skipped', name: candidate.name }
  if (choice === 'overwrite') {
    const existing = db.get<{ id: string }>('SELECT id FROM banks WHERE name = ?', [candidate.name.trim()])
    if (existing) return { file, status: 'imported', replaced: true, ...commitCandidate(db, assets, candidate, existing.id) }
  }
  return { file, status: 'imported', replaced: false, ...commitCandidate(db, assets, candidate) }
}
