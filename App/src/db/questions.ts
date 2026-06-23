// 题库表 CRUD
// Slice 2+ 实现具体逻辑

import type { Question } from '../types'

export async function seedQuestions(_db: IDBDatabase, _questions: Question[]): Promise<void> {
  // TODO: Slice 2 实现批量导入
}

export async function getAllQuestions(_db: IDBDatabase): Promise<Question[]> {
  // TODO: Slice 2 实现全量查询
  return []
}

export async function getQuestionsByType(
  _db: IDBDatabase,
  _type: Question['type'],
): Promise<Question[]> {
  // TODO: Slice 2 实现按题型查询
  return []
}
