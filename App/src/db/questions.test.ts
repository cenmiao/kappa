// questions.ts 测试：category 过滤
import { describe, it, expect, afterEach } from 'vitest'
import { getQuestionsByType, getRandomQuestions } from './questions'
import { openDB } from './index'
import type { Question } from '../types'

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
    stem: '测试题目？',
    options: ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
    answer: 'A',
    ...overrides,
  }
}

async function seedAndOpen(questions: Question[]): Promise<IDBDatabase> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readwrite')
    const store = tx.objectStore('questions')
    for (const q of questions) store.put(q)
    tx.oncomplete = () => resolve(db)
    tx.onerror = () => reject(tx.error)
  })
}

// ─── getQuestionsByType category 过滤 ──────────────────────

describe('getQuestionsByType — category 过滤', () => {
  it('category="全部" 时不过滤，返回该题型所有题目', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '政治理论' }),
      makeQuestion({ id: 3, type: 'multi', category: '综合管理' }),
    ])

    try {
      const result = await getQuestionsByType(db, 'single', '全部')
      expect(result).toHaveLength(2)
      expect(result.map(q => q.id).sort()).toEqual([1, 2])
    } finally {
      db.close()
    }
  })

  it('category 不传时行为同 "全部"', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '政治理论' }),
    ])

    try {
      const result = await getQuestionsByType(db, 'single')
      expect(result).toHaveLength(2)
    } finally {
      db.close()
    }
  })

  it('category 为具体分类时只返回该分类的题目', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 3, type: 'single', category: '政治理论' }),
      makeQuestion({ id: 4, type: 'single', category: '税务公共知识' }),
    ])

    try {
      const result = await getQuestionsByType(db, 'single', '综合管理')
      expect(result).toHaveLength(2)
      expect(result.every(q => q.category === '综合管理')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('跨题型：category 过滤不影响 type 过滤', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'multi', category: '综合管理' }),
      makeQuestion({ id: 3, type: 'tf', category: '综合管理' }),
    ])

    try {
      const result = await getQuestionsByType(db, 'multi', '综合管理')
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('multi')
      expect(result[0].category).toBe('综合管理')
    } finally {
      db.close()
    }
  })

  it('无匹配时返回空数组', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
    ])

    try {
      const result = await getQuestionsByType(db, 'single', '政治理论')
      expect(result).toHaveLength(0)
    } finally {
      db.close()
    }
  })
})

// ─── getRandomQuestions category 过滤 + 题量不足 ────────────

describe('getRandomQuestions — category 过滤', () => {
  it('category="全部" 时从所有题库随机抽题', async () => {
    const qs = Array.from({ length: 20 }, (_, i) =>
      makeQuestion({ id: i + 1, type: 'single', category: i < 10 ? '综合管理' : '政治理论' })
    )
    const db = await seedAndOpen(qs)

    try {
      const result = await getRandomQuestions(db, 'single', 5, [], '全部')
      expect(result).toHaveLength(5)
      // 不应有重复
      const ids = result.map(q => q.id)
      expect(new Set(ids).size).toBe(5)
    } finally {
      db.close()
    }
  })

  it('category 为具体分类时只从该分类抽题', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 3, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 4, type: 'single', category: '政治理论' }),
      makeQuestion({ id: 5, type: 'single', category: '政治理论' }),
    ])

    try {
      const result = await getRandomQuestions(db, 'single', 3, [], '综合管理')
      expect(result).toHaveLength(3)
      expect(result.every(q => q.category === '综合管理')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('排除 excludeIds 与 category 过滤同时生效', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 3, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 4, type: 'single', category: '政治理论' }),
    ])

    try {
      const result = await getRandomQuestions(db, 'single', 2, [1, 4], '综合管理')
      expect(result).toHaveLength(2)
      // 综合管理中排除了 id=1，只能抽到 id=2,3
      expect(result.map(q => q.id).sort()).toEqual([2, 3])
    } finally {
      db.close()
    }
  })

  it('category 不传时行为同 "全部"', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '政治理论' }),
    ])

    try {
      const result = await getRandomQuestions(db, 'single', 2)
      expect(result).toHaveLength(2)
    } finally {
      db.close()
    }
  })
})

describe('getRandomQuestions — 题量不足处理', () => {
  it('pool 数量小于 count 时允许题目重复', async () => {
    // 综合管理只有 3 道单选，但需要抽取 10 道
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'single', category: '综合管理' }),
      makeQuestion({ id: 3, type: 'single', category: '综合管理' }),
      // 政治理论有更多题，但不会被抽到
      makeQuestion({ id: 4, type: 'single', category: '政治理论' }),
      makeQuestion({ id: 5, type: 'single', category: '政治理论' }),
    ])

    try {
      const result = await getRandomQuestions(db, 'single', 10, [], '综合管理')
      // 允许重复的情况下仍返回 count 道题
      expect(result).toHaveLength(10)
      // 全部题目应来自综合管理
      expect(result.every(q => q.category === '综合管理')).toBe(true)
      // 存在重复的题目 ID
      const idSet = new Set(result.map(q => q.id))
      expect(idSet.size).toBeLessThan(10)
    } finally {
      db.close()
    }
  })

  it('pool 为空（题型完全缺失）时返回空数组', async () => {
    const db = await seedAndOpen([
      makeQuestion({ id: 1, type: 'multi', category: '综合管理' }),
      makeQuestion({ id: 2, type: 'tf', category: '综合管理' }),
    ])

    try {
      const result = await getRandomQuestions(db, 'single', 10, [], '综合管理')
      expect(result).toHaveLength(0)
    } finally {
      db.close()
    }
  })
})
