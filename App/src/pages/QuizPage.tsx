import { useSearchParams, useNavigate } from 'react-router-dom'

export default function QuizPage() {
  const [searchParams] = useSearchParams()
  const nav = useNavigate()
  const mode = searchParams.get('mode') ?? 'random'

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">答题页 — 即将推出</h2>
      <p className="text-sm text-gray-400 mb-6">
        {mode === 'sequential' ? '顺序练习模式' : '随机练习模式'}将在 Slice 2 实现
      </p>
      <button
        onClick={() => nav('/')}
        className="px-6 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
      >
        返回首页
      </button>
    </div>
  )
}
