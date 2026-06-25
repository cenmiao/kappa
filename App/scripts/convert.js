/**
 * 题库转换脚本（v2）
 * 扫描 tiku/ 目录下所有 .docx，按文件名首字符排序后合并为 questions.json
 *
 * 用法:
 *   node scripts/convert.js          # 需在 App/ 目录下运行
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TIKU_DIR = join(ROOT, 'tiku')
const PUBLIC_DIR = join(ROOT, 'public')
const LOGS_DIR = join(ROOT, 'logs')
const OUTPUT_JSON = join(PUBLIC_DIR, 'questions.json')
const LOG_FILE = join(LOGS_DIR, 'convert-log.txt')

/** 自动查找 pandoc 路径 */
function findPandoc() {
  // 优先尝试 PATH 中的 pandoc
  try {
    execSync('pandoc --version', { stdio: 'pipe' })
    return 'pandoc'
  } catch (_) { /* not in PATH */ }

  // Windows 常见安装位置
  const candidates = [
    'C:\\Users\\Admin\\AppData\\Local\\Pandoc\\pandoc.exe',
    'C:\\Program Files\\Pandoc\\pandoc.exe',
  ]
  for (const c of candidates) {
    try {
      execSync(`"${c}" --version`, { stdio: 'pipe' })
      return c
    } catch (_) { /* not here */ }
  }
  throw new Error('找不到 pandoc，请安装或加入 PATH')
}

const PANDOC = findPandoc()

const TYPE_MAP = {
  '单选题': 'single',
  '多选题': 'multi',
  '判断题': 'tf',
}

// ─── 工具函数 ────────────────────────────────────────────────

