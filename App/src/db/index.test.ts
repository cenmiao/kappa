// Slice 5: DB schema 升级测试
import { describe, it, expect } from 'vitest'
import { openDB } from './index'

describe('DB schema', () => {
  it('v3 包含 progress 表', async () => {
    const db = await openDB()
    expect(db.objectStoreNames.contains('progress')).toBe(true)
  })
})
