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

export async function getAllAttempts(_db: IDBDatabase): Promise<Attempt[]> {
  // TODO: Slice 5 实现查询所有记录
  return []
}
