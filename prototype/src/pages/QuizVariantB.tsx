// 变体 B — 滑动卡片：全屏沉浸式卡片，大号点击区域
// 顶部细进度条 + 底部已答题缩略图导航 + 手势友好的大按钮

import { useCallback, useState } from 'react'
import type { QuizState } from './useQuizState'

interface Props extends QuizState {
  onAnswer: (qid: number, ans: string) => void
  onToggleUncertain: (qid: number) => void
  onGoTo: (idx: number) => void
  onSubmit: () => void
}

export default function QuizVariantB({
  questions,
  currentIndex,
  answers,
  isSubmitted,
  currentAnswer,
  totalQuestions,
  answeredCount,
  onAnswer,
  onToggleUncertain,
  onGoTo,
  onSubmit,
}: Props) {
  const q = questions[currentIndex]
  if (!q) return null

  const isSingle = q.type === 'single' || q.type === 'tf'
  const selected = currentAnswer?.userAnswer ?? ''
  const isUncertain = currentAnswer?.isUncertain ?? false
  const [showConfirm, setShowConfirm] = useState(false)

  const unansweredCount = totalQuestions - answeredCount

  const handleSubmit = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const selectOption = useCallback(
    (opt: string) => {
      const letter = opt.charAt(0)
      if (isSingle) {
        onAnswer(q.id, letter)
      } else {
        const current = selected ? selected.split(',') : []
        const idx = current.indexOf(letter)
        if (idx >= 0) current.splice(idx, 1)
        else current.push(letter)
        onAnswer(q.id, current.sort().join(','))
      }
    },
    [isSingle, selected, onAnswer, q.id],
  )

  const isSelected = (opt: string) => {
    if (!selected) return false
    return selected.split(',').includes(opt.charAt(0))
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 顶部进度条 + 元数据 */}
      <div className="sticky top-0 bg-white z-10">
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">
            {currentIndex + 1}/{totalQuestions}
          </span>
          <div className="flex items-center gap-3">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              q.type === 'single' ? 'bg-blue-50 text-blue-600' :
              q.type === 'multi' ? 'bg-purple-50 text-purple-600' :
              'bg-amber-50 text-amber-600'
            }`}>
              {q.typeLabel}
            </span>
            <button
              onClick={() => onToggleUncertain(q.id)}
              className={`text-lg transition-colors ${isUncertain ? 'text-amber-500' : 'text-gray-300'}`}
            >
              {isUncertain ? '⚑' : '⚐'}
            </button>
          </div>
        </div>
      </div>

      {/* 题目内容区 */}
      <div className="flex-1 flex flex-col px-5 pt-6">
        {/* 题干 — 大字号，宽松行距 */}
        <div className="mb-8">
          <p className="text-lg leading-relaxed text-gray-900 font-medium">{q.stem}</p>
          {q.type === 'multi' && (
            <p className="text-xs text-purple-500 mt-2">多选题 · 全对得 2 分</p>
          )}
        </div>

        {/* 大号选项按钮 */}
        <div className="flex flex-col gap-3">
          {q.options.map((opt) => {
            const active = isSelected(opt)
            const letter = opt.charAt(0)
            const text = opt.slice(3)

            return (
              <button
                key={opt}
                onClick={() => selectOption(opt)}
                className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                  active
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                    : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                }`}
              >
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    active
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white border-2 border-gray-200 text-gray-400'
                  }`}
                >
                  {active ? '✓' : letter}
                </span>
                <span className={`text-base text-left ${active ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>
                  {text}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 底部缩略图导航 + 操作区 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100">
        {/* 缩略图网格 — 已答/未答色块 */}
        <div className="px-4 pt-3 pb-1 flex gap-1 overflow-x-auto no-scrollbar">
          {questions.map((_, idx) => {
            const a = answers[questions[idx].id]
            const isCurrent = idx === currentIndex
            const isAnswered = a?.userAnswer
            const isFlagged = a?.isUncertain
            return (
              <button
                key={idx}
                onClick={() => onGoTo(idx)}
                className={`flex-shrink-0 w-7 h-7 rounded-md text-[10px] font-medium flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'ring-2 ring-indigo-400 ring-offset-1 bg-indigo-100 text-indigo-700 scale-110'
                    : isAnswered
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isFlagged ? '⚑' : idx + 1}
              </button>
            )
          })}
        </div>

        {/* 底部按钮 */}
        <div className="px-4 py-3 flex gap-3">
          <button
            onClick={() => onGoTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-gray-50 transition-colors flex-shrink-0"
          >
            ←
          </button>

          {currentIndex < totalQuestions - 1 ? (
            <>
              <button
                onClick={() => onGoTo(currentIndex + 1)}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-medium active:bg-gray-800 transition-colors"
              >
                下一题
              </button>
              <button
                onClick={handleSubmit}
                className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400 active:bg-gray-50 transition-colors flex-shrink-0"
              >
                交卷
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium active:from-green-600 active:to-emerald-600 transition-colors"
              >
                ✓ 交卷 ({answeredCount}/{totalQuestions} 已答)
              </button>
              <button
                onClick={() => onGoTo(currentIndex + 1)}
                disabled={currentIndex >= totalQuestions - 1}
                className="w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-20 active:bg-gray-50 transition-colors flex-shrink-0"
              >
                →
              </button>
            </>
          )}
        </div>
      </div>

      {/* 交卷确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg px-5 pt-6 pb-8 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认交卷</h3>
            {unansweredCount > 0 ? (
              <p className="text-sm text-gray-500 mb-6">
                还有 <span className="text-red-500 font-bold">{unansweredCount} 题</span> 未作答，确定交卷吗？未答题目将计为错误。
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-6">
                全部 {totalQuestions} 题已作答，确定交卷吗？
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 active:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => { setShowConfirm(false); onSubmit() }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium active:from-green-600 active:to-emerald-600 transition-colors"
              >
                确定交卷
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