/** pandoc 转换 docx → 纯文本（输出到临时文件避免管道缓冲溢出） */
function docxToText(docxPath) {
  const tmpFile = join(tmpdir(), `kappa-convert-${randomUUID()}.txt`)
  try {
    execSync(`"${PANDOC}" "${docxPath}" -t plain --wrap=none -o "${tmpFile}"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    let text = readFileSync(tmpFile, 'utf-8')
    // 统一换行符
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    return text
  } finally {
    try { unlinkSync(tmpFile) } catch (_) { /* ignore */ }
  }
}

/** 按 "数字. 【" 模式切分题目 */
function splitQuestions(rawText) {
  const parts = rawText.split(/\n(?=\d+\.\s+【)/)
  // 跳过第一段（标题行）
  return parts.slice(1).map(p => p.trim()).filter(Boolean)
}

/** 解析单道题 */
function parseQuestionWithAnswer(block) {
  const lines = block.split('\n')
  const headerLine = lines[0].trim()

  // 编号 + 题型
  const headerMatch = headerLine.match(/^(\d+)\.\s+【(.+?)】/)
  if (!headerMatch) return { error: 'HEADER_PARSE_FAILED', block: block.substring(0, 80) }

  const localId = parseInt(headerMatch[1], 10)
  const typeLabel = headerMatch[2]
  const type = TYPE_MAP[typeLabel]
  if (!type) return { error: 'UNKNOWN_TYPE', id: localId, typeLabel, block: block.substring(0, 80) }

  // 题干：】之后到第一个 "- A." 之前（含跨行）
  const stemStart = block.indexOf('】') + 1
  const firstOption = block.search(/\n-\s+[A-E]\./)
  if (firstOption === -1) return { error: 'NO_OPTIONS_FOUND', id: localId, block: block.substring(0, 120) }
  const stem = block.substring(stemStart, firstOption).replace(/\n/g, '').trim()

  // 选项（每行 "- A. xxx"）
  const optionRegex = /-\s+([A-E])\.\s+(.+)/g
  const optionMap = {}
  let optMatch
  while ((optMatch = optionRegex.exec(block)) !== null) {
    optionMap[optMatch[1]] = optMatch[2].trim()
  }
  const optionKeys = Object.keys(optionMap).sort()
  const options = optionKeys.map(k => optionMap[k])

  // 答案
  const answerMatch = block.match(/答案：(.+)/)
  const answer = answerMatch ? answerMatch[1].trim() : undefined

  // 解析
  const expMatch = block.match(/解析：([\s\S]+?)(?=\n\d+\.\s+【|$)/)
  const explanation = expMatch ? expMatch[1].replace(/\n/g, ' ').trim() : undefined

  return { localId, type, stem, options, answer, explanation }
}

/** 写入日志 */
function writeLog(lines) {
  mkdirSync(LOGS_DIR, { recursive: true })
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const header = `=== 题库转换日志 ${timestamp} ===\n\n`
  writeFileSync(LOG_FILE, header + lines.join('\n') + '\n', 'utf-8')
  console.log(`日志已写入: ${LOG_FILE}`)
}

// ─── 主流程 ───────────────────────────────────────────────────

function main() {
  console.log('🔨 多文件合并模式 — 扫描 tiku/ 目录...')

  const allLogs = []

  // 1. 扫描 tiku 目录，找出所有 .docx 文件
  const allFiles = readdirSync(TIKU_DIR).filter(f => f.endsWith('.docx'))
  if (allFiles.length === 0) {
    console.error('❌ tiku/ 目录中没有 .docx 文件')
    process.exit(1)
  }

  // 按文件名排序：格式为 "{序号} -【分类】..."，localeCompare 保证 1→2→3→4 顺序
  allFiles.sort((a, b) => a.localeCompare(b, 'zh-CN'))
  console.log(`  找到 ${allFiles.length} 个文件:`)
  allFiles.forEach(f => console.log(`    - ${f}`))

  // 2. 逐个转换、解析，收集所有题目
  let globalId = 0
  const allQuestions = []
  const fileStats = [] // 每个文件的统计

  for (const filename of allFiles) {
    const filePath = join(TIKU_DIR, filename)
    console.log(`\n📄 处理: ${filename}`)

    // 从文件名提取 category（第一个【xxx】中的内容）
    const catMatch = filename.match(/【(.+?)】/)
    const category = catMatch ? catMatch[1] : '未知分类'

    // pandoc 转换
    let text
    try {
      text = docxToText(filePath)
      console.log(`  pandoc 转换: ${text.split('\n').length} 行`)
    } catch (e) {
      console.error(`  ❌ 转换失败:`, e.message)
      allLogs.push(`[错误] pandoc 转换 ${filePath} 失败: ${e.message}`)
      continue
    }

    // 切分 + 解析
    const blocks = splitQuestions(text)
    console.log(`  切分出 ${blocks.length} 题`)

    const fileQuestions = []
    let fileErrors = 0
    for (const block of blocks) {
      const result = parseQuestionWithAnswer(block)
      if (result.error) {
        fileErrors++
        allLogs.push(`[解析异常] ${result.error} | 文件=${filename} | localId=${result.id ?? '?'} | ${result.block}`)
      } else {
        fileQuestions.push(result)
      }
    }

    // 重新分配全局 ID，附加 category
    fileQuestions.forEach(q => {
      globalId++
      allQuestions.push({
        id: globalId,
        type: q.type,
        category,
        stem: q.stem,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
      })
    })

    fileStats.push({ filename, category, count: fileQuestions.length, errors: fileErrors })
    console.log(`  解析: ${fileQuestions.length} 题成功${fileErrors > 0 ? `, ${fileErrors} 题失败` : ''}`)
  }

  // 3. 统计输出
  const typeLabelCount = {}
  allQuestions.forEach(q => {
    const label = Object.keys(TYPE_MAP).find(k => TYPE_MAP[k] === q.type)
    typeLabelCount[label] = (typeLabelCount[label] || 0) + 1
  })

  const categoryCount = {}
  allQuestions.forEach(q => {
    categoryCount[q.category] = (categoryCount[q.category] || 0) + 1
  })

  const summary = [
    `\n📊 合并统计:`,
    `  总题数: ${allQuestions.length}`,
    `  全局 ID 范围: 1 - ${globalId}`,
    ``,
    `  各分类:`,
    ...Object.entries(categoryCount).map(([cat, n]) => `    ${cat}: ${n} 题`),
    ``,
    `  各题型:`,
    `    单选题(single): ${typeLabelCount['单选题'] || 0}`,
    `    多选题(multi): ${typeLabelCount['多选题'] || 0}`,
    `    判断题(tf): ${typeLabelCount['判断题'] || 0}`,
  ]
  console.log(summary.join('\n'))
  allLogs.push(...summary)

  // 4. 输出 JSON
  mkdirSync(PUBLIC_DIR, { recursive: true })
  writeFileSync(OUTPUT_JSON, JSON.stringify(allQuestions, null, 2), 'utf-8')
  const sizeKB = (Buffer.byteLength(JSON.stringify(allQuestions)) / 1024).toFixed(1)
  console.log(`\n✅ 已输出 ${OUTPUT_JSON} (${allQuestions.length} 题, ${sizeKB} KB)`)
  allLogs.push(`\n✅ 正式输出: ${allQuestions.length} 题 → ${OUTPUT_JSON}`)

  // 5. 写入日志
  writeLog(allLogs)
}

main()
