// 答题页共享状态 — 所有变体共用同一套状态逻辑

import { useState, useCallback, useMemo } from 'react'
import { mockQuestions, type AnswerRecord } from '../data/mock'

export interface QuizState {
  currentIndex: number
  answers: Record<number, AnswerRecord>
  isSubmitted: boolean
}

export default function useQuizState() {
  // 原型用 20 道题（实际是 80 题，这里方便演示三种变体）
  const questions = useMemo(() => mockQuestions.slice(0, 20), [])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, AnswerRecord>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const totalQuestions = questions.length

  const setAnswer = useCallback((questionId: number, userAnswer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        userAnswer,
      },
    }))
  }, [])

  const toggleUncertain = useCallback((questionId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        userAnswer: prev[questionId]?.userAnswer ?? '',
        isUncertain: !prev[questionId]?.isUncertain,
      },
    }))
  }, [])

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index)
    }
  }, [totalQuestions])

  const submit = useCallback(() => {
    setIsSubmitted(true)
  }, [])

  const answeredCount = useMemo(
    () => Object.values(answers).filter((a) => a.userAnswer).length,
    [answers],
  )

  const currentAnswer = answers[questions[currentIndex]?.id]

  return {
    questions,
    currentIndex,
    answers,
    isSubmitted,
    currentAnswer,
    totalQuestions,
    answeredCount,
    setAnswer,
    toggleUncertain,
    goTo,
    submit,
    setIsSubmitted,
  }
}
