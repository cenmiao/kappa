import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import type { Question, Attempt } from '../types'
import { getLoadState, getLoadError, loadQuestions, isQuestionBankReady } from '../db/loader'
import { openDB } from '../db'
import { saveAttempt } from '../db/attempts'
import { upsertWrongAnswers } from '../db/wrongAnswers'
import { saveProgress, getDoneRecord, clearDoneRecord } from '../db/progress'
import useQuizState from '../hooks/useQuizState'
import { useBeforeUnload } from '../hooks/useBeforeUnload'
import ConfirmModal from '../components/ConfirmModal'

type PageState = 'loading' | 'error' | 'ready'

type FeedbackResult = { isCorrect: boolean; correctAnswer: string; explanation: string }

export default function QuizPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const nav = useNavigate()
  const location = useLocation()
  const mode = (searchParams.get('mode') ?? 'random') as 'random' | 'sequential' | 'wrongbook'
  const isInstantMode = mode === 'sequential' || mode === 'wrongbook'
  const simulateError = searchParams.get('loadError') === 'true'

  // 复习模式：从路由 state 获取题目列表
  const reviewQuestions = (location.state as { reviewQuestions?: Question[] } | null)?.reviewQuestions
  const isReviewMode = reviewQuestions && reviewQuestions.length > 0

  // ─── category 守卫：缺参重定向回首页 ──────────────
  useEffect(() => {
    const category = searchParams.get('category')
    if (!category) {
      nav('/', { replace: true, state: { missingCategory: true } })
    }
  }, [searchParams, nav])

  const [pageState, setPageState] = useState<PageState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [quizReady, setQuizReady] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showBackConfirm, setShowBackConfirm] = useState(false)
  const thumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const contentRef = useRef<HTMLDivElement>(null)

  const quiz = useQuizState()

  // 逐题反馈状态（顺序/错题本模式）
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // 全部完成状态
  const [allDone, setAllDone] = useState(false)

  // ─── beforeunload：答题中离开拦截 ────────────────
  useBeforeUnload(!quiz.isSubmitted && quiz.totalQuestions > 0)

  // ─── 题号自动居中滚动（仅水平，禁止垂直滚动）────
  useEffect(() => {
    const btn = thumbRefs.current.get(quiz.currentIndex)
    if (btn) {
      btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [quiz.currentIndex])

  // ─── 切题时题目内容区回到顶部 ──────────────────
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
  }, [quiz.currentIndex])

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

    const category = searchParams.get('category') ?? '全部'
    openDB()
      .then((db) => quiz.initQuiz(db, mode as 'random' | 'sequential' | 'wrongbook', category))
      .then(() => {
        if (!cancelled) {
          setQuizReady(true)
          // 检测是否全部完成（顺序模式 currentIndex 停在最后一题且该题已 done）
          if (mode === 'sequential' && quiz.questions.length > 0 && quiz.isCurrentDone) {
            setAllDone(true)
          }
        }
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

  // ─── 逐题提交（顺序/错题本模式）──────────────────
  const handleSubmitOne = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const db = await openDB()
      const category = searchParams.get('category') ?? '全部'
      const result = await quiz.submitOne(db, mode as 'sequential' | 'wrongbook', category)
      if (result) {
        setFeedback(result)
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }, [submitting, quiz, mode, searchParams])

  // 进入下一题（清除反馈）
  const handleNextAfterFeedback = useCallback(() => {
    setFeedback(null)
    // 检查是否全部完成
    if (mode === 'sequential' && quiz.currentIndex >= quiz.totalQuestions - 1 && quiz.isCurrentDone) {
      setAllDone(true)
    } else {
      quiz.goNext()
    }
  }, [quiz, mode])

  // ─── 从头开始（顺序模式）──────────────────────
  const handleRestart = useCallback(async () => {
    try {
      const db = await openDB()
      const category = searchParams.get('category') ?? '全部'
      await clearDoneRecord(db, category)
      await quiz.initQuiz(db, 'sequential', category)
      setAllDone(false)
      setFeedback(null)
    } catch {
      // ignore
    }
  }, [quiz, searchParams])

  // ─── 交卷流程 ──────────────────────────────────
  const handleSubmitConfirm = useCallback(async () => {
    setShowConfirm(false)
    const attempt = quiz.submit()
    if (!attempt) return

    // 补全 mode 信息（复习模式优先）
    const actualMode: Attempt['mode'] = isReviewMode ? 'review' : mode
    // category：复习模式从题目列表第一道题 fallback，否则从 URL 获取
    const category = isReviewMode
      ? (quiz.questions[0]?.category ?? '全部')
      : (searchParams.get('category') ?? '全部')
    const finalAttempt = { ...attempt, mode: actualMode, category }

    // 持久化到 IndexedDB
    try {
      const db = await openDB()
      await saveAttempt(db, finalAttempt)

      // 错题录入错题池（每道错题从题目对象获取 category）
      const wrongItems = finalAttempt.answers
        .filter(a => !a.isCorrect)
        .map(a => {
          const q = quiz.questions.find(q => q.id === a.questionId)!
          return {
            questionId: a.questionId,
            type: q.type,
            category: q.category,
          }
        })
      if (wrongItems.length > 0) {
        await upsertWrongAnswers(db, wrongItems)
      }

      // 顺序模式：保存下次续接位置（当前题号 + 1），带 category 后缀
      if (mode === 'sequential') {
        const progressKey = `sequential:${category}`
        await saveProgress(db, quiz.startIndex + quiz.currentIndex + 1, progressKey)
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 relative">
        <button
          onClick={() => nav('/')}
          className="absolute top-4 left-4 text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors"
        >
          ← 返回
        </button>
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center relative">
        <button
          onClick={() => nav('/')}
          className="absolute top-4 left-4 text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors"
        >
          ← 返回
        </button>
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 relative">
        <button
          onClick={() => nav('/')}
          className="absolute top-4 left-4 text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors"
        >
          ← 返回
        </button>
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-400">正在准备题目...</p>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════
  //  ready — 答题中
  // ══════════════════════════════════════════════════════
  const q = quiz.questions[quiz.currentIndex]
  // 错题本空状态
  if (!q && mode === 'wrongbook' && quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center relative">
        <button
          onClick={() => nav('/')}
          className="absolute top-4 left-4 text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors"
        >
          ← 返回
        </button>
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">错题本已清空</h2>
        <p className="text-sm text-gray-400 mb-6">当前分类没有错题，继续保持！</p>
        <button
          onClick={() => nav('/')}
          className="px-8 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
        >
          返回首页
        </button>
      </div>
    )
  }
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
          {/* 左侧：返回 */}
          <button
            onClick={() => setShowBackConfirm(true)}
            className="text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors"
          >
            ← 返回
          </button>
          {/* 中间：进度信息 */}
          <span className="text-xs font-medium text-gray-400">
            {mode === 'wrongbook'
              ? `错题本 · ${q.category} · ${quiz.currentIndex + 1}/${quiz.totalQuestions}`
              : isInstantMode
                ? `${q.category} · ${quiz.currentIndex + 1}/${quiz.totalQuestions}`
                : `第 ${quiz.currentIndex + 1}/${quiz.totalQuestions} 题`
            }
          </span>
          {/* 右侧：题型标签 + 分类标签（仅随机模式） */}
          <div className="flex items-center gap-2">
            {!isInstantMode && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-600">
                {q.category}
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadge.bg} ${typeBadge.text}`}
            >
              {typeBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── 题量不足提示条 ── */}
      {quiz.hasShortage && (
        <div className="mx-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <span className="text-amber-600 text-sm">⚠</span>
          <span className="text-amber-700 text-xs font-medium">当前题库题量不足，部分题目可能重复出现</span>
        </div>
      )}

      {/* ── 题目内容区 ── */}
      <div ref={contentRef} className="flex-1 flex flex-col px-5 pt-6 overflow-y-auto">
        {/* 题干 */}
        <div className="mb-5">
          <p className="text-lg leading-relaxed text-gray-900 font-medium">{q.stem}</p>
          {q.type === 'multi' && !isInstantMode && (
            <p className="text-xs text-purple-500 mt-2">多选题 · 全对得 2 分</p>
          )}
          {q.type === 'multi' && isInstantMode && (
            <p className="text-xs text-purple-500 mt-2">多选题 · 选择后点击提交</p>
          )}
        </div>

        {/* 不确定标记按钮 — 仅随机模式 */}
        {!isInstantMode && (
          <div className="flex justify-center mb-5">
            <button
              onClick={quiz.toggleUncertain}
              className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full border-2 text-sm font-medium transition-all active:scale-[0.98] ${
                quiz.isCurrentUncertain
                  ? 'border-rose-300 bg-rose-50 text-rose-600'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
              }`}
              aria-label={quiz.isCurrentUncertain ? '取消标记' : '标记为不确定'}
            >
              <span>{quiz.isCurrentUncertain ? '⚑' : '⚐'}</span>
              <span>{quiz.isCurrentUncertain ? '已标记为不确定' : '标记为不确定'}</span>
            </button>
          </div>
        )}

        {/* 大号选项按钮 */}
        <div className="flex flex-col gap-3">
          {q.options.map((opt, idx) => {
            const letter = optionLabels[idx]
            const active = isSelected(letter)
            const text = opt.replace(/^[A-F][.、\s]+/, '')
            const isDone = quiz.isCurrentDone

            // 已完成状态的颜色
            let doneStyle = ''
            if (isDone) {
              const correctAnswer = (feedback?.correctAnswer ?? q.answer ?? '') ?? q.answer ?? ''
              const isCorrectOption = correctAnswer.split(',').includes(letter)
              const isUserChoice = active
              if (isCorrectOption) {
                doneStyle = 'border-green-400 bg-green-50'
              } else if (isUserChoice && !isCorrectOption) {
                doneStyle = 'border-red-400 bg-red-50'
              } else {
                doneStyle = 'border-gray-100 bg-gray-50 opacity-60'
              }
            }

            return (
              <button
                key={letter}
                onClick={async () => {
                  if (isDone) return
                  quiz.selectOption(letter)
                  // 即时模式：单选/判断自动提交
                  if (isInstantMode && q.type !== 'multi' && !submitting) {
                    setSubmitting(true)
                    try {
                      const db = await openDB()
                      const category = searchParams.get('category') ?? '全部'
                      const result = await quiz.submitOne(db, mode as 'sequential' | 'wrongbook', category, letter)
                      if (result) setFeedback(result)
                    } catch { /* ignore */ }
                    finally { setSubmitting(false) }
                  }
                }}
                disabled={isDone}
                className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl border-2 transition-all duration-200 ${
                  isDone
                    ? doneStyle + ' cursor-default'
                    : active
                      ? 'border-indigo-400 bg-indigo-50 shadow-sm active:scale-[0.98]'
                      : 'border-gray-100 bg-gray-50 hover:border-gray-200 active:scale-[0.98]'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    isDone && (feedback?.correctAnswer ?? q.answer ?? '').split(',').includes(letter)
                      ? 'bg-green-500 text-white'
                      : isDone && active && !(feedback?.correctAnswer ?? q.answer ?? '').split(',').includes(letter)
                        ? 'bg-red-500 text-white'
                        : active && !isDone
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {isDone && (feedback?.correctAnswer ?? q.answer ?? '').split(',').includes(letter) ? '✓' : active && isDone ? '✗' : active ? '✓' : letter}
                </span>
                <span className={`text-base text-left ${
                  isDone && (feedback?.correctAnswer ?? q.answer ?? '').split(',').includes(letter)
                    ? 'text-green-700 font-medium'
                    : isDone && active
                      ? 'text-red-700'
                      : active && !isDone
                        ? 'text-indigo-900 font-medium'
                        : 'text-gray-700'
                }`}>
                  {text}
                </span>
              </button>
            )
          })}
        </div>

        {/* 多选提交按钮（即时模式） */}
        {isInstantMode && q.type === 'multi' && !quiz.isCurrentDone && (
          <div className="mt-4">
            <button
              onClick={handleSubmitOne}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {submitting ? '提交中...' : '提交答案'}
            </button>
          </div>
        )}

        {/* 反馈区域（即时模式） */}
        {isInstantMode && (() => {
          // 推导显示用的 feedback：优先用当前 feedback 状态，已完成的题从数据推导
          let displayFeedback = feedback
          if (!displayFeedback && quiz.isCurrentDone) {
            const userAns = quiz.currentAnswer
            const correctAns = q.answer ?? ''
            const isMulti = q.type === 'multi'
            const isCorrect = isMulti
              ? userAns.split(',').sort().join(',') === correctAns.split(',').sort().join(',')
              : userAns === correctAns
            displayFeedback = { isCorrect, correctAnswer: correctAns, explanation: q.explanation ?? '' }
          }
          if (!displayFeedback) return null

          return (
            <div className={`mt-4 p-4 rounded-xl border-2 ${
              displayFeedback.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}>
              <p className={`text-sm font-bold mb-2 ${
                displayFeedback.isCorrect ? 'text-green-600' : 'text-red-600'
              }`}>
                {displayFeedback.isCorrect ? '✅ 回答正确' : '❌ 回答错误'}
              </p>
              {!displayFeedback.isCorrect && (
                <p className="text-sm text-gray-600 mb-2">
                  正确答案：<span className="font-bold text-green-600">{displayFeedback.correctAnswer}</span>
                </p>
              )}
              {displayFeedback.explanation && (
                <p className="text-sm text-gray-500 leading-relaxed">{displayFeedback.explanation}</p>
              )}
            </div>
          )
        })()}
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
            const isDone = a?.isSubmitted

            let cellStyle = 'bg-gray-100 text-gray-400'
            if (isCurrent) {
              cellStyle = 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-100 text-indigo-700 scale-110'
            } else if (isDone) {
              cellStyle = 'bg-green-100 text-green-700'
            } else if (isFlagged && !isCurrent) {
              cellStyle = 'bg-amber-100 text-amber-600'
            } else if (isAnswered && !isFlagged) {
              cellStyle = 'bg-green-100 text-green-700'
            }

            return (
              <button
                key={idx}
                ref={(el) => {
                  if (el) {
                    thumbRefs.current.set(idx, el)
                  } else {
                    thumbRefs.current.delete(idx)
                  }
                }}
                onClick={() => {
                  setFeedback(null)
                  quiz.goTo(idx)
                }}
                className={`flex-shrink-0 w-7 h-7 rounded-md text-[10px] font-medium flex items-center justify-center transition-all ${cellStyle}`}
              >
                {isFlagged && !isInstantMode ? '⚑' : idx + 1}
              </button>
            )
          })}
        </div>

        {/* 底部按钮 */}
        {allDone ? (
          /* 全部完成状态 */
          <div className="px-4 py-6 flex flex-col items-center gap-3">
            <p className="text-2xl">🎉</p>
            <p className="text-sm font-bold text-gray-800">你已完成本分类全部题目</p>
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={handleRestart}
                className="flex-1 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
              >
                从头开始
              </button>
              <button
                onClick={() => nav('/')}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium active:bg-gray-50 transition-colors"
              >
                返回首页
              </button>
            </div>
          </div>
        ) : isInstantMode ? (
          /* 即时模式按钮 */
          <div className="px-4 py-3 flex gap-3">
            <button
              onClick={() => { setFeedback(null); quiz.goPrev() }}
              disabled={isFirstQuestion}
              className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-gray-50 transition-colors flex-shrink-0"
            >
              ←
            </button>
            <button
              onClick={feedback ? handleNextAfterFeedback : quiz.goNext}
              disabled={(!feedback && isLastQuestion)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium active:scale-[0.98] transition-all ${
                isLastQuestion && !feedback
                  ? 'bg-gray-100 text-gray-300'
                  : 'bg-gray-900 text-white active:bg-gray-800'
              }`}
            >
              {isLastQuestion && feedback ? '最后一道' : isLastQuestion ? '已是最后' : '下一题'}
            </button>
            {!isLastQuestion && (
              <button
                onClick={feedback ? handleNextAfterFeedback : quiz.goNext}
                className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 active:bg-gray-50 transition-colors flex-shrink-0"
              >
                →
              </button>
            )}
          </div>
        ) : (
          /* 随机模式按钮（保持原样） */
          <div className="px-4 py-3 flex gap-3">
            <button
              onClick={quiz.goPrev}
              disabled={isFirstQuestion}
              className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-gray-50 transition-colors flex-shrink-0"
            >
              ←
            </button>

            {!isLastQuestion ? (
              <>
                <button
                  onClick={quiz.goNext}
                  className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium active:bg-gray-800 transition-colors"
                >
                  下一题
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400 active:bg-gray-50 transition-colors flex-shrink-0"
                >
                  交卷
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium active:from-green-600 active:to-emerald-600 transition-colors"
                >
                  ✓ 交卷 ({quiz.answeredCount}/{quiz.totalQuestions})
                </button>
                <button
                  disabled
                  className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 opacity-20 flex-shrink-0"
                >
                  →
                </button>
              </>
            )}
          </div>
        )}
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

      {/* ── 返回确认弹窗 ── */}
      <ConfirmModal
        open={showBackConfirm}
        title="确认返回"
        message={isInstantMode ? '进度已自动保存，确定返回首页吗？' : '当前答题进度不会保存，确定要返回吗？'}
        confirmLabel="确认返回"
        cancelLabel={isInstantMode ? '继续练习' : '继续答题'}
        confirmVariant="green"
        onConfirm={() => {
          setShowBackConfirm(false)
          nav('/')
        }}
        onCancel={() => setShowBackConfirm(false)}
      >
        {!isInstantMode && quiz.answeredCount > 0 && (
          <p className="text-sm text-red-500 font-medium">
            已答 {quiz.answeredCount}/{quiz.totalQuestions} 题，返回后进度将丢失
          </p>
        )}
      </ConfirmModal>
    </div>
  )
}
