// Slice 5: 顺序练习进度 CRUD 测试
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

describe('saveProgress / getProgress', () => {
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
