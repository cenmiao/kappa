import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import useQuizState from './useQuizState'
import QuizVariantB from './QuizVariantB'
import ResultPage from './ResultPage'

type LoadState = 'loading' | 'error' | 'ready'

export default function QuizPage() {
  const [searchParams] = useSearchParams()
  const nav = useNavigate()
  const quiz = useQuizState()

  // 原型中通过 ?loadError=true 演示加载失败状态
  const simulateError = searchParams.get('loadError') === 'true'
  const [loadState, setLoadState] = useState<LoadState>(
    simulateError ? 'loading' : 'ready'
  )

  // 模拟加载过程和可能的失败
  useEffect(() => {
    if (!simulateError) return
    const t = setTimeout(() => setLoadState('error'), 1500)
    return () => clearTimeout(t)
  }, [simulateError])

  // beforeunload 拦截：答题中刷新/关闭页面时弹出确认
  useEffect(() => {
    if (quiz.isSubmitted) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [quiz.isSubmitted])

  // 加载中
  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin mb-6" />
        <p className="text-sm text-gray-500">正在加载题库...</p>
      </div>
    )
  }

  // 加载失败
  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl mb-4">😵</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">题库加载失败</h2>
        <p className="text-sm text-gray-400 mb-6">请检查网络连接后重试</p>
        <div className="flex gap-3">
          <button
            onClick={() => nav('/')}
            className="px-6 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 active:bg-gray-50 transition-colors"
          >
            返回首页
          </button>
          <button
            onClick={() => { setLoadState('loading'); setTimeout(() => setLoadState('ready'), 1000) }}
            className="px-6 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  // 交卷后跳转成绩报告
  if (quiz.isSubmitted) {
    return <ResultPage quiz={quiz} />
  }

  return (
    <QuizVariantB
      questions={quiz.questions}
      currentIndex={quiz.currentIndex}
      answers={quiz.answers}
      isSubmitted={quiz.isSubmitted}
      currentAnswer={quiz.currentAnswer}
      totalQuestions={quiz.totalQuestions}
      answeredCount={quiz.answeredCount}
      onAnswer={quiz.setAnswer}
      onToggleUncertain={quiz.toggleUncertain}
      onGoTo={quiz.goTo}
      onSubmit={quiz.submit}
    />
  )
}
