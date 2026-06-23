// 练习统计计算（纯函数）
import type { Attempt } from './types'

export interface Stats {
  total: number
  average: number
  highest: number
  latest: Attempt | null
}

export function computeStats(attempts: Attempt[]): Stats {
  if (attempts.length === 0) {
    return { total: 0, average: 0, highest: 0, latest: null }
  }

  const total = attempts.length
  const scores = attempts.map(a => a.score)
  const highest = Math.max(...scores)
  const average = Math.round(scores.reduce((s, v) => s + v, 0) / total)

  // latest = 时间最新的那条（按 date 降序第一条）
  const sorted = [...attempts].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]

  return { total, average, highest, latest }
}
