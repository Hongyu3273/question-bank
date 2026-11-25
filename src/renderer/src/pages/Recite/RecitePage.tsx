// 背题模式:今日任务(记忆曲线)或全部刷一遍(洗牌),在页面顶部切换

import { useSettingsStore } from '../../stores/settings'
import ShuffleMode from './ShuffleMode'
import TodayMode from './TodayMode'

export default function RecitePage() {
  const mode = useSettingsStore((s) => s.settings?.reciteMode ?? 'today')
  return mode === 'shuffle' ? <ShuffleMode /> : <TodayMode />
}
