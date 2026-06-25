// useQuizState — category 过滤 + 配额弹性测试
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Question } from '../types'
import { openDB } from '../db'

const DB_NAME = 'kappa-db'

afterEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    setTimeout(() => resolve(), 500)
  })
})

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    type: 'single',
    category: '综合管理',
    stem: `题目 ${overrides.id ?? 1}`,
    options: ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
    answer: 'A',
    ...overrides,
  }
}

async function seedQuestions(db: IDBDatabase, questions: Question[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readwrite')
    const store = tx.objectStore('questions')
    for (const q of questions) store.put(q)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// 用动态 import 避免模块级别的 DB 访问
async function getUseQuizState() {
  const mod = await import('./useQuizState')
  return mod.default
}

function hookWrapper() {
  // 返回 children 包装器（不需要 Router 等）
  return ({ children }: { children: React.ReactNode }) => children
}

describe('useQuizState — category 过滤', () => {
  it('initQuiz 传入 category 后，出题范围限定在该分类', async () => {
    const db = await openDB()
    // 综合管理：40 单选 + 20 多选 + 20 判断 = 80 题
    // 政治理论：40 单选 + 20 多选 + 20 判断 = 80 题
    const questions: Question[] = []
    let id = 1
    for (const cat of ['综合管理', '政治理论']) {
      for (let i = 0; i < 40; i++) {
        questions.push(makeQuestion({ id: id++, type: 'single', category: cat, stem: `${cat} 单选 ${i + 1}` }))
      }
      for (let i = 0; i < 20; i++) {
        questions.push(makeQuestion({ id: id++, type: 'multi', category: cat, stem: `${cat} 多选 ${i + 1}`, options: ['A', 'B', 'C', 'D'] }))
      }
      for (let i = 0; i < 20; i++) {
        questions.push(makeQuestion({ id: id++, type: 'tf', category: cat, stem: `${cat} 判断 ${i + 1}`, options: ['正确', '错误'] }))
      }
    }
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'random', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBe(80)
      })

      // 所有题目应来自综合管理
      expect(result.current.questions.every((q: Question) => q.category === '综合管理')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('category="全部" 时从所有题库抽题', async () => {
    const db = await openDB()
    const questions: Question[] = []
    let id = 1
    for (const cat of ['综合管理', '政治理论']) {
      for (let i = 0; i < 40; i++) {
        questions.push(makeQuestion({ id: id++, type: 'single', category: cat }))
      }
      for (let i = 0; i < 20; i++) {
        questions.push(makeQuestion({ id: id++, type: 'multi', category: cat }))
      }
      for (let i = 0; i < 20; i++) {
        questions.push(makeQuestion({ id: id++, type: 'tf', category: cat }))
      }
    }
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'random', '全部')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBe(80)
      })

      const categories = new Set(result.current.questions.map((q: Question) => q.category))
      expect(categories.has('综合管理')).toBe(true)
      expect(categories.has('政治理论')).toBe(true)
    } finally {
      db.close()
    }
  })
})

describe('useQuizState — 配额弹性分配与 hasShortage', () => {
  it('某题型完全缺失时配额弹性分配给其他题型', async () => {
    const db = await openDB()
    const questions: Question[] = []
    let id = 1
    // 综合管理只有单选和多选，缺判断题
    for (let i = 0; i < 50; i++) {
      questions.push(makeQuestion({ id: id++, type: 'single', category: '综合管理' }))
    }
    for (let i = 0; i < 30; i++) {
      questions.push(makeQuestion({ id: id++, type: 'multi', category: '综合管理' }))
    }
    // 无判断题！
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'random', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBe(80)
      })

      // 判断题应为 0
      const tfCount = result.current.questions.filter((q: Question) => q.type === 'tf').length
      expect(tfCount).toBe(0)

      // 单选应为 40 + 20*4/6 ≈ 53（判断的 20 配额按权重 4:2 分配给单选和多选）
      // 4/(4+2) * 20 = 13.33 → 14 or 13, 2/(4+2) * 20 = 6.66 → 7 or 6
      // 单选约 53，多选约 27
      const singleCount = result.current.questions.filter((q: Question) => q.type === 'single').length
      const multiCount = result.current.questions.filter((q: Question) => q.type === 'multi').length
      expect(singleCount).toBeGreaterThanOrEqual(40)
      expect(multiCount).toBeGreaterThanOrEqual(20)
      expect(singleCount + multiCount).toBe(80)
    } finally {
      db.close()
    }
  })

  it('总题目数小于 80 时 hasShortage 为 true', async () => {
    const db = await openDB()
    // 综合管理只有 5 道单选，远不够 80
    const questions: Question[] = Array.from({ length: 5 }, (_, i) =>
      makeQuestion({ id: i + 1, type: 'single', category: '综合管理' })
    )
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'random', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })

      expect(result.current.hasShortage).toBe(true)
    } finally {
      db.close()
    }
  })

  it('题目充足时 hasShortage 为 false', async () => {
    const db = await openDB()
    const questions: Question[] = []
    let id = 1
    for (let i = 0; i < 40; i++) {
      questions.push(makeQuestion({ id: id++, type: 'single', category: '综合管理' }))
    }
    for (let i = 0; i < 20; i++) {
      questions.push(makeQuestion({ id: id++, type: 'multi', category: '综合管理' }))
    }
    for (let i = 0; i < 20; i++) {
      questions.push(makeQuestion({ id: id++, type: 'tf', category: '综合管理' }))
    }
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'random', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBe(80)
      })

      expect(result.current.hasShortage).toBe(false)
    } finally {
      db.close()
    }
  })
})
