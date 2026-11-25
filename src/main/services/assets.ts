import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { AppError } from '../../shared/errors'
import { LIMITS } from '../../shared/types'

/** 允许保存的图片类型 → 扩展名。不接受 SVG:它可以内嵌脚本 */
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

/** 允许通过 qb-asset 协议读取的扩展名 */
const READABLE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

const BANK_ID = /^[0-9a-f-]{36}$/

/**
 * 题库图片存储。目录结构:<root>/<bankId>/images/<文件名>
 * root 通常是 userData/assets。
 */
export class AssetStore {
  constructor(private readonly root: string) {}

  bankDir(bankId: string): string {
    if (!BANK_ID.test(bankId)) throw new AppError('INVALID_ARGUMENT')
    return join(this.root, bankId)
  }

  /**
   * 保存图片,返回 Markdown 中使用的相对路径。
   * 文件名取内容哈希,同一张图片重复粘贴只保存一份。
   */
  saveImage(bankId: string, data: Uint8Array, mimeType: string): string {
    const ext = IMAGE_TYPES[mimeType]
    if (!ext) throw new AppError('IMAGE_TYPE_UNSUPPORTED')
    if (data.byteLength > LIMITS.imageBytes) throw new AppError('IMAGE_TOO_LARGE')
    const name = `${createHash('sha256').update(data).digest('hex').slice(0, 16)}.${ext}`
    const dir = join(this.bankDir(bankId), 'images')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name), data)
    return `images/${name}`
  }

  /**
   * 把导入的图片先写到临时目录,数据库写入成功后再换成正式目录。
   * images 的键是相对路径(images/xxx.png)。没有图片时返回 null。
   */
  stageImages(images: Map<string, Uint8Array>): string | null {
    if (images.size === 0) return null
    const staged = join(this.root, `.staging-${randomUUID()}`)
    try {
      for (const [path, data] of images) {
        const file = resolve(staged, path)
        if (!file.startsWith(staged + sep)) throw new AppError('ARCHIVE_UNSAFE')
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, data)
      }
    } catch (err) {
      rmSync(staged, { recursive: true, force: true })
      throw err
    }
    return staged
  }

  discardStaged(staged: string | null): void {
    if (staged) rmSync(staged, { recursive: true, force: true })
  }

  /** 用暂存目录替换题库的图片目录;staged 为 null 时清空 */
  replaceBankImages(bankId: string, staged: string | null): void {
    const dir = this.bankDir(bankId)
    rmSync(dir, { recursive: true, force: true })
    if (staged) {
      mkdirSync(this.root, { recursive: true })
      renameSync(staged, dir)
    }
  }

  /** 题库目录下的全部文件:相对路径(images/xxx.png)→ 内容 */
  readBankFiles(bankId: string): Map<string, Uint8Array> {
    const dir = this.bankDir(bankId)
    const files = new Map<string, Uint8Array>()
    const walk = (d: string) => {
      if (!existsSync(d)) return
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.isFile()) files.set(relative(dir, full).split(sep).join('/'), readFileSync(full))
      }
    }
    walk(dir)
    return files
  }

  deleteBank(bankId: string): void {
    rmSync(this.bankDir(bankId), { recursive: true, force: true })
  }

  /**
   * 把 qb-asset://<bankId>/<路径> 解析为磁盘文件路径。
   * 路径越出该题库目录、或扩展名不是图片时返回 null。
   */
  resolveUrl(url: string): string | null {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    const bankId = parsed.hostname
    if (!BANK_ID.test(bankId)) return null
    const base = resolve(this.root, bankId)
    let relative: string
    try {
      relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
    } catch {
      return null
    }
    const file = resolve(base, relative)
    if (!file.startsWith(base + sep)) return null
    const ext = file.split('.').pop()?.toLowerCase() ?? ''
    if (!READABLE_EXT.has(ext)) return null
    return file
  }
}
