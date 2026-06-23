import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import type { Question, Attempt } from '../types'
import { getLoadState, getLoadError, loadQuestions, isQuestionBankReady } from '../db/loader'
import { openDB } from '../db'
import { saveAttempt } from '../db/attempts'
import { upsertWrongAnswers } from '../db/wrongAnswers'
import { saveProgress } from '../db/progress'
import useQuizState from '../hooks/useQuizState'
import { useBeforeUnload } from '../hooks/useBeforeUnload'
import ConfirmModal from '../components/ConfirmModal'

type PageState = 'loading' | 'error' | 'ready'

export default function QuizPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()
  const location = useLocation()
  const mode = (searchParams.get('mode') ?? 'random') as 'random' | 'sequential'
  const simulateError = searchParams.get('loadError') === 'true'

  // 复习模式：从路由 state 获取题目列表
  const reviewQuestions = (location.state as { reviewQuestions?: Question[] } | null)?.reviewQuestions
  const isReviewMode = reviewQuestions && reviewQuestions.length > 0

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [quizReady, setQuizReady] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const quiz = useQuizState()

  // ─── beforeunload：答题中离开拦截 ────────────────
  useBeforeUnload(!quiz.isSubmitted && quiz.totalQuestions > 0)

  // ─── 题库加载（复用已有逻辑）──────────────────────
  const checkAndLoad = useCallback(async () => {
    setPageState('loading')

    if (simulateError) {
      const ready = await isQuestionBankReady()
      if (!ready) {
        setPageState('error')
        setErrorMsg('模拟加载失败（?loadError=true）')
        return
      }
    }

    const loadState = getLoadState()
    if (loadState === 'error') {
      setPageState('error')
      setErrorMsg(getLoadError() ?? '题库加载失败')
      return
    }

    const ready = await isQuestionBankReady()
    if (ready) {
      setPageState('ready')
      return
    }

    if (loadState === 'loading') {
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 500))
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

  // ─── 题库就绪后初始化答题状态 ────────────────────
  useEffect(() => {
    if (pageState !== 'ready') return
    let cancelled = false

    // 复习模式：直接用传入的题目列表
    if (isReviewMode && reviewQuestions) {
      quiz.initWithQuestions(reviewQuestions)
      setQuizReady(true)
      return
    }

    openDB()
      .then((db) => quiz.initQuiz(db, mode))
      .then(() => {
        if (!cancelled) setQuizReady(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setPageState('error')
          setErrorMsg(err instanceof Error ? err.message : '出题失败')
        }
      })

    return () => {
      cancelled = true
    }
    // 仅在 pageState 变为 ready 时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState])

  const handleRetry = () => {
    if (simulateError) {
      const next = new URLSearchParams(searchParams)
      next.delete('loadError')
      setSearchParams(next, { replace: true })
    } else {
      setQuizReady(false)
      loadQuestions().then(() => checkAndLoad())
    }
  }

  // ─── 交卷流程 ──────────────────────────────────
  const handleSubmitConfirm = useCallback(async () => {
    setShowConfirm(false)
    const attempt = quiz.submit()
    if (!attempt) return

    // 补全 mode 信息（复习模式优先）
    const actualMode: Attempt['mode'] = isReviewMode ? 'review' : mode
    const finalAttempt = { ...attempt, mode: actualMode }

    // 持久化到 IndexedDB
    try {
      const db = await openDB()
      await saveAttempt(db, finalAttempt)

      // 错题录入错题池
      const wrongItems = finalAttempt.answers
        .filter(a => !a.isCorrect)
        .map(a => ({
          questionId: a.questionId,
          type: quiz.questions.find(q => q.id === a.questionId)!.type,
        }))
      if (wrongItems.length > 0) {
        await upsertWrongAnswers(db, wrongItems)
      }

      // 顺序模式：保存下次续接位置（当前题号 + 1）
      if (mode === 'sequential') {
        await saveProgress(db, quiz.startIndex + quiz.currentIndex + 1)
      }
    } catch {
      // 保存失败不阻塞交卷流程
    }

    // 跳转到成绩页（同时传递题目数据供解析弹窗使用）
    nav('/result', { state: { attempt: finalAttempt, questions: quiz.questions } })
  }, [quiz, mode, nav])

  // ─── 获取当前题目的选项标签 ────────────────────
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']

  // ══════════════════════════════════════════════════════
  //  loading
  // ══════════════════════════════════════════════════════
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">题库加载中...</p>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════
  //  error
  // ══════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════
  //  ready — 初始化答题中
  // ══════════════════════════════════════════════════════
  if (!quizReady) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">正在准备题目...</p>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════
  //  ready — 答题中
  // ══════════════════════════════════════════════════════
  const q = quiz.questions[quiz.currentIndex]
  if (!q) return null

  const unansweredCount = quiz.totalQuestions - quiz.answeredCount
  const isLastQuestion = quiz.currentIndex === quiz.totalQuestions - 1
  const isFirstQuestion = quiz.currentIndex === 0
  const progressPct = ((quiz.currentIndex + 1) / quiz.totalQuestions) * 100

  // 题型标签配置
  const typeBadge =
    q.type === 'single'
      ? { label: '单选题', bg: 'bg-blue-50', text: 'text-blue-600' }
      : q.type === 'multi'
        ? { label: '多选题', bg: 'bg-purple-50', text: 'text-purple-600' }
        : { label: '判断题', bg: 'bg-amber-50', text: 'text-amber-600' }

  /** 判断选项是否被选中 */
  const isSelected = (letter: string) => {
    if (!quiz.currentAnswer) return false
    return quiz.currentAnswer.split(',').includes(letter)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── 顶部进度条 + 元数据 ── */}
      <div className="sticky top-0 bg-white z-10">
        {/* 渐变色进度条 */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">
            第 {quiz.currentIndex + 1}/{quiz.totalQuestions} 题
          </span>
          <div className="flex items-center gap-3">
            {/* 题型标签 */}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadge.bg} ${typeBadge.text}`}
            >
              {typeBadge.label}
            </span>
            {/* 不确定标记按钮 */}
            <button
              onClick={quiz.toggleUncertain}
              className={`text-lg transition-colors ${
                quiz.isCurrentUncertain ? 'text-amber-500' : 'text-gray-300 hover:text-gray-400'
              }`}
              aria-label={quiz.isCurrentUncertain ? '取消标记' : '标记为不确定'}
            >
              {quiz.isCurrentUncertain ? '⚑' : '⚐'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 题目内容区 ── */}
      <div className="flex-1 flex flex-col px-5 pt-6 overflow-y-auto">
        {/* 题干 */}
        <div className="mb-8">
          <p className="text-lg leading-relaxed text-gray-900 font-medium">{q.stem}</p>
          {q.type === 'multi' && (
            <p className="text-xs text-purple-500 mt-2">多选题 · 全对得 2 分</p>
          )}
        </div>

        {/* 大号选项按钮 */}
        <div className="flex flex-col gap-3">
          {q.options.map((opt, idx) => {
            const letter = optionLabels[idx]
            const active = isSelected(letter)
            // 去除选项文本中的字母前缀（如 "A. " 或 "A."）
            const text = opt.replace(/^[A-F][.、\s]+/, '')

            return (
              <button
                key={letter}
                onClick={() => quiz.selectOption(letter)}
                className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                  active
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
              >
                {/* 选项标签（字母或 ✓） */}
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    active
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {active ? '✓' : letter}
                </span>
                <span
                  className={`text-base text-left ${
                    active ? 'text-indigo-900 font-medium' : 'text-gray-700'
                  }`}
                >
                  {text}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 底部缩略图导航 + 操作区 ── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100">
        {/* 缩略图网格 */}
        <div className="px-4 pt-3 pb-1 flex gap-1 overflow-x-auto no-scrollbar">
          {quiz.questions.map((question, idx) => {
            const a = quiz.answers[question.id]
            const isCurrent = idx === quiz.currentIndex
            const isAnswered = a?.userAnswer !== '' && a?.userAnswer !== undefined
            const isFlagged = a?.isUncertain

            let cellStyle = 'bg-gray-100 text-gray-400'
            if (isFlagged && !isCurrent) {
              cellStyle = 'bg-amber-100 text-amber-600'
            }
            if (isCurrent) {
              cellStyle = 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-100 text-indigo-700 scale-110'
            } else if (isAnswered && !isFlagged) {
              cellStyle = 'bg-green-100 text-green-700'
            }

            return (
              <button
                key={idx}
                onClick={() => quiz.goTo(idx)}
                className={`flex-shrink-0 w-7 h-7 rounded-md text-[10px] font-medium flex items-center justify-center transition-all ${cellStyle}`}
              >
                {isFlagged ? '⚑' : idx + 1}
              </button>
            )
          })}
        </div>

        {/* 底部按钮 */}
        <div className="px-4 py-3 flex gap-3">
          {/* 上一题 */}
          <button
            onClick={quiz.goPrev}
            disabled={isFirstQuestion}
            className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-gray-50 transition-colors flex-shrink-0"
          >
            ←
          </button>

          {!isLastQuestion ? (
            <>
              {/* 下一题（主按钮） */}
              <button
                onClick={quiz.goNext}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium active:bg-gray-800 transition-colors"
              >
                下一题
              </button>
              {/* 交卷（小按钮） */}
              <button
                onClick={() => setShowConfirm(true)}
                className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400 active:bg-gray-50 transition-colors flex-shrink-0"
              >
                交卷
              </button>
            </>
          ) : (
            <>
              {/* 末尾题：绿色渐变交卷按钮 */}
              <button
                onClick={() => setShowConfirm(true)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium active:from-green-600 active:to-emerald-600 transition-colors"
              >
                ✓ 交卷 ({quiz.answeredCount}/{quiz.totalQuestions})
              </button>
              {/* 末尾题禁用下一题 */}
              <button
                disabled
                className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 opacity-20 flex-shrink-0"
              >
                →
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── 交卷确认弹窗 ── */}
      <ConfirmModal
        open={showConfirm}
        title="确认交卷"
        message={`已答 ${quiz.answeredCount}/${quiz.totalQuestions} 题`}
        confirmLabel="确认交卷"
        cancelLabel="继续答题"
        onConfirm={handleSubmitConfirm}
        onCancel={() => setShowConfirm(false)}
      >
        {unansweredCount > 0 && (
          <p className="text-sm text-red-500 font-medium">
            还有 {unansweredCount} 题未作答，未作答将计为错误
          </p>
        )}
      </ConfirmModal>
    </div>
  )
}
