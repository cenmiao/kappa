import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HomePage() {
  const nav = useNavigate()
  const [showPwaBanner, setShowPwaBanner] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // 监听 PWA 安装事件
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPwaBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPwaBanner(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white px-5 py-10 flex flex-col">
      {/* PWA 安装引导横幅 */}
      {showPwaBanner && (
        <div
          onClick={handleInstallClick}
          className={`mb-6 bg-indigo-600 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-indigo-200 ${deferredPrompt ? 'cursor-pointer active:bg-indigo-700' : ''} transition-colors`}
          role={deferredPrompt ? 'button' : 'banner'}
        >
          <span className="text-xl flex-shrink-0">📲</span>
          <p className="text-xs leading-relaxed flex-1">
            {deferredPrompt
              ? '点击此处安装应用，获得离线刷题体验'
              : '点击下方 ··· 添加到主屏幕，获得离线刷题体验'}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPwaBanner(false) }}
            className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs flex-shrink-0 hover:bg-white/30 transition-colors"
            aria-label="关闭安装引导"
          >
            ✕
          </button>
        </div>
      )}

      {/* 头部 */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">我想静静的刷题</h1>
        <p className="text-gray-500 text-sm">离线刷题 · 安全知识练习</p>
      </div>

      {/* 卡片网格 */}
      <div className="flex flex-col gap-4 max-w-md mx-auto w-full flex-1">
        {/* 随机练习 — 主力入口（渐变卡片） */}
        <button
          onClick={() => nav('/quiz')}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-left shadow-lg shadow-indigo-200 active:scale-[0.98] transition-transform"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="text-4xl mb-3">🎯</div>
            <h2 className="text-xl font-bold text-white mb-1">随机练习</h2>
            <p className="text-indigo-100 text-sm">全题库随机抽 80 题 · 单选 40 + 多选 20 + 判断 20</p>
            <div className="mt-4 inline-block bg-white/20 text-white text-xs px-3 py-1 rounded-full">
              满分 100 分
            </div>
          </div>
        </button>

        {/* 顺序练习 */}
        <button
          onClick={() => nav('/quiz?mode=sequential')}
          className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 text-left shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📋</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">顺序练习</h2>
              <p className="text-gray-500 text-sm">按题库编号顺序答题，支持续上次进度</p>
            </div>
            <div className="text-gray-300 text-xl">→</div>
          </div>
        </button>

        {/* 历史记录 */}
        <button
          onClick={() => nav('/history')}
          className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 text-left shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📊</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">历史记录</h2>
              <p className="text-gray-500 text-sm">查看练习趋势和成绩变化分析</p>
            </div>
            <div className="text-gray-300 text-xl">→</div>
          </div>
        </button>
      </div>

      {/* 底部信息 */}
      <p className="text-center text-gray-300 text-xs mt-8">PWA 离线可用 · 题库 4000+ 题</p>
    </div>
  )
}
