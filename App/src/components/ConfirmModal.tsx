// 通用确认弹窗 — Slice 3 完整实现

import type { ReactNode } from 'react'

export interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  /** 确认按钮文字，默认"确认" */
  confirmLabel?: string
  /** 取消按钮文字，默认"取消" */
  cancelLabel?: string
  /** 富文本内容（显示在 message 下方），可用于红色提醒等 */
  children?: ReactNode
  /** 确认按钮样式变体 */
  confirmVariant?: 'indigo' | 'green'
}

export default function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = '确认',
  cancelLabel = '取消',
  children,
  confirmVariant = 'indigo',
}: ConfirmModalProps) {
  if (!open) return null

  const confirmStyle =
    confirmVariant === 'green'
      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white active:from-green-600 active:to-emerald-600'
      : 'bg-indigo-500 text-white active:bg-indigo-600'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 遮罩层 */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* 弹窗卡片 */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg px-5 pt-6 pb-8 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-1">{message}</p>
        {children && <div className="mb-2">{children}</div>}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 active:bg-gray-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${confirmStyle}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
