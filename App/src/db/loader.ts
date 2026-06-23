// 题库加载状态（模块级单例，避免并发导入）

import { openDB } from './index'
import { seedQuestions, getAllQuestions } from './questions'

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
      const response = await fetch('/questions.json')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const questions = await response.json()
      await seedQuestions(db, questions)
      state = { status: 'ready' }
    } catch (err) {
      state = { status: 'error', message: err instanceof Error ? err.message : String(err) }
    }
  })()

  state = { status: 'loading', promise }
  return promise
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
