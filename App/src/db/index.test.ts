// DB schema 测试：v4 包含 category 索引 + v3→v4 升级迁移
import { describe, it, expect, afterEach } from 'vitest'
import { openDB } from './index'

const DB_NAME = 'kappa-db'

/** 关闭 DB 并删除，确保每个 test 从干净状态开始 */
async function cleanup() {
  // fake-indexeddb 内部记录；用 deleteDatabase 清理
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve() // 即使失败也继续（可能 DB 不存在）
    setTimeout(() => resolve(), 500) // 兜底超时
  })
}

describe('DB schema — 新创建 v4', () => {
  // 每个测试后关闭连接
  afterEach(cleanup)

  it('v4 包含 progress 表', async () => {
    const db = await openDB()
    try {
      expect(db.objectStoreNames.contains('progress')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('v4 包含 4 个 store：questions, attempts, wrongAnswers, progress', async () => {
    const db = await openDB()
    try {
      const names = Array.from(db.objectStoreNames)
      expect(names).toHaveLength(4)
      expect(names).toContain('questions')
      expect(names).toContain('attempts')
      expect(names).toContain('wrongAnswers')
      expect(names).toContain('progress')
    } finally {
      db.close()
    }
  })

  it('v4 wrongAnswers store 有 category 索引', async () => {
    const db = await openDB()
    try {
      const tx = db.transaction('wrongAnswers', 'readonly')
      const store = tx.objectStore('wrongAnswers')
      expect(store.indexNames.contains('category')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('v4 attempts store 有 category 索引', async () => {
    const db = await openDB()
    try {
      const tx = db.transaction('attempts', 'readonly')
      const store = tx.objectStore('attempts')
      expect(store.indexNames.contains('category')).toBe(true)
    } finally {
      db.close()
    }
  })

  it('v4 questions store 无 category 索引（不需要按 category 查 questions）', async () => {
    const db = await openDB()
    try {
      const tx = db.transaction('questions', 'readonly')
      const store = tx.objectStore('questions')
      expect(store.indexNames.contains('category')).toBe(false)
    } finally {
      db.close()
    }
  })
})

describe('DB 升级 — v3→v4 迁移', () => {
  afterEach(cleanup)

  async function createV3DB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 3)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('questions')) {
          db.createObjectStore('questions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('attempts')) {
          db.createObjectStore('attempts', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('wrongAnswers')) {
          db.createObjectStore('wrongAnswers', { keyPath: 'questionId' })
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'key' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  it('升级后旧 wrongAnswers 数据被清空', async () => {
    const v3db = await createV3DB()
    await new Promise<void>((resolve, reject) => {
      const tx = v3db.transaction('wrongAnswers', 'readwrite')
      tx.objectStore('wrongAnswers').put({ questionId: 1, type: 'single', wrongCount: 3 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    v3db.close()

    const v4db = await openDB()
    try {
      const wrongAnswers = await new Promise<any[]>((resolve, reject) => {
        const tx = v4db.transaction('wrongAnswers', 'readonly')
        const req = tx.objectStore('wrongAnswers').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      expect(wrongAnswers).toHaveLength(0)
    } finally {
      v4db.close()
    }
  })

  it('升级后旧 attempts 数据被清空', async () => {
    const v3db = await createV3DB()
    await new Promise<void>((resolve, reject) => {
      const tx = v3db.transaction('attempts', 'readwrite')
      tx.objectStore('attempts').put({ id: 'old-1', date: '2025-01-01', mode: 'random', score: 50, total: 100 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    v3db.close()

    const v4db = await openDB()
    try {
      const attempts = await new Promise<any[]>((resolve, reject) => {
        const tx = v4db.transaction('attempts', 'readonly')
        const req = tx.objectStore('attempts').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      expect(attempts).toHaveLength(0)
    } finally {
      v4db.close()
    }
  })

  it('升级后 questions 和 progress 数据保留', async () => {
    const v3db = await createV3DB()
    await new Promise<void>((resolve, reject) => {
      const tx = v3db.transaction('questions', 'readwrite')
      tx.objectStore('questions').put({ id: 1, type: 'single', stem: '保留题', options: ['A', 'B'], answer: 'A', explanation: '' })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = v3db.transaction('progress', 'readwrite')
      tx.objectStore('progress').put({ key: 'meta', importTime: '2025-01-01', questionCount: 4000 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    v3db.close()

    const v4db = await openDB()
    try {
      const questions = await new Promise<any[]>((resolve, reject) => {
        const tx = v4db.transaction('questions', 'readonly')
        const req = tx.objectStore('questions').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      expect(questions).toHaveLength(1)
      expect(questions[0].stem).toBe('保留题')

      const progress = await new Promise<any[]>((resolve, reject) => {
        const tx = v4db.transaction('progress', 'readonly')
        const req = tx.objectStore('progress').getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      expect(progress).toHaveLength(1)
      expect(progress[0].key).toBe('meta')
    } finally {
      v4db.close()
    }
  })

  it('升级后 wrongAnswers 和 attempts 有 category 索引', async () => {
    const v3db = await createV3DB()
    v3db.close()

    const v4db = await openDB()
    try {
      const wrongTx = v4db.transaction('wrongAnswers', 'readonly')
      expect(wrongTx.objectStore('wrongAnswers').indexNames.contains('category')).toBe(true)

      const attemptTx = v4db.transaction('attempts', 'readonly')
      expect(attemptTx.objectStore('attempts').indexNames.contains('category')).toBe(true)
    } finally {
      v4db.close()
    }
  })
})
