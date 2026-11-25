import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js'

export type Params = SqlValue[]

/**
 * SQLite 数据库的薄封装。
 *
 * 底层用 sql.js(WebAssembly 版 SQLite):数据库整体在内存中,每次写入后保存到磁盘文件。
 * 不需要本机编译原生模块,Windows 和 macOS 安装即用。题库规模小,整库保存的开销可以忽略。
 */
export class Db {
  private txDepth = 0
  private dirty = false

  private constructor(
    private readonly sql: SqlJsDatabase,
    private readonly file: string | null
  ) {
    this.applyPragmas()
  }

  /**
   * 打开数据库文件;文件不存在时新建。
   * file 为 null 时只在内存中使用(用于测试)。
   */
  static async open(file: string | null, wasmPath: string): Promise<Db> {
    const SQL = await initSqlJs({ wasmBinary: readFileSync(wasmPath) as unknown as ArrayBuffer })
    let data: Uint8Array | undefined
    if (file) {
      try {
        data = readFileSync(file)
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      }
    }
    return new Db(new SQL.Database(data), file)
  }

  /** 查询多行 */
  all<T>(sql: string, params: Params = []): T[] {
    const stmt = this.sql.prepare(sql)
    try {
      stmt.bind(params)
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      return rows
    } finally {
      stmt.free()
    }
  }

  /** 查询单行,没有结果时返回 undefined */
  get<T>(sql: string, params: Params = []): T | undefined {
    return this.all<T>(sql, params)[0]
  }

  /** 执行写入语句 */
  run(sql: string, params: Params = []): void {
    this.sql.run(sql, params)
    this.markDirty()
  }

  /** 执行多条语句(建表等),不带参数 */
  exec(sql: string): void {
    this.sql.exec(sql)
    this.markDirty()
  }

  /** 在事务中执行;出错时回滚。嵌套调用并入外层事务。 */
  transaction<T>(fn: () => T): T {
    if (this.txDepth > 0) return fn()
    this.sql.exec('BEGIN')
    this.txDepth++
    try {
      const result = fn()
      this.sql.exec('COMMIT')
      this.txDepth--
      this.flush()
      return result
    } catch (err) {
      this.sql.exec('ROLLBACK')
      this.txDepth--
      this.dirty = false
      throw err
    }
  }

  /** 把内存中的数据写入磁盘:先写临时文件再替换,避免写到一半断电导致文件损坏 */
  flush(): void {
    if (!this.dirty || !this.file) return
    const data = this.sql.export()
    // sql.js 的 export() 会重新打开连接,PRAGMA 需要重新设置
    this.applyPragmas()
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, data)
    renameSync(tmp, this.file)
    this.dirty = false
  }

  close(): void {
    this.flush()
    this.sql.close()
  }

  private markDirty(): void {
    this.dirty = true
    if (this.txDepth === 0) this.flush()
  }

  private applyPragmas(): void {
    this.sql.exec('PRAGMA foreign_keys = ON')
  }
}
