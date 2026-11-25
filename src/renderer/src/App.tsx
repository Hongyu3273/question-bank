import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
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

export default function App() {
  const settings = useSettingsStore((s) => s.settings)
  const load = useSettingsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  useApplyAppearance(settings)

  // 设置加载完成前不渲染界面,避免主题和语言闪烁
  if (!settings) return null

  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/read" element={<ReadPage />} />
          <Route path="/recite" element={<RecitePage />} />
          <Route path="/manage" element={<ManagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastHost />
    </div>
  )
}
