// Slice 2: computeStats 纯函数测试
import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'
import type { Attempt } from './types'

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode: 'random',
    score: 80,
    total: 100,
    accuracy: 0.8,
    singleAccuracy: 0.9,
    multiAccuracy: 0.7,
    tfAccuracy: 0.8,
    answers: [],
    ...overrides,
  }
}

describe('computeStats', () => {
  it('空数组返回零值', () => {
    const stats = computeStats([])
    expect(stats.total).toBe(0)
    expect(stats.average).toBe(0)
    expect(stats.highest).toBe(0)
    expect(stats.latest).toBeNull()
  })

  it('单条记录：平均分=最高分=最近分=该记录分', () => {
    const a = makeAttempt({ score: 75 })
    const stats = computeStats([a])
    expect(stats.total).toBe(1)
    expect(stats.average).toBe(75)
    expect(stats.highest).toBe(75)
    expect(stats.latest).toBe(a)
  })

  it('多条记录正确计算平均分和最高分', () => {
    const attempts = [
      makeAttempt({ date: '2026-01-01T00:00:00.000Z', score: 60 }),
      makeAttempt({ date: '2026-03-15T00:00:00.000Z', score: 90 }),
      makeAttempt({ date: '2026-06-01T00:00:00.000Z', score: 80 }),
    ]
    const stats = computeStats(attempts)
    expect(stats.total).toBe(3)
    expect(stats.average).toBe(77) // (60+90+80)/3 = 76.67 → 四舍五入 77
    expect(stats.highest).toBe(90)
    // latest = 时间最新那个
    expect(stats.latest!.score).toBe(80)
  })

  it('latest 返回时间最晚的记录', () => {
    const a1 = makeAttempt({ id: 'a1', date: '2026-01-01T00:00:00.000Z' })
    const a2 = makeAttempt({ id: 'a2', date: '2026-06-24T00:00:00.000Z' })
    const a3 = makeAttempt({ id: 'a3', date: '2026-03-15T00:00:00.000Z' })
    expect(computeStats([a1, a2, a3]).latest!.id).toBe('a2')
  })
})
