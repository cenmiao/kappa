// Slice 1 + Slice 2: 管理面板 + 题库选择器测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import HomePage from './HomePage'

// mock useNavigate / useLocation to capture navigation and control route state
const mockNavigate = vi.fn()
let mockLocationState: unknown = null
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: mockLocationState, pathname: '/', search: '', hash: '', key: '' }),
  }
})

// mock IndexedDB
const mockDB = {} as IDBDatabase

vi.mock('../db', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}))

const mockGetMeta = vi.fn()
vi.mock('../db/progress', () => ({
  getMeta: (...args: unknown[]) => mockGetMeta(...args),
}))

vi.mock('../db/wrongAnswers', () => ({
  getAllWrongAnswers: vi.fn(() => Promise.resolve([])),
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

    // 验证分类统计展示（scope 到管理面板内）
    const adminPanel = screen.getByTestId('admin-panel')
    expect(within(adminPanel).getByText('4200 道')).toBeTruthy()
    expect(within(adminPanel).getByText('综合管理')).toBeTruthy()
    expect(within(adminPanel).getByText('1050 道')).toBeTruthy()
    expect(within(adminPanel).getByText('税务公共知识')).toBeTruthy()
    expect(within(adminPanel).getByText('800 道')).toBeTruthy()
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

    // 题目总数仍然显示（scope 到管理面板内）
    const adminPanel = screen.getByTestId('admin-panel')
    expect(within(adminPanel).getByText('100 道')).toBeTruthy()
    // 分类标签不应出现在管理面板内
    expect(within(adminPanel).queryByText('综合管理')).toBeNull()
  })

  it('题库重置弹窗显示更新后的前置规则', async () => {
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
      categories: undefined,
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

describe('题库分类选择器', () => {
  const CATEGORY_OPTIONS = ['全部', '综合管理', '税务公共知识', '政治理论', '强基培训']

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
      categories: undefined,
    })
  })

  it('渲染下拉框并显示 5 个分类选项，默认选中"全部"', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // 验证下拉框存在
    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    expect(select).toBeTruthy()

    // 验证 5 个选项
    const options = screen.getAllByRole('option') as HTMLOptionElement[]
    expect(options).toHaveLength(5)
    CATEGORY_OPTIONS.forEach((cat, i) => {
      expect(options[i].textContent).toBe(cat)
    })

    // 默认选中"全部"
    expect((select as HTMLSelectElement).value).toBe('全部')
  })

  it('无 localStorage 记录时默认选中"全部"', () => {
    // 确保 localStorage 为空
    expect(localStorage.getItem('kappa-category')).toBeNull()

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    expect((select as HTMLSelectElement).value).toBe('全部')
  })

  it('选择"综合管理"后 localStorage 写入 kappa-category', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    await userEvent.selectOptions(select, '综合管理')

    expect(localStorage.getItem('kappa-category')).toBe('综合管理')
  })

  it('localStorage 有值时恢复上次选择', () => {
    localStorage.setItem('kappa-category', '政治理论')

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    expect((select as HTMLSelectElement).value).toBe('政治理论')
  })
})

describe('卡片描述动态变化', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
      categories: undefined,
    })
  })

  it('选中"全部"时随机练习卡片描述为"全题库随机抽 80 题"', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/全题库随机抽 80 题/)).toBeTruthy()
  })

  it('选择"综合管理"后随机练习卡片描述动态变化', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    await userEvent.selectOptions(select, '综合管理')

    expect(screen.getByText(/综合管理 随机抽 80 题/)).toBeTruthy()
  })

  it('选择"税务公共知识"后顺序练习卡片描述动态变化', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    await userEvent.selectOptions(select, '税务公共知识')

    expect(screen.getByText(/税务公共知识 按编号顺序答题/)).toBeTruthy()
  })
})

describe('导航 URL 携带 category 参数', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
      categories: undefined,
    })
  })

  it('点击随机练习 → URL 含 mode=random&category=综合管理', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // 先选择"综合管理"
    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    await userEvent.selectOptions(select, '综合管理')

    // 点击随机练习
    const randomBtn = screen.getByText('随机练习')
    await userEvent.click(randomBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=random&category=综合管理')
  })

  it('点击顺序练习 → URL 含 mode=sequential&category=综合管理', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    await userEvent.selectOptions(select, '综合管理')

    const sequentialBtn = screen.getByText('顺序练习')
    await userEvent.click(sequentialBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/quiz?mode=sequential&category=综合管理')
  })

  it('点击历史记录 → URL 含 category=综合管理', async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const select = screen.getByRole('combobox', { name: '题库分类选择' })
    await userEvent.selectOptions(select, '综合管理')

    const historyBtn = screen.getByText('历史记录')
    await userEvent.click(historyBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/history?category=综合管理')
  })
})

describe('Toast 缺参提示', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    localStorage.clear()
    mockLocationState = null
    vi.useFakeTimers()
    mockGetMeta.mockResolvedValue({
      importTime: '2026-06-25T00:00:00.000Z',
      questionCount: 100,
      categories: undefined,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('收到 missingCategory 路由状态后显示 Toast "请先选择题库"', () => {
    mockLocationState = { missingCategory: true }

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/请先选择题库/)).toBeTruthy()
  })

  it('3 秒后 Toast 自动消失', () => {
    mockLocationState = { missingCategory: true }

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    // Toast 应出现
    expect(screen.getByText(/请先选择题库/)).toBeTruthy()

    // 前进 3 秒（需要 act 以触发 React 状态更新）
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Toast 应消失
    expect(screen.queryByText(/请先选择题库/)).toBeNull()
  })

  it('无 missingCategory 状态时不显示 Toast', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/请先选择题库/)).toBeNull()
  })
})
