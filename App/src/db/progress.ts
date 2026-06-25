import type { Meta } from '../types'

// 顺序练习进度持久化
const DEFAULT_PROGRESS_KEY = 'sequential'
const META_KEY = 'meta'

/** 保存顺序练习当前进度 */
export async function saveProgress(db: IDBDatabase, index: number, key: string = DEFAULT_PROGRESS_KEY): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readwrite')
    const store = tx.objectStore('progress')
    store.put({ key, index })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 读取顺序练习上次进度，无记录时返回 null */
export async function getProgress(db: IDBDatabase, key: string = DEFAULT_PROGRESS_KEY): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readonly')
    const store = tx.objectStore('progress')
    const req = store.get(key)
    req.onsuccess = () => {
      const result = req.result as { key: string; index: number } | undefined
      resolve(result ? result.index : null)
    }
    req.onerror = () => reject(req.error)
  })
}

/** 保存题库元信息（导入时间 + 题目总数 + 可选分类统计） */
export async function saveMeta(
  db: IDBDatabase,
  meta: { importTime: string; questionCount: number; categories?: Record<string, number> },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readwrite')
    const store = tx.objectStore('progress')
    store.put({ key: META_KEY, ...meta })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** 读取题库元信息，无记录时返回 null */
export async function getMeta(db: IDBDatabase): Promise<{ importTime: string; questionCount: number; categories?: Record<string, number> } | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readonly')
    const store = tx.objectStore('progress')
    const req = store.get(META_KEY)
    req.onsuccess = () => {
      const result = req.result as Meta | undefined
      if (result) {
        resolve({
          importTime: result.importTime,
          questionCount: result.questionCount,
          categories: result.categories,
        })
      } else {
        resolve(null)
      }
    }
    req.onerror = () => reject(req.error)
  })
}
