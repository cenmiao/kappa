// 答题状态 hook — Slice 3 完整实现

import { useState, useCallback, useMemo } from 'react'
import type { Question, AnswerRecord, Attempt } from '../types'
import { getRandomQuestions, getAllQuestions, getQuestionsByIds, getQuestionsByType } from '../db/questions'
import { getWrongAnswersByType } from '../db/wrongAnswers'
import { getProgress } from '../db/progress'

export interface QuizState {
  questions: Question[]
  currentIndex: number
  answers: Record<number, { userAnswer: string; isUncertain: boolean }>
  isSubmitted: boolean
  currentAnswer: string
  totalQuestions: number
  answeredCount: number
  /** 顺序模式下的起始题目位置（全局编号），用于保存进度 */
  startIndex: number
  /** 当前题库题量不足，有题目重复出现 */
  hasShortage: boolean
}

interface QuizActions {
  /** 初始化题库：从 IndexedDB 抽题并打乱 */
  initQuiz: (db: IDBDatabase, mode: 'random' | 'sequential', category?: string) => Promise<void>
  initWithQuestions: (questions: Question[]) => void
  /** 选择/取消选项。单选/判断替换；多选 toggle */
  selectOption: (letter: string) => void
  /** 切换当前题的不确定标记 */
  toggleUncertain: () => void
  /** 跳转到下一题 */
  goNext: () => void
  /** 跳转到上一题 */
  goPrev: () => void
  /** 跳转到指定题号 */
  goTo: (index: number) => void
  /** 交卷：计算得分、生成 AnswerRecord[] 和 Attempt 对象 */
  submit: () => Attempt | null
  /** 当前题是否已答 */
  hasCurrentAnswer: boolean
  /** 当前题是否标记为不确定 */
  isCurrentUncertain: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function useQuizState(): QuizState & QuizActions {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, { userAnswer: string; isUncertain: boolean }>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [startIndex, setStartIndex] = useState(0)
  const [hasShortage, setHasShortage] = useState(false)

  const totalQuestions = questions.length

  /** 从 IndexedDB 出题 */
  const initQuiz = useCallback(async (db: IDBDatabase, mode: 'random' | 'sequential', category: string = '全部') => {
    let picked: Question[]
    let resumeIndex = 0
    let shortage = false

    if (mode === 'random') {
      // —— 配额弹性分配：检查各题型是否缺失 ——
      const BASE_QUOTAS = { single: 40, multi: 20, tf: 20 }
      const typeKeys = ['single', 'multi', 'tf'] as const

      // 检查各题型 pool 可用量
      const pools = await Promise.all(
        typeKeys.map(k => getQuestionsByType(db, k, category))
      )
      const poolAvail: Record<string, number> = {}
      typeKeys.forEach((k, i) => { poolAvail[k] = pools[i].length })

      // 找出缺失的题型，将其配额按权重 (4:2:2) 分配给其他题型
      const emptyTypes = typeKeys.filter(k => poolAvail[k] === 0)
      const nonEmptyTypes = typeKeys.filter(k => poolAvail[k] > 0)

      const adjustedQuotas: Record<string, number> = { ...BASE_QUOTAS }

      if (emptyTypes.length > 0 && nonEmptyTypes.length > 0) {
        // 权重：single=4, multi=2, tf=2
        const weights: Record<string, number> = { single: 4, multi: 2, tf: 2 }
        const totalRedistribute = emptyTypes.reduce((sum, k) => sum + BASE_QUOTAS[k], 0)
        const totalWeight = nonEmptyTypes.reduce((sum, k) => sum + weights[k], 0)

        for (const k of emptyTypes) {
          adjustedQuotas[k] = 0
        }
        for (const k of nonEmptyTypes) {
          adjustedQuotas[k] += Math.round((weights[k] / totalWeight) * totalRedistribute)
        }

        // 修正舍入误差：确保总计 = 80
        const currentTotal = Object.values(adjustedQuotas).reduce((a, b) => a + b, 0)
        const diff = 80 - currentTotal
        if (diff !== 0 && nonEmptyTypes.length > 0) {
          adjustedQuotas[nonEmptyTypes[0]] += diff
        }
      }

      // 检查题量不足
      const totalAvail = typeKeys.reduce((sum, k) => sum + poolAvail[k], 0)
      if (totalAvail < 80) {
        shortage = true
      }

      // —— 错题强化出题算法 ——
      const [wrongSingles, wrongMultis, wrongTfs] = await Promise.all([
        getWrongAnswersByType(db, 'single', category),
        getWrongAnswersByType(db, 'multi', category),
        getWrongAnswersByType(db, 'tf', category),
      ])
      // 按 wrongCount 降序排列（错得多的优先出现）
      wrongSingles.sort((a, b) => b.wrongCount - a.wrongCount)
      wrongMultis.sort((a, b) => b.wrongCount - a.wrongCount)
      wrongTfs.sort((a, b) => b.wrongCount - a.wrongCount)

      // 收集要用的错题 ID
      const TARGET_WRONG = 10
      const pickedWrongIds: number[] = []
      let remainingTarget = TARGET_WRONG
      const poolMap: Record<string, { ids: number[]; quota: number }> = {
        single: { ids: wrongSingles.map(w => w.questionId), quota: adjustedQuotas.single },
        multi: { ids: wrongMultis.map(w => w.questionId), quota: adjustedQuotas.multi },
        tf: { ids: wrongTfs.map(w => w.questionId), quota: adjustedQuotas.tf },
      }

      for (const key of typeKeys) {
        const pool = poolMap[key]
        const take = Math.min(pool.ids.length, remainingTarget, pool.quota)
        pickedWrongIds.push(...pool.ids.slice(0, take))
        remainingTarget -= take
        if (remainingTarget <= 0) break
      }

      // 获取错题的完整 Question 对象
      const wrongQuestions =
        pickedWrongIds.length > 0 ? await getQuestionsByIds(db, pickedWrongIds) : []

      const wrongSingleQs = wrongQuestions.filter(q => q.type === 'single')
      const wrongMultiQs = wrongQuestions.filter(q => q.type === 'multi')
      const wrongTfQs = wrongQuestions.filter(q => q.type === 'tf')

      const wrongSingleIds = wrongSingleQs.map(q => q.id)
      const wrongMultiIds = wrongMultiQs.map(q => q.id)
      const wrongTfIds = wrongTfQs.map(q => q.id)

      // 剩余名额用随机新题补齐
      const [singles, multis, tfs] = await Promise.all([
        getRandomQuestions(db, 'single', adjustedQuotas.single - wrongSingleQs.length, wrongSingleIds, category),
        getRandomQuestions(db, 'multi', adjustedQuotas.multi - wrongMultiQs.length, wrongMultiIds, category),
        getRandomQuestions(db, 'tf', adjustedQuotas.tf - wrongTfQs.length, wrongTfIds, category),
      ])

      // 合并
      picked = [
        ...shuffle(wrongSingleQs), ...shuffle(singles),
        ...shuffle(wrongMultiQs), ...shuffle(multis),
        ...shuffle(wrongTfQs), ...shuffle(tfs),
      ]
    } else {
      // 顺序模式：按 ID 升序，从上次进度继续
      const all = await getAllQuestions(db)
      all.sort((a, b) => a.id - b.id)
      const savedProgress = await getProgress(db)
      resumeIndex = 0
      if (savedProgress !== null && savedProgress < all.length) {
        resumeIndex = savedProgress
      }
      picked = all.slice(resumeIndex, resumeIndex + 80)
    }

    setQuestions(picked)
    setCurrentIndex(0)
    setAnswers({})
    setIsSubmitted(false)
    setStartIndex(mode === 'sequential' ? resumeIndex : 0)
    setHasShortage(shortage)
  }, [])

  /** 直接用给定题目列表初始化（复习模式） */
  const initWithQuestions = useCallback((qs: Question[]) => {
    setQuestions(qs)
    setCurrentIndex(0)
    setAnswers({})
    setIsSubmitted(false)
    setStartIndex(0)
  }, [])

  /** 当前题对象 */
  const currentQuestion = questions[currentIndex]

  /** 选择选项 */
  const selectOption = useCallback(
    (letter: string) => {
      if (!currentQuestion || isSubmitted) return

      const qid = currentQuestion.id
      const prev = answers[qid]

      if (currentQuestion.type === 'multi') {
        // 多选：toggle 模式
        const current = prev?.userAnswer ? prev.userAnswer.split(',') : []
        const idx = current.indexOf(letter)
        if (idx >= 0) {
          current.splice(idx, 1)
        } else {
          current.push(letter)
        }
        setAnswers((a) => ({
          ...a,
          [qid]: { userAnswer: current.sort().join(','), isUncertain: prev?.isUncertain ?? false },
        }))
      } else {
        // 单选 / 判断：直接替换
        setAnswers((a) => ({
          ...a,
          [qid]: { userAnswer: letter, isUncertain: prev?.isUncertain ?? false },
        }))
      }
    },
    [currentQuestion, isSubmitted, answers],
  )

  /** 切换不确定标记 */
  const toggleUncertain = useCallback(() => {
    if (!currentQuestion || isSubmitted) return

    const qid = currentQuestion.id
    setAnswers((a) => {
      const prev = a[qid]
      return {
        ...a,
        [qid]: {
          userAnswer: prev?.userAnswer ?? '',
          isUncertain: !(prev?.isUncertain ?? false),
        },
      }
    })
  }, [currentQuestion, isSubmitted])

  /** 导航 */
  const goNext = useCallback(() => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }, [currentIndex, totalQuestions])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }, [currentIndex])

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalQuestions) {
        setCurrentIndex(index)
      }
    },
    [totalQuestions],
  )

  /** 当前题的用户答案字符串 */
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return ''
    return answers[currentQuestion.id]?.userAnswer ?? ''
  }, [currentQuestion, answers])

  /** 当前题是否已答 */
  const hasCurrentAnswer = currentAnswer !== ''

  /** 当前题是否标记不确定 */
  const isCurrentUncertain = useMemo(() => {
    if (!currentQuestion) return false
    return answers[currentQuestion.id]?.isUncertain ?? false
  }, [currentQuestion, answers])

  /** 已答题数 */
  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => a.userAnswer !== '').length,
    [answers],
  )

  /** 判断多选答案是否匹配（排序后字母集相等） */
  function isMultiMatch(userAnswer: string, correctAnswer: string): boolean {
    const user = userAnswer.split(',').sort().join(',')
    const correct = (correctAnswer ?? '').split(',').sort().join(',')
    return user === correct
  }

  /** 交卷评分 */
  const submit = useCallback((): Attempt | null => {
    if (isSubmitted || questions.length === 0) return null

    setIsSubmitted(true)

    const answerRecords: AnswerRecord[] = []
    let score = 0
    let singleCorrect = 0
    let singleTotal = 0
    let multiCorrect = 0
    let multiTotal = 0
    let tfCorrect = 0
    let tfTotal = 0

    for (const q of questions) {
      const rec = answers[q.id]
      const userAnswer = rec?.userAnswer ?? ''
      let isCorrect = false

      if (q.type === 'single') {
        isCorrect = userAnswer === (q.answer ?? '')
        if (isCorrect) {
          score += 1
          singleCorrect++
        }
        singleTotal++
      } else if (q.type === 'multi') {
        isCorrect = isMultiMatch(userAnswer, q.answer ?? '')
        if (isCorrect) {
          score += 2
          multiCorrect++
        }
        multiTotal++
      } else {
        // tf
        isCorrect = userAnswer === (q.answer ?? '')
        if (isCorrect) {
          score += 1
          tfCorrect++
        }
        tfTotal++
      }

      answerRecords.push({
        questionId: q.id,
        userAnswer,
        isCorrect,
        isUncertain: rec?.isUncertain ?? false,
      })
    }

    const attempt: Attempt = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      mode: 'random', // 默认 random，由调用方覆盖
      category: '全部',
      score,
      total: 100,
      accuracy: score / 100,
      singleAccuracy: singleTotal > 0 ? singleCorrect / singleTotal : 0,
      multiAccuracy: multiTotal > 0 ? multiCorrect / multiTotal : 0,
      tfAccuracy: tfTotal > 0 ? tfCorrect / tfTotal : 0,
      answers: answerRecords,
    }

    return attempt
  }, [isSubmitted, questions, answers])

  return {
    // 状态
    questions,
    currentIndex,
    answers,
    isSubmitted,
    currentAnswer,
    totalQuestions,
    answeredCount,
    startIndex,
    hasShortage,
    // 操作
    initQuiz,
    initWithQuestions,
    selectOption,
    toggleUncertain,
    goNext,
    goPrev,
    goTo,
    submit,
    hasCurrentAnswer,
    isCurrentUncertain,
  }
}
