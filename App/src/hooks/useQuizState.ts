// 答题状态 hook
// Slice 2+ 实现完整状态管理逻辑

export interface QuizState {
  questions: Array<{ id: number; type: string; stem: string; options: string[] }>
  currentIndex: number
  answers: Record<number, { userAnswer: string; isUncertain: boolean }>
  isSubmitted: boolean
  currentAnswer: string
  totalQuestions: number
  answeredCount: number
}

export default function useQuizState(): QuizState {
  // Slice 1: 返回空状态占位
  return {
    questions: [],
    currentIndex: 0,
    answers: {},
    isSubmitted: false,
    currentAnswer: '',
    totalQuestions: 0,
    answeredCount: 0,
  }
}
