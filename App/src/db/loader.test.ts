// loader 模块测试：meta 读写 + 题库重置
import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { getMeta, saveMeta, saveProgress, getProgress } from './progress'

function uniqueDBName() {
  return `test-loader-${crypto.randomUUID()}`
}

describe('getMeta / saveMeta', () => {
  let db: IDBDatabase

  beforeEach(async () => {
    // 使用独立 DB，避免跨 test DB 名冲突
    const name = uniqueDBName()
    db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('questions', { keyPath: 'id' })
        req.result.createObjectStore('attempts', { keyPath: 'id' })
        req.result.createObjectStore('wrongAnswers', { keyPath: 'questionId' })
        req.result.createObjectStore('progress', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  })

  it('无 meta 记录时 getMeta 返回 null', async () => {
    const meta = await getMeta(db)
    expect(meta).toBeNull()
  })

  it('saveMeta 后 getMeta 返回保存的值', async () => {
    const now = new Date().toISOString()
    await saveMeta(db, { importTime: now, questionCount: 4000 })
    const meta = await getMeta(db)
    expect(meta).toEqual({ importTime: now, questionCount: 4000 })
  })

  it('多次 saveMeta 覆盖旧值', async () => {
    const first = new Date('2025-01-01').toISOString()
    const second = new Date('2025-06-01').toISOString()
    await saveMeta(db, { importTime: first, questionCount: 100 })
    await saveMeta(db, { importTime: second, questionCount: 200 })
    const meta = await getMeta(db)
    expect(meta).toEqual({ importTime: second, questionCount: 200 })
  })
})

// seedQuestions 后写入 meta 的行为验证
describe('seedQuestions 写入 meta', () => {
  it('导入题目后 saveMeta 记录题目数和导入时间', async () => {
    const name = uniqueDBName()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('questions', { keyPath: 'id' })
        req.result.createObjectStore('attempts', { keyPath: 'id' })
        req.result.createObjectStore('wrongAnswers', { keyPath: 'questionId' })
        req.result.createObjectStore('progress', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    const { seedQuestions } = await import('./questions')

    const questions = [
      { id: 1, type: 'single' as const, category: '综合管理', stem: '题1', options: ['A', 'B'], answer: 'A', explanation: '' },
      { id: 2, type: 'multi' as const, category: '综合管理', stem: '题2', options: ['A', 'B', 'C'], answer: 'A,B', explanation: '' },
      { id: 3, type: 'tf' as const, category: '综合管理', stem: '题3', options: ['A.正确', 'B.错误'], answer: 'A', explanation: '' },
    ]

    // 模拟 loadQuestions 的行为：seed → saveMeta
    const { seeded, count } = await seedQuestions(db, questions)
    expect(seeded).toBe(true)
    expect(count).toBe(3)

    const before = new Date().toISOString()
    await saveMeta(db, { importTime: before, questionCount: count })

    const meta = await getMeta(db)
    expect(meta).not.toBeNull()
    expect(meta!.questionCount).toBe(3)
    expect(meta!.importTime).toBe(before)
  })

  it('题库已有数据时 seedQuestions 不覆盖（幂等）', async () => {
    const name = uniqueDBName()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('questions', { keyPath: 'id' })
        req.result.createObjectStore('progress', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    const { seedQuestions } = await import('./questions')

    const first = [{ id: 1, type: 'single' as const, category: '综合管理', stem: '题1', options: ['A', 'B'], answer: 'A', explanation: '' }]
    const second = [{ id: 999, type: 'tf' as const, category: '综合管理', stem: '新题', options: ['A', 'B'], answer: 'B', explanation: '' }]

    const r1 = await seedQuestions(db, first)
    expect(r1.seeded).toBe(true)
    expect(r1.count).toBe(1)

    // 第二次导入应跳过（幂等）
    const r2 = await seedQuestions(db, second)
    expect(r2.seeded).toBe(false)
    expect(r2.count).toBe(1) // 仍然是 1 条，不是 2 条
  })
})

// 题库重置
describe('resetQuestionBank', () => {
  it('清空 questions 和 wrongAnswers，保留 attempts 和 progress', async () => {
    const name = uniqueDBName()
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('questions', { keyPath: 'id' })
        req.result.createObjectStore('attempts', { keyPath: 'id' })
        req.result.createObjectStore('wrongAnswers', { keyPath: 'questionId' })
        req.result.createObjectStore('progress', { keyPath: 'key' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    const { seedQuestions } = await import('./questions')
    const { resetQuestionBank } = await import('./loader')

    // 预先写入数据
    await seedQuestions(db, [
      { id: 1, type: 'single' as const, category: '综合管理', stem: '题1', options: ['A', 'B'], answer: 'A', explanation: '' },
    ])

    // 写入 attempts
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('attempts', 'readwrite')
      const store = tx.objectStore('attempts')
      store.put({ id: 'attempt-1', date: new Date().toISOString(), mode: 'random', category: '综合管理', score: 50, total: 100 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // 写入 wrongAnswers
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('wrongAnswers', 'readwrite')
      const store = tx.objectStore('wrongAnswers')
      store.put({ questionId: 1, type: 'single', category: '综合管理', wrongCount: 2 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    // 写入 progress（顺序练习进度 + meta）
    await saveProgress(db, 10)
    await saveMeta(db, { importTime: new Date().toISOString(), questionCount: 1 })

    // 执行重置（不触发 fetch，只测试清空逻辑）
    await resetQuestionBank(db)

    // 验证 questions 和 wrongAnswers 已清空
    const { getAllQuestions } = await import('./questions')
    const questionsAfter = await getAllQuestions(db)
    expect(questionsAfter.length).toBe(0)

    const { getAllWrongAnswers } = await import('./wrongAnswers')
    const wrongAfter = await getAllWrongAnswers(db)
    expect(wrongAfter.length).toBe(0)

    // 验证 attempts 保留
    const { getAllAttempts } = await import('./attempts')
    const attemptsAfter = await getAllAttempts(db)
    expect(attemptsAfter.length).toBe(1)
    expect(attemptsAfter[0].id).toBe('attempt-1')

    // 验证 progress 保留（顺序进度）
    const progressAfter = await getProgress(db)
    expect(progressAfter).toBe(10)
  })
})
