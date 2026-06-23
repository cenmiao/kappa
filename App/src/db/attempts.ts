// 练习记录表 CRUD
// Slice 3+ 实现具体逻辑（saveAttempt）+ Slice 5+（getAllAttempts）

import type { Attempt } from '../types'

export async function saveAttempt(_db: IDBDatabase, _attempt: Attempt): Promise<void> {
  // TODO: Slice 3 实现保存练习记录
}

export async function getAllAttempts(_db: IDBDatabase): Promise<Attempt[]> {
  // TODO: Slice 5 实现查询所有记录
  return []
}
