// 错题池表 CRUD

import type { WrongAnswer, QuestionType } from '../types'

/** 读取全部错题 */
export async function getAllWrongAnswers(db: IDBDatabase): Promise<WrongAnswer[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongAnswers', 'readonly')
    const store = tx.objectStore('wrongAnswers')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result as WrongAnswer[])
    req.onerror = () => reject(req.error)
  })
}

/** 按题型读取错题，可选按分类过滤 */
export async function getWrongAnswersByType(
  db: IDBDatabase,
  type: QuestionType,
  category?: string,
): Promise<WrongAnswer[]> {
  const all = await getAllWrongAnswers(db)
  const byType = all.filter((w) => w.type === type)
  if (!category || category === '全部') {
    return byType
  }
  return byType.filter((w) => w.category === category)
}

/** 按 questionId[] 批量读取错题 */
export async function getWrongAnswersByIds(
  db: IDBDatabase,
  ids: number[],
): Promise<WrongAnswer[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongAnswers', 'readonly')
    const store = tx.objectStore('wrongAnswers')
    const results: WrongAnswer[] = []
    let count = 0

    if (ids.length === 0) {
      resolve([])
      return
    }

    for (const id of ids) {
      const req = store.get(id)
      req.onsuccess = () => {
        if (req.result) results.push(req.result as WrongAnswer)
        count++
        if (count === ids.length) resolve(results)
      }
      req.onerror = () => reject(req.error)
    }
  })
}

/** 录入/更新错题。若已存在则 wrongCount+1 */
export async function upsertWrongAnswers(
  db: IDBDatabase,
  items: { questionId: number; type: QuestionType; category: string }[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongAnswers', 'readwrite')
    const store = tx.objectStore('wrongAnswers')

    let pending = items.length
    if (pending === 0) { resolve(); return }

    for (const item of items) {
      const getReq = store.get(item.questionId)
      getReq.onsuccess = () => {
        const existing = getReq.result as WrongAnswer | undefined
        if (existing) {
          store.put({ ...existing, wrongCount: existing.wrongCount + 1 })
        } else {
          store.put({ questionId: item.questionId, type: item.type, category: item.category, wrongCount: 1 })
        }
        pending--
        if (pending === 0) resolve()
      }
      getReq.onerror = () => reject(getReq.error)
    }
  })
}

/** 删除指定错题（用于调试/手动管理，当前 Slice 不暴露 UI） */
export async function deleteWrongAnswer(db: IDBDatabase, questionId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wrongAnswers', 'readwrite')
    const store = tx.objectStore('wrongAnswers')
    const req = store.delete(questionId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
