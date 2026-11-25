import { useEffect } from 'react'
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom'
import ConfirmHost from './components/ConfirmHost'
import ImportHost from './components/ImportHost'
import ShortcutHelp from './components/ShortcutHelp'
import Sidebar from './components/Sidebar'
import ToastHost from './components/ToastHost'
import { useApplyAppearance } from './hooks/useApplyAppearance'
import HomePage from './pages/Home/HomePage'
import ManagePage from './pages/Manage/ManagePage'
import ReadPage from './pages/Read/ReadPage'
import RecitePage from './pages/Recite/RecitePage'
import SettingsPage from './pages/Settings/SettingsPage'
import { useSettingsStore } from './stores/settings'
import styles from './App.module.css'

function Layout() {
  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
      <ToastHost />
      <ImportHost />
      <ShortcutHelp />
      <ConfirmHost />
    </div>
  )
}

// HashRouter 形式的数据路由:适配 file:// 加载,并支持离开页面前的拦截(useBlocker)
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/read', element: <ReadPage /> },
      { path: '/recite', element: <RecitePage /> },
      { path: '/manage', element: <ManagePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

export default function App() {
  const settings = useSettingsStore((s) => s.settings)
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  useApplyAppearance(settings)

  // 设置加载完成前不渲染界面,避免主题和语言闪烁
  if (!settings) return null

  return <RouterProvider router={router} />
}
