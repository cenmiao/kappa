// 题库加载状态（模块级单例，避免并发导入）

import { openDB } from './index'
import { seedQuestions, getAllQuestions } from './questions'
import { saveMeta } from './progress'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; promise: Promise<void> }
  | { status: 'ready' }
  | { status: 'error'; message: string }

let state: LoadState = { status: 'idle' }

/** 获取当前加载状态 */
export function getLoadState(): LoadState['status'] {
  return state.status
}

/** 获取错误信息 */
export function getLoadError(): string | null {
  return state.status === 'error' ? state.message : null
}

/** 启动题库导入（幂等 — 已导入或正在导入则跳过） */
export async function loadQuestions(): Promise<void> {
  if (state.status === 'ready') return
  if (state.status === 'loading') return state.promise

  const promise = (async () => {
    try {
      const db = await openDB()
      const response = await fetch(`${import.meta.env.BASE_URL}questions.json`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const questions = await response.json()
      const { count } = await seedQuestions(db, questions)
      // 写入 meta（导入时间 + 题目总数）
      if (count > 0) {
        await saveMeta(db, { importTime: new Date().toISOString(), questionCount: count })
      }
      state = { status: 'ready' }
    } catch (err) {
      state = { status: 'error', message: err instanceof Error ? err.message : String(err) }
    }
  })()

  state = { status: 'loading', promise }
  return promise
}

/** 重置题库：清空 questions + wrongAnswers，重置加载状态。保留 attempts + progress。调用后需手动 loadQuestions() */
export async function resetQuestionBank(db: IDBDatabase): Promise<void> {
  // 清空 questions 表
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('questions', 'readwrite')
    const store = tx.objectStore('questions')
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })

  // 清空 wrongAnswers 表
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('wrongAnswers', 'readwrite')
    const store = tx.objectStore('wrongAnswers')
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })

  // 重置加载状态，让使用者可以重新 loadQuestions()
  state = { status: 'idle' }
}

/** 检查题库是否已在 IndexedDB 中可用 */
export async function isQuestionBankReady(): Promise<boolean> {
  try {
    const db = await openDB()
    const questions = await getAllQuestions(db)
    return questions.length > 0
  } catch {
    return false
  }
}
