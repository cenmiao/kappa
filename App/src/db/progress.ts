// 顺序练习进度持久化
const PROGRESS_KEY = 'sequential'

/** 保存顺序练习当前进度 */
export async function saveProgress(db: IDBDatabase, index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readwrite')
    const store = tx.objectStore('progress')
    store.put({ key: PROGRESS_KEY, index })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 读取顺序练习上次进度，无记录时返回 null */
export async function getProgress(db: IDBDatabase): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readonly')
    const store = tx.objectStore('progress')
    const req = store.get(PROGRESS_KEY)
    req.onsuccess = () => {
      const result = req.result as { key: string; index: number } | undefined
      resolve(result ? result.index : null)
    }
    req.onerror = () => reject(req.error)
  })
}
