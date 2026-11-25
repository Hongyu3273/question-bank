import { createRequire } from 'node:module'
import { Db } from '../src/main/db/database'
import { runMigrations } from '../src/main/db/migrations'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

/** 打开一个已迁移的内存数据库;传入文件路径时读写该文件 */
export async function openTestDb(file: string | null = null): Promise<Db> {
  const db = await Db.open(file, wasmPath)
  runMigrations(db)
  return db
}
