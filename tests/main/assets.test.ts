import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AssetStore } from '../../src/main/services/assets'
import { LIMITS } from '../../src/shared/types'

const BANK = '0b6f3c2e-8a4d-4c1e-9f7a-2d5b8e1c3a90'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

let root: string
let store: AssetStore
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'qb-assets-'))
  store = new AssetStore(root)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('AssetStore', () => {
  it('按内容哈希保存图片,相同内容只存一份', () => {
    const a = store.saveImage(BANK, PNG, 'image/png')
    const b = store.saveImage(BANK, PNG, 'image/png')
    expect(a).toMatch(/^images\/[0-9a-f]{16}\.png$/)
    expect(b).toBe(a)
    expect(readFileSync(join(root, BANK, a))).toEqual(Buffer.from(PNG))
  })

  it('拒绝不支持的类型和过大的图片', () => {
    expect(() => store.saveImage(BANK, PNG, 'image/svg+xml')).toThrow('IMAGE_TYPE_UNSUPPORTED')
    expect(() => store.saveImage(BANK, new Uint8Array(LIMITS.imageBytes + 1), 'image/png')).toThrow(
      'IMAGE_TOO_LARGE'
    )
  })

  it('拒绝不合法的题库 id', () => {
    expect(() => store.saveImage('../evil', PNG, 'image/png')).toThrow('INVALID_ARGUMENT')
  })

  it('解析图片地址,并拒绝越出题库目录的路径', () => {
    const rel = store.saveImage(BANK, PNG, 'image/png')
    expect(store.resolveUrl(`qb-asset://${BANK}/${rel}`)).toBe(join(root, BANK, rel))
    // URL 规范化会把 ../ 截断在题库根目录,结果仍在题库目录内
    expect(store.resolveUrl(`qb-asset://${BANK}/images/%2e%2e/%2e%2e/secret.png`)).toBe(join(root, BANK, 'secret.png'))
    expect(store.resolveUrl(`qb-asset://${BANK}/..%2f..%2fsecret.png`)).toBeNull()
    expect(store.resolveUrl(`qb-asset://${BANK}/images/notes.txt`)).toBeNull()
    expect(store.resolveUrl('qb-asset://not-a-bank/images/a.png')).toBeNull()
  })

  it('删除题库目录', () => {
    store.saveImage(BANK, PNG, 'image/png')
    store.deleteBank(BANK)
    expect(existsSync(join(root, BANK))).toBe(false)
  })
})
