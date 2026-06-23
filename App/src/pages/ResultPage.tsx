import { useNavigate } from 'react-router-dom'

export default function ResultPage() {
  const nav = useNavigate()

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
      <div className="text-5xl mb-4">📊</div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">成绩报告 — 即将推出</h2>
      <p className="text-sm text-gray-400 mb-6">成绩报告页将在 Slice 2 实现</p>
      <button
        onClick={() => nav('/')}
        className="px-6 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
      >
        返回首页
      </button>
    </div>
  )
}
