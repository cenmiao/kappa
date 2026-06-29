/// <reference types="node" />

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const thisDir = dirname(fileURLToPath(import.meta.url))
const configPath = resolve(thisDir, '..', 'vite.config.ts')

function readViteConfig(): string {
  return readFileSync(configPath, 'utf-8')
}

describe('PWA 配置', () => {
  it('questions.json 应使用 NetworkFirst 运行时缓存（不在预缓存中）', () => {
    const config = readViteConfig()

    // questions.json 从预缓存中移除，改用 NetworkFirst 运行时策略
    // 确保题库更新后不会因 SW 缓存而无法获取最新版本
    expect(config).not.toMatch(/includeAssets[\s\S]*?questions\.json/)
    expect(config).toMatch(/urlPattern[\s\S]*?questions/)
    expect(config).toMatch(/handler[\s\S]*?NetworkFirst/)
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

  it('"静"字应垂直居中（dominant-baseline="central"）', () => {
    const svg = readFavicon()
    expect(svg).toMatch(/dominant-baseline\s*=\s*["']central["']/)
    // y="256" 应为 viewBox 512 的中点
    expect(svg).toMatch(/y\s*=\s*["']256["']/)
  })
})
