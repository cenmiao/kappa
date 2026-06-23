import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getLoadState, getLoadError, loadQuestions, isQuestionBankReady } from '../db/loader'

type PageState = 'loading' | 'error' | 'ready'

export default function QuizPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()
  const mode = searchParams.get('mode') ?? 'random'
  const simulateError = searchParams.get('loadError') === 'true'

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  const checkAndLoad = useCallback(async () => {
    setPageState('loading')

    // 模拟错误：loadError=true 且题库尚未导入
    if (simulateError) {
      const ready = await isQuestionBankReady()
      if (!ready) {
        setPageState('error')
        setErrorMsg('模拟加载失败（?loadError=true）')
        return
      }
    }

    // 检查模块级加载状态
    const loadState = getLoadState()
    if (loadState === 'error') {
      setPageState('error')
      setErrorMsg(getLoadError() ?? '题库加载失败')
      return
    }

    // 检查 IndexedDB 是否已有数据
    const ready = await isQuestionBankReady()
    if (ready) {
      setPageState('ready')
      return
    }

    // 数据尚未导入 — 等待或触发导入
    if (loadState === 'loading') {
      // 轮询等待（最多 30s）
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 500))
        const s = getLoadState()
        if (s === 'ready') {
          setPageState('ready')
          return
        }
        if (s === 'error') {
          setPageState('error')
          setErrorMsg(getLoadError() ?? '题库加载失败')
          return
        }
      }
      setPageState('error')
      setErrorMsg('加载超时，请重试')
      return
    }

    // idle 状态 — 主动触发导入
    try {
      await loadQuestions()
      setPageState('ready')
    } catch (err) {
      setPageState('error')
      setErrorMsg(err instanceof Error ? err.message : '未知错误')
    }
  }, [simulateError])

  useEffect(() => {
    checkAndLoad()
  }, [checkAndLoad])

  const handleRetry = () => {
    // 清除 loadError 参数后重试
    if (simulateError) {
      const next = new URLSearchParams(searchParams)
      next.delete('loadError')
      setSearchParams(next, { replace: true })
    } else {
      loadQuestions().then(() => checkAndLoad())
    }
  }

  // ─── loading ───────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">题库加载中...</p>
      </div>
    )
  }

  // ─── error ─────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl mb-4">😵</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">加载失败</h2>
        <p className="text-sm text-gray-400 mb-6">{errorMsg}</p>
        <button
          onClick={handleRetry}
          className="px-8 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
        >
          重试
        </button>
        <button
          onClick={() => nav('/')}
          className="mt-3 px-8 py-3 rounded-xl text-gray-400 text-sm active:text-gray-500 transition-colors"
        >
          返回首页
        </button>
      </div>
    )
  }

  // ─── ready ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
      <div className="text-5xl mb-4">📝</div>
      <h2 className="text-lg font-bold text-gray-800 mb-2">
        {mode === 'sequential' ? '顺序练习' : '随机练习'}
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        题库就绪（4196 题），等待 Slice 3 实现完整答题
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
