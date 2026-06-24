// Slice 6: beforeunload 拦截 hook 测试
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBeforeUnload } from './useBeforeUnload'

// jsdom 中 beforeunload 行为有限，验证监听器注册/移除

afterEach(() => {
  // 清理所有事件监听器
  vi.restoreAllMocks()
})

describe('useBeforeUnload', () => {
  it('enabled=true 时注册 beforeunload 监听器', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useBeforeUnload(true))

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('enabled=false 时不注册监听器', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useBeforeUnload(false))

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('从 enabled=true 变为 false 时移除监听器', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const addSpy = vi.spyOn(window, 'addEventListener')

    const { rerender } = renderHook(
      ({ enabled }) => useBeforeUnload(enabled),
      { initialProps: { enabled: true } },
    )

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

    rerender({ enabled: false })

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('组件卸载时清理监听器', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useBeforeUnload(true))
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })
})
