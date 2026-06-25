// Slice 1: 管理面板分类统计 + 前置规则文字测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'

// mock IndexedDB
const mockDB = {} as IDBDatabase

vi.mock('../db', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}))

const mockGetMeta = vi.fn()
vi.mock('../db/progress', () => ({
  getMeta: (...args: unknown[]) => mockGetMeta(...args),
}))

vi.mock('../db/loader', () => ({
  resetQuestionBank: vi.fn(),
  loadQuestions: vi.fn(),
}))

describe('管理面板分类统计', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('打开管理面板时显示分类题目数量', async () => {
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 4200,
      categories: {
        '综合管理': 1050,
        '税务公共知识': 800,
        '政治理论': 600,
        '强基培训': 1750,
      },
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // 点击齿轮按钮打开管理面板
    const gearBtn = screen.getByLabelText('题库管理')
    await userEvent.click(gearBtn)

    // 验证分类统计展示
    expect(screen.getByText('4200 道')).toBeTruthy()
    expect(screen.getByText('综合管理')).toBeTruthy()
    expect(screen.getByText('1050 道')).toBeTruthy()
    expect(screen.getByText('税务公共知识')).toBeTruthy()
    expect(screen.getByText('800 道')).toBeTruthy()
  })

  it('无分类数据时不显示分类统计区域', async () => {
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
      // 无 categories
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const gearBtn = screen.getByLabelText('题库管理')
    await userEvent.click(gearBtn)

    // 题目总数仍然显示
    expect(screen.getByText('100 道')).toBeTruthy()
    // 分类标签不应出现
    expect(screen.queryByText('综合管理')).toBeNull()
  })

  it('题库重置弹窗显示更新后的前置规则', async () => {
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
    })

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // 打开管理面板 → 点击题库重置
    const gearBtn = screen.getByLabelText('题库管理')
    await userEvent.click(gearBtn)

    const resetBtn = screen.getByText('题库重置')
    await userEvent.click(resetBtn)

    // 验证新规则文字
    expect(screen.getByText(/将各分类题库 .docx 文件放入 tiku/)).toBeTruthy()
    expect(screen.getByText(/运行 node scripts\/convert\.js 合并所有文件/)).toBeTruthy()
    // 旧文字不应出现
    expect(screen.queryByText(/两套文件/)).toBeNull()
    expect(screen.queryByText(/有答案版与无答案版/)).toBeNull()
  })
})
