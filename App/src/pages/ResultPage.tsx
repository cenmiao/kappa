import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Attempt, Question, AnswerRecord } from '../types'
import TypeScoreBar from '../components/TypeScoreBar'

/** 单题结果（用于展示） */
interface QuestionResult {
  index: number
  questionId: number
  type: Question['type']
  stem: string
  options: string[]
  correctAnswer: string
  userAnswer: string
  isCorrect: boolean
  isUncertain: boolean
  isFlaggedCorrect: boolean // 蒙对 = 答对 + 不确定
  explanation?: string
}

const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']

export default function ResultPage() {
  const location = useLocation()
  const nav = useNavigate()

  const attempt = location.state?.attempt as Attempt | undefined
  const questions = location.state?.questions as Question[] | undefined

  // ─── 无数据时显示占位 ───
  if (!attempt || !questions) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">暂无成绩数据</h2>
        <p className="text-sm text-gray-400 mb-6">请先完成一次答题后再查看成绩报告</p>
        <button
          onClick={() => nav('/')}
          className="px-6 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
        >
          返回首页
        </button>
      </div>
    )
  }

  // ─── 构建题目结果映射 ───
  const answerMap = new Map<number, AnswerRecord>()
  for (const a of attempt.answers) {
    answerMap.set(a.questionId, a)
  }

  const results: QuestionResult[] = questions.map((q, idx) => {
    const a = answerMap.get(q.id)
    const userAnswer = a?.userAnswer ?? ''
    const isCorrect = a?.isCorrect ?? false
    const isUncertain = a?.isUncertain ?? false
    return {
      index: idx,
      questionId: q.id,
      type: q.type,
      stem: q.stem,
      options: q.options,
      correctAnswer: q.answer ?? '',
      userAnswer,
      isCorrect,
      isUncertain,
      isFlaggedCorrect: isCorrect && isUncertain,
      explanation: q.explanation,
    }
  })

  // ─── 统计 ───
  const singleResults = results.filter((r) => r.type === 'single')
  const multiResults = results.filter((r) => r.type === 'multi')
  const tfResults = results.filter((r) => r.type === 'tf')

  const singleCorrect = singleResults.filter((r) => r.isCorrect).length
  const multiCorrect = multiResults.filter((r) => r.isCorrect).length
  const tfCorrect = tfResults.filter((r) => r.isCorrect).length

  const reviewList = results.filter((r) => !r.isCorrect || r.isUncertain)

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  // ══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ── 头部 — 总分大数字 ── */}
      <div className="bg-gradient-to-b from-indigo-600 to-indigo-500 text-white px-5 pt-8 pb-8 text-center relative">
        <button
          onClick={() => nav('/')}
          className="absolute top-3 left-4 text-xs font-medium text-indigo-300 hover:text-white transition-colors"
        >
          ← 首页
        </button>
        <p className="text-sm text-indigo-200 mb-2">成绩报告</p>
        <div className="text-6xl font-bold mb-2">{attempt.score}</div>
        <div className="text-indigo-200 text-sm mb-4">满分 {attempt.total} 分</div>

        {/* 正确率进度条 */}
        <div className="max-w-xs mx-auto">
          <div className="flex justify-between text-xs text-indigo-200 mb-1">
            <span>正确率</span>
            <span>{Math.round(attempt.accuracy * 100)}%</span>
          </div>
          <div className="h-3 bg-indigo-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${attempt.accuracy * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 分题型得分柱状条 ── */}
      <div className="px-5 -mt-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-3 gap-3">
            <TypeScoreBar
              label="单选"
              correct={singleCorrect}
              total={singleResults.length}
              color="bg-blue-500"
            />
            <TypeScoreBar
              label="多选"
              correct={multiCorrect}
              total={multiResults.length}
              color="bg-purple-500"
            />
            <TypeScoreBar
              label="判断"
              correct={tfCorrect}
              total={tfResults.length}
              color="bg-amber-500"
            />
          </div>
        </div>
      </div>

      {/* ── 答题卡网格 ── */}
      <div className="px-5 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">答题卡</h3>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-8 gap-1.5">
            {results.map((r) => {
              let bg = 'bg-green-500 text-white'
              if (r.userAnswer === '') {
                bg = 'bg-gray-200 text-gray-500'
              } else if (!r.isCorrect) {
                bg = 'bg-red-500 text-white'
              } else if (r.isFlaggedCorrect) {
                bg = 'bg-amber-400 text-white'
              }

              return (
                <button
                  key={r.questionId}
                  onClick={() =>
                    setExpandedIndex(expandedIndex === r.index ? null : r.index)
                  }
                  className={`w-9 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center transition-all ${bg} ${
                    expandedIndex === r.index ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                  }`}
                >
                  {r.index + 1}
                </button>
              )
            })}
          </div>

          {/* 图例 */}
          <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500 inline-block" />
              正确
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500 inline-block" />
              错误
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-400 inline-block" />
              蒙对
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-200 inline-block" />
              未答
            </span>
          </div>
        </div>

        {/* ── 展开的题目解析 ── */}
        {expandedIndex !== null && (() => {
          const r = results[expandedIndex]
          if (!r) return null

          return (
            <div className="mt-3 bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              {/* 题号 + 题型标签 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">#{r.index + 1}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    r.type === 'single'
                      ? 'bg-blue-100 text-blue-700'
                      : r.type === 'multi'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {r.type === 'single' ? '单选题' : r.type === 'multi' ? '多选题' : '判断题'}
                </span>
              </div>

              {/* 题干 */}
              <p className="text-sm text-gray-800 mb-3 leading-relaxed">{r.stem}</p>

              {/* 选项及状态 */}
              <div className="text-xs space-y-1.5">
                {r.options.map((opt, i) => {
                  const letter = optionLabels[i]
                  const isCorrectOpt = r.correctAnswer.includes(letter)
                  const isUserPick = r.userAnswer.includes(letter)

                  // 选项文本（去除可能的前缀）
                  const text = opt.replace(/^[A-F][.、\s]+/, '')

                  let cls = 'text-gray-400'
                  let marker = ''
                  if (isCorrectOpt && isUserPick) {
                    cls = 'text-green-600 font-semibold'
                    marker = '✓ 你的答案 = 正确答案'
                  } else if (isCorrectOpt) {
                    cls = 'text-green-600'
                    marker = '✓ 正确答案'
                  } else if (isUserPick) {
                    cls = 'text-red-600'
                    marker = '✗ 你的答案'
                  }

                  return (
                    <p key={letter} className={cls}>
                      {letter}. {text}
                      {marker && (
                        <span className="ml-2 text-[10px]">{marker}</span>
                      )}
                    </p>
                  )
                })}
              </div>

              {/* 答案对比 + 解析 */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">你的答案：</span>
                  <span className={r.isCorrect ? 'text-green-600' : 'text-red-600'}>
                    {r.userAnswer || '(未作答)'}
                  </span>
                  {!r.isCorrect && (
                    <span className="text-green-600"> → {r.correctAnswer}</span>
                  )}
                </p>
                {r.explanation && (
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    {r.explanation}
                  </p>
                )}
              </div>

              {/* 关闭按钮 */}
              <button
                onClick={() => setExpandedIndex(null)}
                className="mt-4 w-full py-2 rounded-lg border border-gray-200 text-xs text-gray-400 active:bg-gray-50 transition-colors"
              >
                收起
              </button>
            </div>
          )
        })()}
      </div>

      {/* ── 需复习列表 ── */}
      <div className="px-5 mt-4">
        {reviewList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-sm font-medium text-gray-800 mb-1">全部掌握！</p>
            <p className="text-xs text-gray-400">没有需要复习的题目</p>
          </div>
        ) : (
          <>
            {/* "针对复习" 按钮 */}
            <button
              onClick={() => {
                const reviewIds = new Set(reviewList.map(r => r.questionId))
                const reviewQs = questions.filter(q => reviewIds.has(q.id))
                nav('/quiz', { state: { reviewQuestions: reviewQs } })
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-sm font-medium active:from-amber-500 active:to-orange-500 transition-colors mb-3"
            >
              📌 针对这 {reviewList.length} 题重新练习
            </button>

            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              📌 需复习 ({reviewList.length} 题)
            </h3>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {reviewList.map((r, i) => (
                <div
                  key={r.questionId}
                  className={`px-4 py-3 flex items-center gap-3 ${
                    i < reviewList.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      !r.isCorrect
                        ? 'bg-red-100 text-red-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {!r.isCorrect ? '✗' : '⚑'}
                  </span>
                  <span className="text-xs text-gray-700 truncate flex-1">
                    {r.stem}
                  </span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {r.userAnswer || '?'}→{r.correctAnswer}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── 底部按钮 ── */}
      <div className="px-5 mt-6 mb-10 flex gap-3">
        <button
          onClick={() => nav('/')}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 bg-white active:bg-gray-50 transition-colors"
        >
          返回首页
        </button>
        <button
          onClick={() => nav('/quiz')}
          className="flex-1 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
        >
          重新练习
        </button>
      </div>
    </div>
  )
}

