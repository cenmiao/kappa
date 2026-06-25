// IndexedDB 初始化与版本管理

const DB_NAME = 'kappa-db'
const DB_VERSION = 4

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('questions')) {
        db.createObjectStore('questions', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('attempts')) {
        const attemptStore = db.createObjectStore('attempts', { keyPath: 'id' })
        attemptStore.createIndex('category', 'category', { unique: false })
      } else {
        // v3→v4 升级：已有 attempts store，补充 category 索引
        const attemptStore = request.transaction!.objectStore('attempts')
        if (!attemptStore.indexNames.contains('category')) {
          attemptStore.createIndex('category', 'category', { unique: false })
        }
        // 清空旧数据（缺少 category 字段会导致筛选遗漏）
        attemptStore.clear()
      }
      if (!db.objectStoreNames.contains('wrongAnswers')) {
        const wrongStore = db.createObjectStore('wrongAnswers', { keyPath: 'questionId' })
        wrongStore.createIndex('category', 'category', { unique: false })
      } else {
        // v3→v4 升级：已有 wrongAnswers store，补充 category 索引
        const wrongStore = request.transaction!.objectStore('wrongAnswers')
        if (!wrongStore.indexNames.contains('category')) {
          wrongStore.createIndex('category', 'category', { unique: false })
        }
        // 清空旧数据（缺少 category 字段会导致筛选遗漏）
        wrongStore.clear()
      }
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
