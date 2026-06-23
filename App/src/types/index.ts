// 题目类型
export type QuestionType = 'single' | 'multi' | 'truefalse'

// 单道题目
export interface Question {
  id: number
  type: QuestionType
  stem: string
  options: string[]
  /** 单选/判断为单个字母，多选为逗号分隔的字母，如 "A,B,C" */
  answer?: string
  explanation?: string
}

// 单题作答记录
export interface AnswerRecord {
  questionId: number
  userAnswer: string
  isCorrect: boolean
  isUncertain: boolean
}

// 一次完整的练习记录
export interface Attempt {
  id: string
  date: string
  mode: 'random' | 'sequential'
  score: number
  total: number
  accuracy: number
  singleAccuracy: number
  multiAccuracy: number
  tfAccuracy: number
  answers: AnswerRecord[]
}
