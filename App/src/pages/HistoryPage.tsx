import { useNavigate } from 'react-router-dom'

export default function HistoryPage() {
  const nav = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => nav('/')} className="text-gray-400 text-lg">←</button>
          <h1 className="text-lg font-bold text-gray-900">历史记录</h1>
        </div>
      </div>

      {/* 空状态 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
        <div className="text-6xl mb-6">📝</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">还没有练习记录</h2>
        <p className="text-sm text-gray-400 mb-8">开始第一次练习，记录你的学习轨迹</p>
        <button
          onClick={() => nav('/quiz')}
          className="px-8 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
        >
          开始随机练习
        </button>
      </div>
    </div>
  )
}
