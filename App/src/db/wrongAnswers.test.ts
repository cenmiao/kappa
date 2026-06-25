// wrongAnswers.ts 测试
import { describe, it, expect, afterEach } from 'vitest'
import { getWrongAnswersByType, upsertWrongAnswers } from './wrongAnswers'
import { openDB } from './index'

const DB_NAME = 'kappa-db'

afterEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    setTimeout(() => resolve(), 500)
  })
})

async function seedWrongAnswers(
  db: IDBDatabase,
  items: { questionId: number; type: string; category: string; wrongCount: number }[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongAnswers', 'readwrite')
    const store = tx.objectStore('wrongAnswers')
    for (const item of items) store.put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ─── getWrongAnswersByType category 过滤 ───────────────────

describe('getWrongAnswersByType — category 过滤', () => {
  it('category="全部" 时不过滤，返回该题型所有错题', async () => {
    const db = await openDB()
    await seedWrongAnswers(db, [
      { questionId: 1, type: 'single', category: '综合管理', wrongCount: 2 },
      { questionId: 2, type: 'single', category: '政治理论', wrongCount: 1 },
      { questionId: 3, type: 'multi', category: '综合管理', wrongCount: 3 },
    ])

    try {
      const result = await getWrongAnswersByType(db, 'single', '全部')
      expect(result).toHaveLength(2)
      expect(result.map(w => w.questionId).sort()).toEqual([1, 2])
    } finally {
      db.close()
    }
  })

  it('category 不传时行为同 "全部"', async () => {
    const db = await openDB()
    await seedWrongAnswers(db, [
      { questionId: 1, type: 'single', category: '综合管理', wrongCount: 1 },
      { questionId: 2, type: 'single', category: '政治理论', wrongCount: 1 },
    ])

    try {
      const result = await getWrongAnswersByType(db, 'single')
      expect(result).toHaveLength(2)
    } finally {
      db.close()
    }
  })

  it('category 为具体分类时只返回该分类错题', async () => {
    const db = await openDB()
    await seedWrongAnswers(db, [
      { questionId: 1, type: 'single', category: '综合管理', wrongCount: 2 },
      { questionId: 2, type: 'single', category: '综合管理', wrongCount: 1 },
      { questionId: 3, type: 'single', category: '政治理论', wrongCount: 3 },
      { questionId: 4, type: 'single', category: '税务公共知识', wrongCount: 1 },
    ])

    try {
      const result = await getWrongAnswersByType(db, 'single', '综合管理')
      expect(result).toHaveLength(2)
      expect(result.every(w => w.category === '综合管理')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('跨题型 + category 过滤同时生效', async () => {
    const db = await openDB()
    await seedWrongAnswers(db, [
      { questionId: 1, type: 'single', category: '综合管理', wrongCount: 1 },
      { questionId: 2, type: 'multi', category: '综合管理', wrongCount: 1 },
      { questionId: 3, type: 'tf', category: '综合管理', wrongCount: 1 },
      { questionId: 4, type: 'multi', category: '政治理论', wrongCount: 1 },
    ])

    try {
      const result = await getWrongAnswersByType(db, 'multi', '综合管理')
      expect(result).toHaveLength(1)
      expect(result[0].questionId).toBe(2)
      expect(result[0].category).toBe('综合管理')
    } finally {
      db.close()
    }
  })

  it('无匹配时返回空数组', async () => {
    const db = await openDB()
    await seedWrongAnswers(db, [
      { questionId: 1, type: 'single', category: '综合管理', wrongCount: 1 },
    ])

    try {
      const result = await getWrongAnswersByType(db, 'single', '政治理论')
      expect(result).toHaveLength(0)
    } finally {
      db.close()
    }
  })
})

// ─── upsertWrongAnswers 携带 category ─────────────────────

describe('upsertWrongAnswers — category 保存', () => {
  it('写入新错题时保存 category', async () => {
    const db = await openDB()

    try {
      await upsertWrongAnswers(db, [
        { questionId: 1, type: 'single', category: '综合管理' },
      ])

      const all = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('wrongAnswers', 'readonly')
        const req = tx.objectStore('wrongAnswers').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      expect(all).toHaveLength(1)
      expect(all[0].questionId).toBe(1)
      expect(all[0].category).toBe('综合管理')
      expect(all[0].wrongCount).toBe(1)
    } finally {
      db.close()
    }
  })

  it('已有错题增加 wrongCount 时保留 category', async () => {
    const db = await openDB()

    // 先写入一条已有错题
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('wrongAnswers', 'readwrite')
      tx.objectStore('wrongAnswers').put({ questionId: 1, type: 'single', category: '综合管理', wrongCount: 1 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    try {
      await upsertWrongAnswers(db, [
        { questionId: 1, type: 'single', category: '综合管理' },
      ])

      const all = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('wrongAnswers', 'readonly')
        const req = tx.objectStore('wrongAnswers').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      expect(all).toHaveLength(1)
      expect(all[0].wrongCount).toBe(2)
      expect(all[0].category).toBe('综合管理')
    } finally {
      db.close()
    }
  })

  it('每道错题独立保存各自的 category', async () => {
    const db = await openDB()

    try {
      await upsertWrongAnswers(db, [
        { questionId: 1, type: 'single', category: '综合管理' },
        { questionId: 2, type: 'single', category: '政治理论' },
        { questionId: 3, type: 'multi', category: '综合管理' },
      ])

      const all = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction('wrongAnswers', 'readonly')
        const req = tx.objectStore('wrongAnswers').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })

      expect(all).toHaveLength(3)
      const byId = (id: number) => all.find((w: any) => w.questionId === id)
      expect(byId(1).category).toBe('综合管理')
      expect(byId(2).category).toBe('政治理论')
      expect(byId(3).category).toBe('综合管理')
    } finally {
      db.close()
    }
  })
})
