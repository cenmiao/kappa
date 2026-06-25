// 优化 1+2+3: QuizPage 组件测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import QuizPage from './QuizPage'
import type { Question } from '../types'

// 可观察的 mock
const mockToggleUncertain = vi.fn()
const mockSelectOption = vi.fn()
const mockGoNext = vi.fn()
const mockGoPrev = vi.fn()
const mockGoTo = vi.fn()
const mockInitQuiz = vi.fn()

function createMockQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    type: 'single',
    category: '综合管理',
    stem: '这是一道测试题目？',
    options: ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
    answer: 'A',
    explanation: '解析内容',
    ...overrides,
  }
}

function mockQuizState(overrides: Record<string, unknown> = {}) {
  return {
    questions: [createMockQuestion()],
    currentIndex: 0,
    answers: {},
    isSubmitted: false,
    currentAnswer: '',
    totalQuestions: 1,
    answeredCount: 0,
    startIndex: 0,
    initQuiz: mockInitQuiz,
    initWithQuestions: vi.fn(),
    selectOption: mockSelectOption,
    toggleUncertain: mockToggleUncertain,
    goNext: mockGoNext,
    goPrev: mockGoPrev,
    goTo: mockGoTo,
    submit: vi.fn(),
    hasCurrentAnswer: false,
    isCurrentUncertain: false,
    ...overrides,
  }
}

let currentMockState = mockQuizState()

vi.mock('../hooks/useQuizState', () => ({
  default: vi.fn(() => currentMockState),
}))

vi.mock('../hooks/useBeforeUnload', () => ({
  useBeforeUnload: vi.fn(),
}))

const mockNav = vi.fn()
let currentSearchParams = new URLSearchParams('mode=random&category=综合管理')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNav,
    useSearchParams: () => [currentSearchParams, vi.fn()],
    useLocation: () => ({ state: null }),
  }
})

let mockLoadState: string = 'ready'
let mockIsReady = true

vi.mock('../db/loader', () => ({
  getLoadState: () => mockLoadState,
  getLoadError: () => null,
  loadQuestions: vi.fn(),
  isQuestionBankReady: () => Promise.resolve(mockIsReady),
}))

vi.mock('../db', () => ({
  openDB: () => Promise.resolve({} as IDBDatabase),
}))

vi.mock('../db/attempts', () => ({
  saveAttempt: vi.fn(),
}))

vi.mock('../db/wrongAnswers', () => ({
  upsertWrongAnswers: vi.fn(),
}))

vi.mock('../db/progress', () => ({
  saveProgress: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <QuizPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  currentMockState = mockQuizState()
  mockLoadState = 'ready'
  mockIsReady = true
  currentSearchParams = new URLSearchParams('mode=random&category=综合管理')
})

afterEach(() => {
  cleanup()
})

// ─── 优化 1: 不确定标记按钮 ────────────────────────────────

describe('QuizPage — 不确定标记按钮', () => {
  it('标记按钮存在于答题页中', async () => {
    renderPage()
    expect(await screen.findByText('这是一道测试题目？')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /标记/ })).toBeInTheDocument()
  })

  it('点击标记按钮触发 toggleUncertain，不触发 selectOption', async () => {
    renderPage()
    await screen.findByText('这是一道测试题目？')

    const markBtn = screen.getByRole('button', { name: /标记/ })
    fireEvent.click(markBtn)

    expect(mockToggleUncertain).toHaveBeenCalledTimes(1)
    expect(mockSelectOption).not.toHaveBeenCalled()
  })

  it('已标记时按钮显示取消标记文本', async () => {
    currentMockState = mockQuizState({ isCurrentUncertain: true, currentAnswer: 'A', hasCurrentAnswer: true })
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /取消标记/ })).toBeInTheDocument()
    })
  })
})

// ─── 优化 2: 返回首页按钮 ──────────────────────────────────

