// 题目类型
export type QuestionType = 'single' | 'multi' | 'tf'

// 单道题目
export interface Question {
  id: number
  type: QuestionType
  category: string
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

// 错题池记录
export interface WrongAnswer {
  questionId: number
  type: QuestionType
  category: string
  wrongCount: number
}

// 题库元信息（存在 progress 表中）
export interface Meta {
  key: 'meta'
  importTime: string
  questionCount: number
  /** 各分类题目数量，如 { "综合管理": 1050, "税务公共知识": 800, ... } */
  categories?: Record<string, number>
}

// 顺序练习已完成记录（key = questionId）
export interface DoneRecord {
  [questionId: number]: {
    userAnswer: string
    isCorrect: boolean
  }
}

// 一次完整的练习记录
export interface Attempt {
  id: string
  date: string
  mode: 'random' | 'sequential' | 'review'
  category: string
  score: number
  total: number
  accuracy: number
  singleAccuracy: number
  multiAccuracy: number
  tfAccuracy: number
  answers: AnswerRecord[]
}
