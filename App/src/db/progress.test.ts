// 顺序练习进度 CRUD 测试 — 含参数化 key
import { describe, it, expect } from 'vitest'
import { saveProgress, getProgress } from './progress'

function openProgressDB(): Promise<IDBDatabase> {
  const name = `test-progress-${crypto.randomUUID()}`
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('progress', { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

describe('saveProgress / getProgress — 默认 key（向下兼容）', () => {
  it('无进度时 getProgress 返回 null', async () => {
    const db = await openProgressDB()
    const result = await getProgress(db)
    expect(result).toBeNull()
  })

  it('saveProgress 后 getProgress 返回保存的值', async () => {
    const db = await openProgressDB()
    await saveProgress(db, 42)
    const result = await getProgress(db)
    expect(result).toBe(42)
  })

  it('多次 saveProgress 覆盖旧值', async () => {
    const db = await openProgressDB()
    await saveProgress(db, 10)
    await saveProgress(db, 25)
    const result = await getProgress(db)
    expect(result).toBe(25)
  })

  it('保存 0 也正确返回', async () => {
    const db = await openProgressDB()
    await saveProgress(db, 0)
    const result = await getProgress(db)
    expect(result).toBe(0)
  })
})

describe('saveProgress / getProgress — 参数化 key', () => {
  it('不同 key 的进度相互独立', async () => {
    const db = await openProgressDB()
    await saveProgress(db, 10, 'sequential:综合管理')
    await saveProgress(db, 20, 'sequential:税务公共知识')

    const resultA = await getProgress(db, 'sequential:综合管理')
    const resultB = await getProgress(db, 'sequential:税务公共知识')

    expect(resultA).toBe(10)
    expect(resultB).toBe(20)
  })

  it('自定义 key 无记录时返回 null', async () => {
    const db = await openProgressDB()
    const result = await getProgress(db, 'sequential:综合管理')
    expect(result).toBeNull()
  })

  it('同 key 多次保存覆盖旧值', async () => {
    const db = await openProgressDB()
    await saveProgress(db, 5, 'sequential:综合管理')
    await saveProgress(db, 15, 'sequential:综合管理')

    const result = await getProgress(db, 'sequential:综合管理')
    expect(result).toBe(15)
  })

  it('默认 key 和自定义 key 相互独立', async () => {
    const db = await openProgressDB()
    await saveProgress(db, 99)                          // 默认 key "sequential"
    await saveProgress(db, 42, 'sequential:综合管理')  // 自定义 key

    const defaultResult = await getProgress(db)
    const customResult = await getProgress(db, 'sequential:综合管理')

    expect(defaultResult).toBe(99)
    expect(customResult).toBe(42)
  })
})
