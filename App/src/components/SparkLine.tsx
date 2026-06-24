// SVG 得分趋势折线图
interface DataPoint {
  date: string
  score: number
}

export default function SparkLine({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null

  const w = 320
  const h = 140
  const padLeft = 32
  const padRight = 16
  const padTop = 8
  const padBottom = 20

  const plotW = w - padLeft - padRight
  const plotH = h - padTop - padBottom

  const minScore = 0
  const maxScore = 100
  const yRefs = [0, 50, 75, 100]

  const xScale = (i: number) => padLeft + (i / Math.max(1, data.length - 1)) * plotW
  const yScale = (s: number) => padTop + plotH - ((s - minScore) / (maxScore - minScore)) * plotH

  // polyline 路径
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.score)}`).join(' ')

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="得分趋势图">
        {/* Y 轴参考线 */}
        {yRefs.map((y) => (
          <g key={y}>
            <line
              x1={padLeft}
              y1={yScale(y)}
              x2={w - padRight}
              y2={yScale(y)}
              stroke={y === 0 ? '#e5e7eb' : '#f3f4f6'}
              strokeWidth={y === 0 ? 1 : 0.5}
              strokeDasharray={y === 0 ? '' : '3,3'}
            />
            <text
              x={padLeft - 6}
              y={yScale(y) + 3}
              textAnchor="end"
              style={{ fontSize: '8px', fill: '#9ca3af' }}
            >
              {y}
            </text>
          </g>
        ))}

        {/* polyline */}
        <polyline
          points={points}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* 数据点 + 标注 */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xScale(i)}
              cy={yScale(d.score)}
              r="3"
              fill="white"
              stroke="#6366f1"
              strokeWidth="1.5"
            />
            <text
              x={xScale(i)}
              y={yScale(d.score) - 8}
              textAnchor="middle"
              style={{ fontSize: '8px', fill: '#6366f1', fontWeight: 600 }}
            >
              {d.score}
            </text>
            {/* X 轴日期（每两个点标一次避免拥挤） */}
            {data.length <= 7 || i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? (
              <text
                x={xScale(i)}
                y={h - 4}
                textAnchor="middle"
                style={{ fontSize: '7px', fill: '#9ca3af' }}
              >
                {new Date(d.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  )
}
