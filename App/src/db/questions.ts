// 题库表 CRUD

import type { Question, QuestionType } from '../types'

/** 批量导入题库。若 store 已有数据则跳过。 */
export async function seedQuestions(db: IDBDatabase, questions: Question[]): Promise<{ seeded: boolean; count: number }> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readwrite')
    const store = tx.objectStore('questions')

    // 先检查是否已有数据
    const countReq = store.count()
    countReq.onsuccess = () => {
      if (countReq.result > 0) {
        resolve({ seeded: false, count: countReq.result })
        return
      }

      // 批量写入
      let written = 0
      for (const q of questions) {
        store.put(q)
        written++
      }

      tx.oncomplete = () => resolve({ seeded: true, count: written })
      tx.onerror = () => reject(tx.error)
    }
    countReq.onerror = () => reject(countReq.error)
  })
}

/** 查询全部题目 */
export async function getAllQuestions(db: IDBDatabase): Promise<Question[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readonly')
    const store = tx.objectStore('questions')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as Question[])
    req.onerror = () => reject(req.error)
  })
}

/** 按题型筛选 */
export async function getQuestionsByType(
  db: IDBDatabase,
  type: QuestionType,
): Promise<Question[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readonly')
    const store = tx.objectStore('questions')
    const req = store.getAll()
    req.onsuccess = () => {
      const all = req.result as Question[]
      resolve(all.filter(q => q.type === type))
    }
    req.onerror = () => reject(req.error)
  })
}

/** 按 ID 查询单道题 */
export async function getQuestionById(
  db: IDBDatabase,
  id: number,
): Promise<Question | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('questions', 'readonly')
    const store = tx.objectStore('questions')
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result as Question | undefined)
    req.onerror = () => reject(req.error)
  })
}

/** 从指定题型中随机抽取指定数量（不重复） */
export async function getRandomQuestions(
  db: IDBDatabase,
  type: QuestionType,
  count: number,
): Promise<Question[]> {
  const all = await getQuestionsByType(db, type)
  // Fisher-Yates 洗牌后取前 count 条
  const shuffled = [...all]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}
