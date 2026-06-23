import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockAttempts, mockQuestions } from '../data/mock'

export default function HistoryPage() {
  const nav = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 模拟趋势数据（最近 6 次）
  const attempts = [...mockAttempts].reverse() // 最早的在前面
  const scores = attempts.map((a) => a.score)
  const maxScore = 100
  const minScore = Math.min(...scores)
  const range = maxScore - minScore || 1

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => nav('/')} className="text-gray-400 text-lg">←</button>
          <h1 className="text-lg font-bold text-gray-900">历史记录</h1>
        </div>
      </div>

      {/* 空状态 */}
      {attempts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
          <div className="text-6xl mb-6">📝</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">还没有练习记录</h2>
          <p className="text-sm text-gray-400 mb-8">开始第一次练习，记录你的学习轨迹</p>
          <button
            onClick={() => nav('/quiz')}
            className="px-8 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
          >
            开始随机练习
          </button>
        </div>
      )}

      {attempts.length > 0 && (<>
      {/* 统计概览卡片 */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatItem label="练习次数" value={attempts.length} unit="次" />
            <StatItem label="平均分" value={(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)} unit="分" />
            <StatItem label="最高分" value={Math.max(...scores)} unit="分" />
            <StatItem label="最近" value={scores[scores.length - 1]} unit="分" />
          </div>
        </div>
      </div>

      {/* 简易趋势图 */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">得分趋势</h3>
          <div className="relative h-32">
            {/* Y 轴标签 */}
            <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[10px] text-gray-400 text-right pr-1">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>0</span>
            </div>
            {/* 图表区 */}
            <div className="ml-8 h-full relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div className="border-t border-gray-100" />
                <div className="border-t border-gray-100" />
                <div className="border-t border-gray-100" />
                <div className="border-t border-gray-100" />
              </div>
              <svg className="absolute inset-0" viewBox={`0 0 ${(attempts.length - 1) * 60} 128`} preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="rgb(99,102,241)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={attempts.map((a, i) => {
                    const x = i * 60
                    const y = 128 - ((a.score - minScore) / range) * 110 - 9
                    return `${x},${y}`
                  }).join(' ')}
                />
                {attempts.map((a, i) => {
                  const x = i * 60
                  const y = 128 - ((a.score - minScore) / range) * 110 - 9
                  return (
                    <g key={a.id}>
                      <circle cx={x} cy={y} r="5" fill="white" stroke="rgb(99,102,241)" strokeWidth="2" />
                      <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="rgb(99,102,241)" fontWeight="bold">
                        {a.score}
                      </text>
                    </g>
                  )
                })}
              </svg>
              <div className="absolute bottom-0 left-0 right-0 flex justify-between translate-y-6">
                {attempts.map((a) => (
                  <div key={a.id} className="text-[9px] text-gray-400 text-center w-12 -ml-6">
                    {new Date(a.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 练习列表 */}
      <div className="px-4 mt-8 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">练习记录</h3>
        <div className="space-y-2">
          {attempts.map((a) => {
            const isExpanded = expandedId === a.id
            // 计算该次练习的答题卡数据
            const hasAnswerDetail = a.answers && a.answers.length > 0
            const answerGrid = hasAnswerDetail
              ? a.answers.map((ans, idx) => {
                  const q = mockQuestions.find((mq) => mq.id === ans.questionId)
                  const isCorrect = q ? ans.userAnswer === q.answer : false
                  const isFlaggedCorrect = isCorrect && ans.isUncertain
                  return { idx, ans, q, isCorrect, isFlaggedCorrect }
                })
              : []

            return (
              <div key={a.id}>
                <button
                  onClick={() => toggleExpand(a.id)}
                  className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 active:bg-gray-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                    a.mode === 'random' ? 'bg-indigo-100' : 'bg-blue-100'
                  }`}>
                    {a.mode === 'random' ? '🎯' : '📋'}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{a.score} 分</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${a.accuracy >= 0.8 ? 'bg-green-100 text-green-700' : a.accuracy >= 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {Math.round(a.accuracy * 100)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {a.mode === 'random' ? '随机练习' : '顺序练习'} · {new Date(a.date).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  {/* 微型题型柱状条 */}
                  <div className="flex gap-1 items-end h-8">
                    <div className="flex flex-col items-center">
                      <div className="w-2 bg-blue-400 rounded-t" style={{ height: `${a.singleAccuracy * 24}px` }} />
                      <span className="text-[8px] text-gray-400 mt-0.5">单</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-2 bg-purple-400 rounded-t" style={{ height: `${a.multiAccuracy * 24}px` }} />
                      <span className="text-[8px] text-gray-400 mt-0.5">多</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-2 bg-amber-400 rounded-t" style={{ height: `${a.tfAccuracy * 24}px` }} />
                      <span className="text-[8px] text-gray-400 mt-0.5">判</span>
                    </div>
                  </div>
                  <div className={`text-gray-300 text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    →
                  </div>
                </button>

                {/* 展开的详情 */}
                {isExpanded && (
                  <div className="bg-white rounded-b-xl shadow-sm border-t border-gray-50 px-4 py-4 mt-[-4px]">
                    {/* 各题型得分 */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <DetailBar label="单选题" accuracy={a.singleAccuracy} color="bg-blue-500" />
                      <DetailBar label="多选题" accuracy={a.multiAccuracy} color="bg-purple-500" />
                      <DetailBar label="判断题" accuracy={a.tfAccuracy} color="bg-amber-500" />
                    </div>

                    {/* 答题卡网格（仅当有详细作答数据时） */}
                    {hasAnswerDetail && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 mb-2">答题卡</h4>
                        <div className="grid grid-cols-8 gap-1.5">
                          {answerGrid.map((item) => {
                            let bg = 'bg-green-500 text-white'
                            if (!item.isCorrect) bg = 'bg-red-500 text-white'
                            else if (item.isFlaggedCorrect) bg = 'bg-amber-500 text-white'
                            return (
                              <div
                                key={item.idx}
                                className={`w-9 h-9 rounded-lg text-[11px] font-bold flex items-center justify-center ${bg}`}
                              >
                                {item.idx + 1}
                              </div>
                            )
                          })}
                        </div>
                        <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500 inline-block" />正确</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" />错误</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />蒙对</span>
                        </div>
                      </div>
                    )}

                    {!hasAnswerDetail && (
                      <p className="text-xs text-gray-400 text-center py-2">
                        详细作答数据在后续版本中支持查看
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="pb-20" />
      </>)}
    </div>
  )
}

function StatItem({ label, value, unit }: { label: string; value: number | string; unit: string }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-800">
        {value}<span className="text-xs text-gray-400 font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  )
}

function DetailBar({ label, accuracy, color }: { label: string; accuracy: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-bold text-gray-800">{Math.round(accuracy * 100)}%</div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${accuracy * 100}%` }} />
      </div>
    </div>
  )
}
