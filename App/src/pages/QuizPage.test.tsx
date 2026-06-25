// 优化 1+2+3: QuizPage 组件测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import QuizPage from './QuizPage'
import type { Question, Attempt } from '../types'
import { saveProgress as mockSaveProgress } from '../db/progress'

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
    submitOne: vi.fn(),
    hasCurrentAnswer: false,
    isCurrentUncertain: false,
    isCurrentDone: false,
    hasShortage: false,
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
  getDoneRecord: vi.fn(() => Promise.resolve(null)),
  clearDoneRecord: vi.fn(),
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

// ─── Slice 3: 分类标签可见 ───────────────────────────

describe('QuizPage — 分类标签', () => {
  it('答题页面显示当前题目的分类标签', async () => {
    currentMockState = mockQuizState({
      questions: [createMockQuestion({ category: '综合管理' })],
    })
    renderPage()

    await screen.findByText('这是一道测试题目？')
    expect(screen.getByText('综合管理')).toBeInTheDocument()
  })

  it('不同分类显示对应标签文本', async () => {
    currentMockState = mockQuizState({
      questions: [createMockQuestion({ category: '政治理论' })],
    })
    renderPage()

    await screen.findByText('这是一道测试题目？')
    expect(screen.getByText('政治理论')).toBeInTheDocument()
  })
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
    expect(screen.getByText('← 返回')).toBeInTheDocument()
  })

  it('点击返回首页弹出确认弹窗', async () => {
    renderPage()
    await screen.findByText('这是一道测试题目？')

    fireEvent.click(screen.getByText('← 返回'))

    expect(await screen.findByRole('heading', { name: '确认返回' })).toBeInTheDocument()
    expect(screen.getByText(/当前答题进度不会保存/)).toBeInTheDocument()
  })

  it('取消返回：弹窗关闭，留在答题页', async () => {
    renderPage()
    await screen.findByText('这是一道测试题目？')

    fireEvent.click(screen.getByText('← 返回'))

    await screen.findByRole('heading', { name: '确认返回' })

    fireEvent.click(screen.getByRole('button', { name: '继续答题' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '确认返回' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('这是一道测试题目？')).toBeInTheDocument()
  })

  it('确认返回：跳转到 /', async () => {
    renderPage()

    await screen.findByText('这是一道测试题目？')

    fireEvent.click(screen.getByText('← 返回'))

    await screen.findByRole('heading', { name: '确认返回' })

    fireEvent.click(screen.getByRole('button', { name: '确认返回' }))

    expect(mockNav).toHaveBeenCalledWith('/')
  })

  it('显示已答题数', async () => {
    currentMockState = mockQuizState({ answeredCount: 42, totalQuestions: 80 })
    renderPage()

    await screen.findByText('这是一道测试题目？')

    await act(async () => {
      fireEvent.click(screen.getByText('← 返回'))
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

    const backBtn = await screen.findByText('← 返回')
    expect(backBtn).toBeInTheDocument()

    fireEvent.click(backBtn)
    expect(mockNav).toHaveBeenCalledWith('/')
  })

  it('error 态显示返回首页按钮', async () => {
    mockLoadState = 'error'
    mockIsReady = false

    renderPage()

    const backBtn = await screen.findByText('← 返回')
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

// ─── Slice 3: 题量不足提示条 ──────────────────────────

describe('QuizPage — 题量不足提示条', () => {
  it('hasShortage 为 true 时显示题量不足提示', async () => {
    currentMockState = mockQuizState({ hasShortage: true })
    renderPage()

    await screen.findByText('这是一道测试题目？')
    expect(screen.getByText(/当前题库题量不足/)).toBeInTheDocument()
    expect(screen.getByText(/部分题目可能重复出现/)).toBeInTheDocument()
  })

  it('hasShortage 为 false 时不显示题量不足提示', async () => {
    currentMockState = mockQuizState({ hasShortage: false })
    renderPage()

    await screen.findByText('这是一道测试题目？')
    expect(screen.queryByText(/当前题库题量不足/)).not.toBeInTheDocument()
  })

  it('loading 态不显示题量不足提示', async () => {
    mockLoadState = 'loading'
    mockIsReady = false
    currentMockState = mockQuizState({ hasShortage: true, isSubmitted: true, totalQuestions: 0 })

    renderPage()

    await screen.findByText('题库加载中...')
    expect(screen.queryByText(/当前题库题量不足/)).not.toBeInTheDocument()
  })
})

// ─── Slice 4: 顺序模式交卷保存带 category 后缀的进度键 ─────

describe('QuizPage — 顺序模式进度保存 key', () => {
  function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
    return {
      id: 'test-attempt-id',
      date: new Date().toISOString(),
      mode: 'sequential',
      category: '综合管理',
      score: 80,
      total: 100,
      accuracy: 0.8,
      singleAccuracy: 0.9,
      multiAccuracy: 0.7,
      tfAccuracy: 0.8,
      answers: [
        { questionId: 1, userAnswer: 'A', isCorrect: true, isUncertain: false },
      ],
      ...overrides,
    }
  }

  it('顺序模式下不显示交卷按钮', async () => {
    const qs = Array.from({ length: 10 }, (_, i) =>
      createMockQuestion({ id: i + 1, stem: `题目${i + 1}` })
    )
    currentMockState = mockQuizState({
      questions: qs,
      currentIndex: 0,
      totalQuestions: 10,
      isCurrentDone: false,
    })
    currentSearchParams = new URLSearchParams('mode=sequential&category=综合管理')

    renderPage()

    await screen.findByText('题目1')
    // 顺序模式不应有交卷按钮
    expect(screen.queryByText(/交卷/)).not.toBeInTheDocument()
    // 不应有不确定标记按钮
    expect(screen.queryByRole('button', { name: /标记/ })).not.toBeInTheDocument()
  })

  it('顺序模式显示返回按钮和进度信息', async () => {
    currentMockState = mockQuizState({
      questions: [createMockQuestion({ category: '综合管理', stem: '题目1' })],
      currentIndex: 0,
      totalQuestions: 100,
    })
    currentSearchParams = new URLSearchParams('mode=sequential&category=综合管理')

    renderPage()

    await screen.findByText('题目1')
    expect(screen.getByText('← 返回')).toBeInTheDocument()
    expect(screen.getByText(/综合管理 · 1\/100/)).toBeInTheDocument()
  })

  it('随机模式下交卷不调用 saveProgress', async () => {
    currentMockState = mockQuizState({
      mode: 'random',
      questions: [createMockQuestion()],
      currentIndex: 0,
      totalQuestions: 1,
      answeredCount: 1,
      submit: vi.fn(() => makeAttempt({ mode: 'random' })),
      hasCurrentAnswer: true,
    })
    currentSearchParams = new URLSearchParams('mode=random&category=综合管理')

    renderPage()

    await screen.findByText('这是一道测试题目？')

    const submitBtn = screen.getByText(/交卷/)
    await act(async () => {
      fireEvent.click(submitBtn)
      await new Promise((r) => setTimeout(r, 0))
    })

    const confirmBtn = await screen.findByRole('button', { name: '确认交卷' })
    await act(async () => {
      fireEvent.click(confirmBtn)
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(mockSaveProgress).not.toHaveBeenCalled()
  })
})
