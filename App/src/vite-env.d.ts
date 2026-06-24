/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// PWA 安装事件类型
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

