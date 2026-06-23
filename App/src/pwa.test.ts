import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const thisDir = dirname(fileURLToPath(import.meta.url))
const configPath = resolve(thisDir, '..', 'vite.config.ts')
const distSwPath = resolve(thisDir, '..', 'dist', 'sw.js')

function readViteConfig(): string {
  return readFileSync(configPath, 'utf-8')
}

describe('PWA 配置', () => {
  it('includeAssets 应包含 questions.json', () => {
    const config = readViteConfig()

    // 验证 includeAssets 数组中包含 'questions.json'
    // 允许单引号或双引号
    expect(config).toMatch(/includeAssets\s*:\s*\[/)
    expect(config).toMatch(/['"]questions\.json['"]/)
  })
})

describe('SW 预缓存产物', () => {
  it('build 后 sw.js 的 precache 列表应包含 questions.json', () => {
    // 需要先执行 npm run build，测试验证产物
    if (!existsSync(distSwPath)) {
      throw new Error(
        `dist/sw.js 不存在，请先运行 npm run build（路径：${distSwPath}）`
      )
    }

    const swContent = readFileSync(distSwPath, 'utf-8')

    // precacheAndRoute 调用中应出现 questions.json
    // workbox 生成的 key 可能带引号或裸名：url:"questions.json" 或 "url":"questions.json"
    expect(swContent).toMatch(/(?:url|"url")\s*:\s*"questions\.json"/)
  })
})

describe('favicon.svg', () => {
  const faviconPath = resolve(thisDir, '..', 'public', 'favicon.svg')

  function readFavicon(): string {
    if (!existsSync(faviconPath)) {
      throw new Error(`favicon.svg 不存在：${faviconPath}`)
    }
    return readFileSync(faviconPath, 'utf-8')
  }

  it('应包含"静"字', () => {
    const svg = readFavicon()
    expect(svg).toContain('静')
  })

  it('应使用 indigo #6366f1 背景色', () => {
    const svg = readFavicon()
    // SVG 中应有 fill="#6366f1" 的元素（背景矩形）
    expect(svg).toMatch(/fill\s*=\s*["']#6366f1["']/)
  })

  it('应作为 SVG 图标包含 viewBox', () => {
    const svg = readFavicon()
    expect(svg).toMatch(/<svg[^>]*>/)
    expect(svg).toMatch(/viewBox/)
  })
})