describe('QuizPage — 返回首页按钮', () => {
  it('答题态顶部栏有返回首页按钮', async () => {
    renderPage()
    await screen.findByText('这是一道测试题目？')
    expect(screen.getByText('← 首页')).toBeInTheDocument()
  })

  it('点击返回首页弹出确认弹窗', async () => {
    renderPage()
    await screen.findByText('这是一道测试题目？')

    await act(async () => {
      fireEvent.click(screen.getByText('← 首页'))
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(await screen.findByText('确认返回首页')).toBeInTheDocument()
    expect(screen.getByText(/当前答题进度不会保存/)).toBeInTheDocument()
  })

  it('取消返回：弹窗关闭，留在答题页', async () => {
    renderPage()
    await screen.findByText('这是一道测试题目？')

    await act(async () => {
      fireEvent.click(screen.getByText('← 首页'))
      await new Promise((r) => setTimeout(r, 0))
    })

    await screen.findByText('确认返回首页')

    await act(async () => {
      fireEvent.click(screen.getByText('继续答题'))
      await new Promise((r) => setTimeout(r, 0))
    })

    await waitFor(() => {
      expect(screen.queryByText('确认返回首页')).not.toBeInTheDocument()
    })
    expect(screen.getByText('这是一道测试题目？')).toBeInTheDocument()
  })

  it('确认返回：跳转到 /', async () => {
    renderPage()

    // 等待页面加载完成
    await screen.findByText('这是一道测试题目？')

    const backBtn = screen.getByText('← 首页')

    // 点击打开弹窗
    await act(async () => {
      fireEvent.click(backBtn)
      await new Promise((r) => setTimeout(r, 0))
    })

    const confirmHeading = await screen.findByText('确认返回首页')
    expect(confirmHeading).toBeInTheDocument()

    // 点击确认返回
    await act(async () => {
      fireEvent.click(screen.getByText('确认返回'))
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(mockNav).toHaveBeenCalledWith('/')
  })

  it('显示已答题数', async () => {
    currentMockState = mockQuizState({ answeredCount: 42, totalQuestions: 80 })
    renderPage()

    await screen.findByText('这是一道测试题目？')

    await act(async () => {
      fireEvent.click(screen.getByText('← 首页'))
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(await screen.findByText(/已答 42\/80 题/)).toBeInTheDocument()
  })
})

// ─── 优化 2 补充: loading / error 态返回 ──────────────────

describe('QuizPage — loading/error 态返回首页', () => {
  it('loading 态显示返回首页按钮，点击直接跳转', async () => {
    mockLoadState = 'loading'
    mockIsReady = false
    currentMockState = mockQuizState({ isSubmitted: true, totalQuestions: 0 })

    renderPage()

    const backBtn = await screen.findByText('← 首页')
    expect(backBtn).toBeInTheDocument()

    fireEvent.click(backBtn)
    expect(mockNav).toHaveBeenCalledWith('/')
  })

  it('error 态显示返回首页按钮', async () => {
    mockLoadState = 'error'
    mockIsReady = false

    renderPage()

    const backBtn = await screen.findByText('← 首页')
    expect(backBtn).toBeInTheDocument()
  })
})

// ─── 优化 3: 题号居中滚动 ──────────────────────────────────

describe('QuizPage — 题号自动居中', () => {
  it('缩略图按钮存在', async () => {
    currentMockState = mockQuizState({
      questions: Array.from({ length: 5 }, (_, i) =>
        createMockQuestion({ id: i + 1, stem: `题目${i + 1}` })
      ),
      totalQuestions: 5,
    })
    renderPage()

    expect(await screen.findByRole('button', { name: '1' })).toBeInTheDocument()
  })

  it('当前题号有高亮样式（ring）', async () => {
    currentMockState = mockQuizState({
      questions: Array.from({ length: 3 }, (_, i) =>
        createMockQuestion({ id: i + 1, stem: `题目${i + 1}` })
      ),
      totalQuestions: 3,
    })
    renderPage()

    const currentBtn = await screen.findByRole('button', { name: '1' })
    expect(currentBtn.className).toMatch(/ring|scale-110/)
  })
})

// ─── Slice 2: 缺 category 参数重定向 ──────────────────────

describe('QuizPage — 缺 category 参数重定向', () => {
  it('无 category 参数时重定向到首页并传递 missingCategory 状态', async () => {
    currentSearchParams = new URLSearchParams('mode=random') // 无 category
    renderPage()

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/', {
        replace: true,
        state: { missingCategory: true },
      })
    })
  })

  it('category 参数为空字符串时也重定向', async () => {
    currentSearchParams = new URLSearchParams('mode=random&category=')
    renderPage()

    await waitFor(() => {
      expect(mockNav).toHaveBeenCalledWith('/', {
        replace: true,
        state: { missingCategory: true },
      })
    })
  })

  it('有 category 参数时不重定向，正常进入加载流程', async () => {
    currentSearchParams = new URLSearchParams('mode=random&category=综合管理')
    renderPage()

    // 不应触发重定向
    await screen.findByText('这是一道测试题目？')
    expect(mockNav).not.toHaveBeenCalledWith('/', expect.anything())
  })
})
