// 答题中离开/刷新页面拦截
import { useEffect } from 'react'

export function useBeforeUnload(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // 现代浏览器忽略自定义消息，设置 returnValue 即可触发确认框
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [enabled])
}
