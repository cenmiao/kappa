import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Attempt } from '../types'
import { openDB } from '../db'
import { getAllAttempts } from '../db/attempts'
import { computeStats } from '../stats'
import SparkLine from '../components/SparkLine'
import TypeScoreBar from '../components/TypeScoreBar'

type PageState = 'loading' | 'ready'

export default function HistoryPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category') ?? '全部'
  const [pageState, setPageState] = useState<PageState>('loading')
  const [filteredAttempts, setFilteredAttempts] = useState<Attempt[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    openDB()
      .then((db) => getAllAttempts(db))
      .then((list) => {
        if (!cancelled) {
          const attempts = category === '全部'
            ? list
            : list.filter(a => a.category === category)
          setFilteredAttempts(attempts)
          setPageState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setPageState('ready')
      })
    return () => { cancelled = true }
  }, [category])

  // ─── 加载态 ───
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => nav('/')} className="text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors">← 首页</button>
            <h1 className="text-lg font-bold text-gray-900">历史记录</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // ─── 空状态 ───
  if (filteredAttempts.length === 0) {
    const emptyKind: 'generic' | 'category' = category === '全部' ? 'generic' : 'category'
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => nav('/')} className="text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors">← 首页</button>
            <h1 className="text-lg font-bold text-gray-900">历史记录</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center">
          <div className="text-6xl mb-6">📝</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            {emptyKind === 'generic' ? '还没有练习记录' : `${category}暂无练习记录`}
          </h2>
          <p className="text-sm text-gray-400 mb-8">
            {emptyKind === 'generic'
              ? '开始第一次练习，记录你的学习轨迹'
              : '返回首页选择其他题库或开始练习'}
          </p>
          <button
            onClick={() => nav('/')}
            className="px-8 py-3 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600 transition-colors"
          >
            {emptyKind === 'generic' ? '开始随机练习' : '返回首页'}
          </button>
        </div>
      </div>
    )
  }

  // ─── 有数据 ───
  const stats = computeStats(filteredAttempts)
  const chartData = filteredAttempts.map((a) => ({ date: a.date, score: a.score })).reverse()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20">
      {/* 头部 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => nav('/')} className="text-xs font-medium text-gray-400 hover:text-gray-500 transition-colors">← 首页</button>
          <h1 className="text-lg font-bold text-gray-900">历史记录</h1>
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* ── 统计概览四格卡片 ── */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatCard label="练习次数" value={String(stats.total)} />
          <StatCard label="平均分" value={String(stats.average)} />
          <StatCard label="最高分" value={String(stats.highest)} />
          <StatCard label="最近分" value={stats.latest ? String(stats.latest.score) : '-'} />
        </div>

        {/* ── SVG 得分趋势折线图 ── */}
        {chartData.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <SparkLine data={chartData} />
          </div>
        )}

        {/* ── 练习记录列表 ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {filteredAttempts.map((a, i) => {
            const isExpanded = expandedId === a.id
            return (
              <div
                key={a.id}
                className={i < filteredAttempts.length - 1 ? 'border-b border-gray-50' : ''}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50 transition-colors"
                  data-testid={`attempt-row-${a.id}`}
                >
                  {/* 模式图标 */}
                  <span className="text-lg">
                    {a.mode === 'random' ? '🎯' : a.mode === 'sequential' ? '📋' : '📌'}
                  </span>

                  {/* 得分 */}
                  <span className="text-base font-bold text-gray-900 w-10 text-right">{a.score}</span>

                  {/* 正确率标签 */}
                  <AccuracyBadge accuracy={a.accuracy} />

                  {/* 日期 */}
                  <span className="text-xs text-gray-400 flex-1 text-right">
                    {new Date(a.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  </span>

                  {/* 题型微型柱状条 */}
                  <div className="flex gap-0.5 items-end h-5">
                    <MicroBar pct={a.singleAccuracy} color="bg-blue-400" />
                    <MicroBar pct={a.multiAccuracy} color="bg-purple-400" />
                    <MicroBar pct={a.tfAccuracy} color="bg-amber-400" />
                  </div>
                </button>

                {/* ── 展开详情 ── */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                    <ExpandedDetail attempt={a} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** 统计卡片 */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 text-center" data-testid={`stat-${label}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold text-gray-900" data-testid={`stat-value-${label}`}>{value}</div>
    </div>
  )
}

/** 正确率颜色标签 */
function AccuracyBadge({ accuracy }: { accuracy: number }) {
  const pct = Math.round(accuracy * 100)
  let colorClass = 'bg-green-100 text-green-700'
  if (pct < 60) {
    colorClass = 'bg-red-100 text-red-600'
  } else if (pct < 80) {
    colorClass = 'bg-amber-100 text-amber-700'
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}>
      {pct}%
    </span>
  )
}

/** 微型柱状条 */
function MicroBar({ pct, color }: { pct: number; color: string }) {
  const h = Math.max(4, Math.round(pct * 20))
  return <span className={`w-1.5 rounded-t-sm ${color}`} style={{ height: h }} />
}

/** ── 展开详情面板 ── */
function ExpandedDetail({ attempt }: { attempt: Attempt }) {
  if (attempt.answers.length === 0) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">暂无答题详情数据</p>
    )
  }

  return (
    <div className="space-y-3">
      {/* 各题型正确率进度条 */}
      <div className="grid grid-cols-3 gap-3">
        <TypeScoreBar label="单选" correct={Math.round(attempt.singleAccuracy * 100)} total={100} color="bg-blue-500" isPercent />
        <TypeScoreBar label="多选" correct={Math.round(attempt.multiAccuracy * 100)} total={100} color="bg-purple-500" isPercent />
        <TypeScoreBar label="判断" correct={Math.round(attempt.tfAccuracy * 100)} total={100} color="bg-amber-500" isPercent />
      </div>

      {/* 答题卡网格 */}
      <div>
        <p className="text-xs text-gray-400 mb-2">答题卡</p>
        <div className="grid grid-cols-8 gap-1">
          {attempt.answers.map((a, idx) => {
            let bg = 'bg-green-500 text-white'
            if (a.userAnswer === '') {
              bg = 'bg-gray-200 text-gray-500'
            } else if (!a.isCorrect) {
              bg = 'bg-red-500 text-white'
            } else if (a.isUncertain) {
              bg = 'bg-amber-400 text-white'
            }
            return (
              <span
                key={idx}
                className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center ${bg}`}
              >
                {idx + 1}
              </span>
            )
          })}
        </div>

        {/* 图例 */}
        <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />正确
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />错误
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />蒙对
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />未答
          </span>
        </div>
      </div>
    </div>
  )
}
