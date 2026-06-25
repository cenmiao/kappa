import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { openDB } from '../db'
import { getMeta } from '../db/progress'
import { resetQuestionBank, loadQuestions } from '../db/loader'
import ConfirmModal from '../components/ConfirmModal'

const CATEGORIES = ['全部', '综合管理', '税务公共知识', '政治理论', '强基培训'] as const

export default function HomePage() {
  const nav = useNavigate()
  const location = useLocation()
  const [showPwaBanner, setShowPwaBanner] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  // 题库分类选择 — 从 localStorage 恢复上次选择
  const [category, setCategory] = useState(() => {
    const saved = localStorage.getItem('kappa-category')
    return saved && (CATEGORIES as readonly string[]).includes(saved) ? saved : CATEGORIES[0]
  })

  // 卡片描述文案 — 根据 category 动态替换
  const randomDesc = category === '全部'
    ? '全题库随机抽 80 题 · 单选 40 + 多选 20 + 判断 20'
    : `${category} 随机抽 80 题 · 单选 40 + 多选 20 + 判断 20`
  const sequentialDesc = category === '全部'
    ? '按题库编号顺序答题，支持续上次进度'
    : `${category} 按编号顺序答题，支持续上次进度`

  // Toast 缺参提示
  const [toast, setToast] = useState<string | null>(null)

  // 检测缺参重定向 → 显示 Toast
  useEffect(() => {
    const state = location.state as { missingCategory?: boolean } | null
    if (state?.missingCategory) {
      setToast('请先选择题库')
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  // 管理员面板
  const [showAdmin, setShowAdmin] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [meta, setMeta] = useState<{ questionCount: number; importTime: string; categories?: Record<string, number> } | null>(null)
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  // 打开管理面板时加载 meta 信息
  const handleOpenAdmin = async () => {
    setShowAdmin(true)
    setResetMsg(null)
    try {
      const db = await openDB()
      const m = await getMeta(db)
      setMeta(m)
    } catch {
      setMeta(null)
    }
  }

  // 执行题库重置
  const handleReset = async () => {
    setShowResetConfirm(false)
    setResetMsg(null)
    try {
      const db = await openDB()
      await resetQuestionBank(db)
      await loadQuestions()
      // 重读 meta
      const m = await getMeta(db)
      setMeta(m)
      setResetMsg({ type: 'success', text: `题库已更新，共导入 ${m?.questionCount ?? '?'} 道题` })
    } catch (err) {
      setResetMsg({ type: 'error', text: `重置失败：${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white px-5 py-10 flex flex-col relative">
      {/* Toast 缺参提示 */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-lg shadow-indigo-200">
          ⚠ {toast}
        </div>
      )}

      {/* ⚙ 管理员入口 */}
      <button
        onClick={handleOpenAdmin}
        className="absolute top-3 right-4 w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors text-lg"
        aria-label="题库管理"
      >
        ⚙
      </button>

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">'两测'刷题</h1>
        <p className="text-gray-500 text-sm">离线刷题 · 安全知识练习</p>
      </div>

      {/* 题库分类选择器 */}
      <div className="flex justify-center mb-6">
        <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-400 flex-shrink-0">📚</span>
          <select
            aria-label="题库分类选择"
            value={category}
            onChange={(e) => {
              const val = e.target.value
              setCategory(val)
              localStorage.setItem('kappa-category', val)
            }}
            className="appearance-none bg-transparent text-sm font-medium text-gray-700 pr-5 cursor-pointer focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">▼</span>
        </div>
      </div>

      {/* 卡片网格 */}
      <div className="flex flex-col gap-4 max-w-md mx-auto w-full flex-1">
        {/* 随机练习 — 主力入口（渐变卡片） */}
        <button
          onClick={() => nav(`/quiz?mode=random&category=${category}`)}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-left shadow-lg shadow-indigo-200 active:scale-[0.98] transition-transform"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="text-4xl mb-3">🎯</div>
            <h2 className="text-xl font-bold text-white mb-1">随机练习</h2>
            <p className="text-indigo-100 text-sm">{randomDesc}</p>
            <div className="mt-4 inline-block bg-white/20 text-white text-xs px-3 py-1 rounded-full">
              满分 100 分
            </div>
          </div>
        </button>

        {/* 顺序练习 */}
        <button
          onClick={() => nav(`/quiz?mode=sequential&category=${category}`)}
          className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 p-6 text-left shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📋</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">顺序练习</h2>
              <p className="text-gray-500 text-sm">{sequentialDesc}</p>
            </div>
            <div className="text-gray-300 text-xl">→</div>
          </div>
        </button>

        {/* 历史记录 */}
        <button
          onClick={() => nav(`/history?category=${category}`)}
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

      {/* ── 管理员面板 Modal ── */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowAdmin(false); setResetMsg(null) }} />
          <div data-testid="admin-panel" className="relative bg-white rounded-2xl w-full max-w-sm mx-4 px-5 pt-6 pb-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">题库管理</h3>

            {/* 版本信息 */}
            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">题目总数</span>
                <span className="text-gray-700 font-medium">{meta ? `${meta.questionCount} 道` : '加载中...'}</span>
              </div>
              {/* 分类统计 */}
              {meta?.categories && (
                (() => {
                  // 固定顺序排列，未知分类追加到末尾
                  const ORDER = ['综合管理', '税务公共知识', '政治理论', '强基培训']
                  const cats = Object.keys(meta.categories).sort(
                    (a, b) => {
                      const ai = ORDER.indexOf(a)
                      const bi = ORDER.indexOf(b)
                      if (ai === -1 && bi === -1) return a.localeCompare(b, 'zh-CN')
                      if (ai === -1) return 1
                      if (bi === -1) return -1
                      return ai - bi
                    }
                  )
                  return (
                    <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                      {cats.map(cat => (
                        <div key={cat} className="flex justify-between">
                          <span className="text-gray-400">{cat}</span>
                          <span className="text-gray-600">{meta.categories![cat]} 道</span>
                        </div>
                      ))}
                    </div>
                  )
                })()
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">导入时间</span>
                <span className="text-gray-700 font-medium">
                  {meta ? new Date(meta.importTime).toLocaleString('zh-CN') : '尚未导入'}
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium active:bg-red-50 transition-colors mb-2"
            >
              题库重置
            </button>

            {/* 重置结果消息 */}
            {resetMsg && (
              <p className={`text-xs mt-3 ${resetMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {resetMsg.text}
              </p>
            )}

            {/* 关闭按钮 */}
            <button
              onClick={() => { setShowAdmin(false); setResetMsg(null) }}
              className="w-full py-2 rounded-xl text-gray-400 text-xs mt-2 active:text-gray-500 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ── 题库重置确认弹窗 ── */}
      <ConfirmModal
        open={showResetConfirm}
        title="题库重置"
        message="将清空本地题库和错题池，重新从服务器下载最新题库。练习记录和顺序进度将保留。"
        confirmLabel="确认重置"
        cancelLabel="取消"
        confirmVariant="red"
        onConfirm={handleReset}
        onCancel={() => setShowResetConfirm(false)}
      >
        <div className="text-xs text-gray-500 space-y-0.5 mt-1">
          <p className="font-medium text-gray-600 mb-1">前置规则提醒：</p>
          <p>1. 将各分类题库 .docx 文件放入 tiku/ 目录（文件名前缀 1/2/3/4 决定顺序）</p>
          <p>2. 运行 node scripts/convert.js 合并所有文件并输出 questions.json</p>
          <p>3. 确认输出的 JSON 中各分类题目数和 ID 分配正确</p>
          <p>4. 将生成的 questions.json 部署到 GitHub Pages 后，再执行本重置</p>
        </div>
      </ConfirmModal>
    </div>
  )
}
