// useQuizState — category 过滤 + 配额弹性 + 顺序模式独立进度测试
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Question } from '../types'
import { openDB } from '../db'
import { saveProgress } from '../db/progress'

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

describe('useQuizState — 顺序模式按 category 过滤', () => {
  it('category="综合管理" 时只出该分类的题，按 ID 升序', async () => {
    const db = await openDB()
    // 构造 2 个分类的题目，ID 交错
    const questions: Question[] = [
      makeQuestion({ id: 1, category: '综合管理', stem: '综合管理 第1题' }),
      makeQuestion({ id: 2, category: '税务公共知识', stem: '税务 第1题' }),
      makeQuestion({ id: 3, category: '综合管理', stem: '综合管理 第2题' }),
      makeQuestion({ id: 4, category: '税务公共知识', stem: '税务 第2题' }),
      makeQuestion({ id: 5, category: '综合管理', stem: '综合管理 第3题' }),
    ]
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })

      // 应只包含综合管理的题
      expect(result.current.questions.every((q: Question) => q.category === '综合管理')).toBe(true)
      // 应按 ID 升序
      const ids = result.current.questions.map((q: Question) => q.id)
      expect(ids).toEqual([1, 3, 5])
    } finally {
      db.close()
    }
  })

  it('category="全部" 时出所有题，按 ID 升序', async () => {
    const db = await openDB()
    const questions: Question[] = [
      makeQuestion({ id: 3, category: '政治理论', stem: '政治 第1题' }),
      makeQuestion({ id: 1, category: '综合管理', stem: '综合 第1题' }),
      makeQuestion({ id: 2, category: '税务公共知识', stem: '税务 第1题' }),
    ]
    await seedQuestions(db, questions)

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '全部')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBe(3)
      })

      // 全部模式：按 ID 升序返回所有题
      const ids = result.current.questions.map((q: Question) => q.id)
      expect(ids).toEqual([1, 2, 3])
    } finally {
      db.close()
    }
  })
})

describe('useQuizState — 顺序模式独立进度', () => {
  it('有已保存进度时从上次位置继续', async () => {
    const db = await openDB()
    const questions: Question[] = Array.from({ length: 30 }, (_, i) =>
      makeQuestion({ id: i + 1, category: '综合管理', stem: `综合管理 第${i + 1}题` })
    )
    await seedQuestions(db, questions)
    // 模拟已刷 10 题
    await saveProgress(db, 10, 'sequential:综合管理')

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })

      // 应从第 11 题开始（ID=11），取 80 题但只有 30 题所以实际取 20 题
      expect(result.current.questions[0].id).toBe(11)
      expect(result.current.startIndex).toBe(10)
    } finally {
      db.close()
    }
  })

  it('不同 category 的进度相互独立', async () => {
    const db = await openDB()
    const qA: Question[] = Array.from({ length: 20 }, (_, i) =>
      makeQuestion({ id: i + 1, category: '综合管理', stem: `综合管理 第${i + 1}题` })
    )
    const qB: Question[] = Array.from({ length: 20 }, (_, i) =>
      makeQuestion({ id: i + 21, category: '税务公共知识', stem: `税务 第${i + 1}题` })
    )
    await seedQuestions(db, [...qA, ...qB])
    await saveProgress(db, 5, 'sequential:综合管理')

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      // 先初始化综合管理：应从第 6 题开始（ID=6）
      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '综合管理')
      })
      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })
      expect(result.current.questions[0].id).toBe(6)

      // 再切换到税务公共知识：应从第 1 题开始（ID=21）
      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '税务公共知识')
      })
      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })
      expect(result.current.questions[0].id).toBe(21)
    } finally {
      db.close()
    }
  })

  it('进度超过题库总题数时回到开头', async () => {
    const db = await openDB()
    const questions: Question[] = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ id: i + 1, category: '综合管理', stem: `综合管理 第${i + 1}题` })
    )
    await seedQuestions(db, questions)
    // 进度=10 表示已刷完 10 题
    await saveProgress(db, 10, 'sequential:综合管理')

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })

      // 应回到开头
      expect(result.current.questions[0].id).toBe(1)
      expect(result.current.startIndex).toBe(0)
    } finally {
      db.close()
    }
  })

  it('指定 category 进度不受默认 key 进度影响', async () => {
    const db = await openDB()
    const questions: Question[] = Array.from({ length: 30 }, (_, i) =>
      makeQuestion({ id: i + 1, category: '综合管理', stem: `综合管理 第${i + 1}题` })
    )
    await seedQuestions(db, questions)
    // 旧格式默认 key "sequential" 有进度 8；新格式 "sequential:综合管理" 有进度 3
    await saveProgress(db, 8)                          // 默认 key
    await saveProgress(db, 3, 'sequential:综合管理')  // category key

    try {
      const useQuizState = await getUseQuizState()
      const { result } = renderHook(() => useQuizState(), { wrapper: hookWrapper() })

      await act(async () => {
        await result.current.initQuiz(db, 'sequential', '综合管理')
      })

      await waitFor(() => {
        expect(result.current.questions.length).toBeGreaterThan(0)
      })

      // 应使用 category key 的进度 3（而非默认 key 的 8）
      expect(result.current.questions[0].id).toBe(4) // ID=4 即第 4 题（index 3）
    } finally {
      db.close()
    }
  })
})
