// 分题型得分柱状条（HistoryPage 和 ResultPage 共享）
interface TypeScoreBarProps {
  label: string
  correct: number
  total: number
  color: string
  /** 若为 true，correct/total 是百分比（0-100），直接显示 */
  isPercent?: boolean
}

export default function TypeScoreBar({ label, correct, total, color, isPercent }: TypeScoreBarProps) {
  const pct = isPercent ? correct : (total > 0 ? correct / total : 0)
  return (
    <div className="text-center">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-800">
        {isPercent ? `${correct}%` : `${correct}/${total}`}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${isPercent ? correct : pct * 100}%` }}
        />
      </div>
    </div>
  )
}
