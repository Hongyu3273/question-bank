import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './styles/tokens.css'
import './styles/global.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// 界面中未处理的错误写进日志文件(设置 → 关于 → 打开日志文件夹)
const report = (message: string) => {
  try {
    void window.api?.app.logError(`${message} @ ${window.location.hash}`).catch(() => undefined)
  } catch {
    // 记录失败时忽略
  }
}
window.addEventListener('error', (e) => report(e.error instanceof Error ? (e.error.stack ?? e.message) : e.message))
window.addEventListener('unhandledrejection', (e) =>
  report(`unhandled rejection: ${e.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e.reason)}`)
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
