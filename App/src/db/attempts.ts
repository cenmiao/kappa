// 练习记录表 CRUD
// saveAttempt — Slice 3 实现 / getAllAttempts — Slice 5 实现

import type { Attempt } from '../types'

/** 保存一次练习记录到 IndexedDB */
export async function saveAttempt(db: IDBDatabase, attempt: Attempt): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('attempts', 'readwrite')
    const store = tx.objectStore('attempts')
    store.put(attempt)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAllAttempts(db: IDBDatabase): Promise<Attempt[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('attempts', 'readonly')
    const store = tx.objectStore('attempts')
    const req = store.getAll()
    req.onsuccess = () => {
      const results = req.result as Attempt[]
      results.sort((a, b) => b.date.localeCompare(a.date))
      resolve(results)
    }
    req.onerror = () => reject(req.error)
  })
}
