// 确保 Electron 程序文件已下载。
// 部分 npm 版本或网络环境下,electron 包自带的下载脚本不会执行或会失败,这里补跑一次。
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) process.exit(0)

const require = createRequire(import.meta.url)
let electronDir
try {
  electronDir = dirname(require.resolve('electron/package.json'))
} catch {
  process.exit(0)
}

const pathFile = join(electronDir, 'path.txt')
if (existsSync(pathFile)) process.exit(0)

console.log('[ensure-electron] 正在下载 Electron……')
const result = spawnSync(process.execPath, [join(electronDir, 'install.js')], { stdio: 'inherit' })
if (result.status !== 0) {
  console.error('[ensure-electron] Electron 下载失败。可以设置镜像后重试:')
  console.error('  PowerShell: $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"')
  console.error('  然后运行:   node node_modules/electron/install.js')
}
