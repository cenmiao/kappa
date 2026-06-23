// IndexedDB 初始化与版本管理
// Slice 2+ 实现具体逻辑

const DB_NAME = 'kappa-db'
const DB_VERSION = 2

export async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('questions')) {
        db.createObjectStore('questions', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('attempts')) {
        db.createObjectStore('attempts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('wrongAnswers')) {
        db.createObjectStore('wrongAnswers', { keyPath: 'questionId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
