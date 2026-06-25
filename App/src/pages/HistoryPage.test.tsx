// Slice 2-4: HistoryPage 组件测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HistoryPage from './HistoryPage'
import type { Attempt } from '../types'

// 模拟 db 模块
const mockDB = {} as IDBDatabase

vi.mock('../db', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}))

vi.mock('../db/attempts', () => ({
  getAllAttempts: vi.fn(),
}))

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode: 'random',
    category: '综合管理',
    score: 80,
    total: 100,
    accuracy: 0.8,
    singleAccuracy: 0.85,
    multiAccuracy: 0.7,
    tfAccuracy: 0.85,
    answers: Array.from({ length: 80 }, (_, i) => ({
      questionId: i + 1,
      userAnswer: 'A',
      isCorrect: i < 64,
      isUncertain: i >= 60 && i < 64,
    })),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
})

// ─── Slice 2: 统计概览 ──────────────────────────────────

describe('HistoryPage — 空状态和统计概览', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('无记录时显示空状态', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('还没有练习记录')).toBeInTheDocument()
    expect(screen.getByText('开始随机练习')).toBeInTheDocument()
  })

  it('有记录时显示统计概览（次数、平均分、最高分、最近分）', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    const attempts = [
      makeAttempt({ date: '2026-01-01T00:00:00.000Z', score: 60 }),
      makeAttempt({ date: '2026-03-15T00:00:00.000Z', score: 90 }),
      makeAttempt({ date: '2026-06-20T00:00:00.000Z', score: 80 }),
    ]
    vi.mocked(getAllAttempts).mockResolvedValue(attempts)

    renderPage()

    expect(await screen.findByTestId('stat-练习次数')).toBeInTheDocument()
    expect(screen.getByTestId('stat-value-练习次数').textContent).toBe('3')
    expect(screen.getByTestId('stat-value-平均分').textContent).toBe('77')
    expect(screen.getByTestId('stat-value-最高分').textContent).toBe('90')
    expect(screen.getByTestId('stat-value-最近分').textContent).toBe('80')
  })

  it('单条记录统计正确', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ date: '2026-06-01T00:00:00.000Z', score: 75 }),
    ])

    renderPage()
    expect(await screen.findByTestId('stat-练习次数')).toBeInTheDocument()
    expect(screen.getByTestId('stat-value-练习次数').textContent).toBe('1')
    expect(screen.getByTestId('stat-value-平均分').textContent).toBe('75')
    expect(screen.getByTestId('stat-value-最高分').textContent).toBe('75')
    expect(screen.getByTestId('stat-value-最近分').textContent).toBe('75')
  })
})

// ─── Slice 3: 记录列表 ──────────────────────────────────

describe('HistoryPage — 记录列表', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('列表行数等于记录数', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ id: 'a1', date: '2026-06-20T00:00:00.000Z', mode: 'random', score: 80, accuracy: 0.8 }),
      makeAttempt({ id: 'a2', date: '2026-06-19T00:00:00.000Z', mode: 'sequential', score: 65, accuracy: 0.65 }),
    ])

    renderPage()

    expect(await screen.findByTestId('attempt-row-a1')).toBeInTheDocument()
    expect(screen.getByTestId('attempt-row-a2')).toBeInTheDocument()
  })

  it('正确率 ≥80% 绿色标签', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ score: 85, accuracy: 0.85 }),
    ])

    renderPage()
    const label = await screen.findByText(/85%/)
    expect(label.className).toMatch(/green|emerald/)
  })

  it('正确率 60-79% 黄色标签', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ score: 65, accuracy: 0.65 }),
    ])

    renderPage()
    const label = await screen.findByText(/65%/)
    expect(label.className).toMatch(/amber/)
  })

  it('正确率 <60% 红色标签', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ score: 40, accuracy: 0.4 }),
    ])

    renderPage()
    const label = await screen.findByText(/40%/)
    expect(label.className).toMatch(/red/)
  })

  it('不同模式显示对应图标', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ id: 'r', mode: 'random', score: 80, accuracy: 0.8 }),
      makeAttempt({ id: 's', mode: 'sequential', score: 70, accuracy: 0.7 }),
      makeAttempt({ id: 'v', mode: 'review', score: 90, accuracy: 0.9 }),
    ])

    renderPage()
    await screen.findByTestId('attempt-row-r')

    expect(screen.getByText('🎯')).toBeInTheDocument()
    expect(screen.getByText('📋')).toBeInTheDocument()
    expect(screen.getByText('📌')).toBeInTheDocument()
  })
})

// ─── Slice 4: 展开详情 ──────────────────────────────────

describe('HistoryPage — 展开详情', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('点击行展开详情，再次点击收起', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ id: 'click-test', score: 80, accuracy: 0.8 }),
    ])

    renderPage()
    const user = userEvent.setup()

    const rowBtn = await screen.findByTestId('attempt-row-click-test')
    await user.click(rowBtn)

    // 展开后应显示答题卡
    expect(await screen.findByText('答题卡')).toBeInTheDocument()

    // 再次点击收起
    await user.click(rowBtn)
    expect(screen.queryByText('答题卡')).not.toBeInTheDocument()
  })

  it('无 answers 数据时显示占位提示', async () => {
    const { getAllAttempts } = await import('../db/attempts')
    vi.mocked(getAllAttempts).mockResolvedValue([
      makeAttempt({ id: 'no-answers', answers: [], score: 50, accuracy: 0.5 }),
    ])

    renderPage()
    const user = userEvent.setup()

    const rowBtn = await screen.findByTestId('attempt-row-no-answers')
    await user.click(rowBtn)

    expect(await screen.findByText('暂无答题详情数据')).toBeInTheDocument()
  })
})
