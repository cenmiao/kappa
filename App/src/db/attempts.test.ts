// Slice 1: getAllAttempts() 数据层测试
import { describe, it, expect } from 'vitest'
import { saveAttempt, getAllAttempts } from './attempts'
import type { Attempt } from '../types'

// 创建隔离的测试数据库（独立于应用 DB_NAME）
function openTestDB(): Promise<IDBDatabase> {
  const name = `test-attempts-${crypto.randomUUID()}`
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('attempts', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

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
    answers: [
      { questionId: 1, userAnswer: 'A', isCorrect: true, isUncertain: false },
    ],
    ...overrides,
  }
}

describe('getAllAttempts', () => {
  it('空库返回空数组', async () => {
    const db = await openTestDB()
    const results = await getAllAttempts(db)
    expect(results).toEqual([])
  })

  it('按时间倒序返回（最新的在前）', async () => {
    const db = await openTestDB()
    const oldest = makeAttempt({ id: 'oldest', date: '2026-01-01T00:00:00.000Z', score: 60 })
    const middle = makeAttempt({ id: 'middle', date: '2026-03-15T00:00:00.000Z', score: 80 })
    const newest = makeAttempt({ id: 'newest', date: '2026-06-01T00:00:00.000Z', score: 100 })

    await saveAttempt(db, oldest)
    await saveAttempt(db, middle)
    await saveAttempt(db, newest)

    const results = await getAllAttempts(db)
    expect(results).toHaveLength(3)
    expect(results[0].id).toBe('newest')
    expect(results[1].id).toBe('middle')
    expect(results[2].id).toBe('oldest')
  })

  it('返回的字段完整无丢失', async () => {
    const db = await openTestDB()
    const attempt = makeAttempt({
      id: 'full',
      mode: 'sequential',
      score: 95,
      accuracy: 0.95,
      singleAccuracy: 1.0,
      multiAccuracy: 0.9,
      tfAccuracy: 0.95,
      answers: [
        { questionId: 1, userAnswer: 'A', isCorrect: true, isUncertain: false },
        { questionId: 2, userAnswer: 'B,C', isCorrect: true, isUncertain: true },
      ],
    })
    await saveAttempt(db, attempt)

    const results = await getAllAttempts(db)
    expect(results).toHaveLength(1)
    const retrieved = results[0]
    expect(retrieved.id).toBe('full')
    expect(retrieved.mode).toBe('sequential')
    expect(retrieved.score).toBe(95)
    expect(retrieved.total).toBe(100)
    expect(retrieved.accuracy).toBe(0.95)
    expect(retrieved.singleAccuracy).toBe(1.0)
    expect(retrieved.multiAccuracy).toBe(0.9)
    expect(retrieved.tfAccuracy).toBe(0.95)
    expect(retrieved.answers).toHaveLength(2)
    expect(retrieved.answers[0].questionId).toBe(1)
    expect(retrieved.answers[1].isUncertain).toBe(true)
  })
})
