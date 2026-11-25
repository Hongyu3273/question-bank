import { unzipSync, zipSync, type Zippable } from 'fflate'
import { AppError } from '../../shared/errors'

/** 解压限制,防止损坏或恶意的压缩包占满内存和磁盘 */
export interface UnzipLimits {
  maxEntries: number
  maxEntryBytes: number
  maxTotalBytes: number
}

export const DEFAULT_LIMITS: UnzipLimits = {
  maxEntries: 20_000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalBytes: 2 * 1024 * 1024 * 1024
}

/**
 * 规范化压缩包内的路径;不安全的路径(绝对路径、包含 ..、盘符)返回 null。
 * 目录项返回 null。
 */
export function safeEntryPath(name: string): string | null {
  const path = name.replace(/\\/g, '/')
  if (path.endsWith('/')) return null
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return null
  const parts = path.split('/').filter((p) => p !== '' && p !== '.')
  if (parts.length === 0 || parts.some((p) => p === '..' || p.includes('\0'))) return null
  // 忽略 macOS 压缩时附带的元数据
  if (parts[0] === '__MACOSX' || parts[parts.length - 1] === '.DS_Store') return null
  return parts.join('/')
}

/** 解压到内存,返回 路径 → 内容。路径不安全或超出限制时报错 */
export function readZip(data: Uint8Array, limits: UnzipLimits = DEFAULT_LIMITS): Map<string, Uint8Array> {
  let count = 0
  let total = 0
  let unsafe = false
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data, {
      filter: (f) => {
        const raw = f.name.replace(/\\/g, '/')
        if (raw.endsWith('/')) return false
        const path = safeEntryPath(f.name)
        if (!path) {
          // 元数据目录直接忽略,其他不安全路径视为错误
          if (!/(^|\/)(__MACOSX\/|\.DS_Store$)/.test(raw)) unsafe = true
          return false
        }
        count++
        total += f.originalSize
        if (count > limits.maxEntries || f.originalSize > limits.maxEntryBytes || total > limits.maxTotalBytes) {
          throw new AppError('ARCHIVE_TOO_LARGE')
        }
        return true
      }
    })
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('ARCHIVE_INVALID')
  }
  if (unsafe) throw new AppError('ARCHIVE_UNSAFE')
  const result = new Map<string, Uint8Array>()
  for (const [name, content] of Object.entries(files)) {
    const path = safeEntryPath(name)
    if (path) result.set(path, content)
  }
  return result
}

/** 打包为 zip。图片等已压缩的格式不再压缩 */
export function writeZip(entries: Map<string, Uint8Array>): Uint8Array {
  const tree: Zippable = {}
  for (const [path, content] of entries) {
    const stored = /\.(png|jpe?g|gif|webp|zip)$/i.test(path)
    tree[path] = [content, { level: stored ? 0 : 6 }]
  }
  return zipSync(tree)
}
