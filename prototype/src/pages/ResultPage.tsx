import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockQuestions } from '../data/mock'
import type { AnswerRecord } from '../data/mock'

interface QuizData {
  questions: typeof mockQuestions
  answers: Record<number, AnswerRecord>
  totalQuestions: number
}

export default function ResultPage({ quiz }: { quiz: QuizData }) {
  const nav = useNavigate()

  const { questions, answers } = quiz

  let correctCount = 0
  let totalScore = 0
  let maxScore = 0
  const singleCorrect = { correct: 0, total: 0 }
  const multiCorrect = { correct: 0, total: 0 }
  const tfCorrect = { correct: 0, total: 0 }
  const results: Array<{
    qid: number
    type: string
    isCorrect: boolean
    userAnswer: string
    correctAnswer: string
    isUncertain: boolean
    isFlaggedCorrect: boolean
  }> = []

  for (const q of questions) {
    const a = answers[q.id]
    const userAns = a?.userAnswer ?? ''
    const correctAns = q.answer
    const isCorrect = userAns === correctAns
    const isUncertain = a?.isUncertain ?? false

    if (q.type === 'single') {
      maxScore += 1
      singleCorrect.total++
      if (isCorrect) { correctCount++; totalScore += 1; singleCorrect.correct++ }
    } else if (q.type === 'multi') {
      maxScore += 2
      multiCorrect.total++
      if (isCorrect) { correctCount++; totalScore += 2; multiCorrect.correct++ }
    } else {
      maxScore += 1
      tfCorrect.total++
      if (isCorrect) { correctCount++; totalScore += 1; tfCorrect.correct++ }
    }

    results.push({
      qid: q.id,
      type: q.type,
      isCorrect,
      userAnswer: userAns || '(未作答)',
      correctAnswer: correctAns,
      isUncertain,
      isFlaggedCorrect: isCorrect && isUncertain,
    })
  }

  const accuracy = totalScore / maxScore
  const reviewList = results.filter((r) => !r.isCorrect || r.isUncertain)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 头部 — 总分大数字 */}
      <div className="bg-gradient-to-b from-indigo-600 to-indigo-500 text-white px-5 pt-8 pb-8 text-center">
        <p className="text-sm text-indigo-200 mb-2">成绩报告</p>
        <div className="text-6xl font-bold mb-2">{totalScore}</div>
        <div className="text-indigo-200 text-sm mb-4">满分 {maxScore} 分</div>

        <div className="max-w-xs mx-auto">
          <div className="flex justify-between text-xs text-indigo-200 mb-1">
            <span>正确率</span><span>{Math.round(accuracy * 100)}%</span>
          </div>
          <div className="h-3 bg-indigo-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-700"
              style={{ width: `${accuracy * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 各题型得分 */}
      <div className="px-5 -mt-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-3 gap-3">
            <TypeScoreBar label="单选" correct={singleCorrect.correct} total={singleCorrect.total} color="bg-blue-500" />
            <TypeScoreBar label="多选" correct={multiCorrect.correct} total={multiCorrect.total} color="bg-purple-500" />
            <TypeScoreBar label="判断" correct={tfCorrect.correct} total={tfCorrect.total} color="bg-amber-500" />
          </div>
        </div>
      </div>

      {/* 答题卡网格 */}
      <div className="px-5 mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">答题卡</h3>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-8 gap-1.5">
            {results.map((r, i) => {
              let bg = 'bg-green-500 text-white'
              if (!r.isCorrect) {
                bg = 'bg-red-500 text-white'
              } else if (r.isFlaggedCorrect) {
                bg = 'bg-amber-500 text-white'
              }
              return (
                <button
                  key={r.qid}
                  onClick={() => setExpandedId(expandedId === i ? null : i)}
                  className={`answer-cell w-9 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center ${bg} ${expandedId === i ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>

          <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" />正确</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" />错误</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" />蒙对</span>
          </div>
        </div>

        {/* 展开的题目解析 */}
        {expandedId !== null && (() => {
          const r = results[expandedId]
          const q = questions.find((qq) => qq.id === r.qid)
          if (!q) return null
          return (
            <div className="mt-3 bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">#{expandedId + 1}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${q.type === 'single' ? 'bg-blue-100 text-blue-700' : q.type === 'multi' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{q.typeLabel}</span>
              </div>
              <p className="text-sm text-gray-800 mb-3">{q.stem}</p>
              <div className="text-xs space-y-1">
                {q.options.map((opt) => {
                  const letter = opt.charAt(0)
                  const isCorrectOpt = q.answer.includes(letter)
                  const isUserPick = r.userAnswer.includes(letter)
                  const cls = isCorrectOpt && isUserPick ? 'text-green-600' :
                    isCorrectOpt ? 'text-green-600' :
                    isUserPick ? 'text-red-600' : 'text-gray-400'
                  return <p key={opt} className={cls}>{opt} {isUserPick ? '←' : ''}{isCorrectOpt ? ' ✓' : ''}</p>
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  <span className="font-medium">你的答案：</span>
                  <span className={r.isCorrect ? 'text-green-600' : 'text-red-600'}>{r.userAnswer}</span>
                  {!r.isCorrect && <span className="text-green-600"> → {r.correctAnswer}</span>}
                </p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{q.explanation}</p>
              </div>
            </div>
          )
        })()}
      </div>

      {/* 需复习列表 */}
      <div className="px-5 mt-4">
        {reviewList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-sm font-medium text-gray-800 mb-1">全部掌握！</p>
            <p className="text-xs text-gray-400">没有需要复习的题目</p>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              📌 需复习 ({reviewList.length} 题)
            </h3>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {reviewList.map((r, i) => {
                const q = questions.find((qq) => qq.id === r.qid)
                return (
                  <div key={r.qid} className={`px-4 py-3 flex items-center gap-3 ${i < reviewList.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      !r.isCorrect ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {!r.isCorrect ? '✗' : '⚑'}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{q?.stem}</span>
                    <span className="text-[10px] text-gray-400">{r.userAnswer}→{r.correctAnswer}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="px-5 mt-6 mb-10 flex flex-col gap-3">
        {reviewList.length > 0 && (
          <button
            onClick={() => nav('/quiz')}
            className="w-full py-3 rounded-xl bg-amber-500 text-white text-sm font-medium active:bg-amber-600 transition-colors"
          >
            📌 针对这 {reviewList.length} 题重新练习
          </button>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => nav('/')}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 bg-white active:bg-gray-50"
          >
            返回首页
          </button>
          <button
            onClick={() => nav('/quiz')}
            className="flex-1 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600"
          >
            重新练习
          </button>
        </div>
      </div>
    </div>
  )
}

function TypeScoreBar({ label, correct, total, color }: { label: string; correct: number; total: number; color: string }) {
  const pct = total > 0 ? correct / total : 0
  return (
    <div className="text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">{correct}/{total}</div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}
