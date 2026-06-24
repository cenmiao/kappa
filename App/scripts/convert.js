/**
 * 题库转换脚本
 * 将 tiku/ 下两个 docx 源文件合并转换为 public/questions.json
 *
 * 用法:
 *   node scripts/convert.js          # 正式输出（需在 App/ 目录下运行）
 *   node scripts/convert.js --dry    # 干跑：仅生成异常报告，不输出 JSON
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TIKU_DIR = join(ROOT, 'tiku')
const PUBLIC_DIR = join(ROOT, 'public')
const LOGS_DIR = join(ROOT, 'logs')
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

const WITH_ANSWER = join(TIKU_DIR, 'tiku-with-answer.docx')
const WITHOUT_ANSWER = join(TIKU_DIR, 'tiku-without-answer.docx')
const OUTPUT_JSON = join(PUBLIC_DIR, 'questions.json')
const LOG_FILE = join(LOGS_DIR, 'convert-log.txt')

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
  // 跳过第一段（标题 "全量题目总汇总"）
  return parts.slice(1).map(p => p.trim()).filter(Boolean)
}

/** 解析单道题（有答案版） */
function parseQuestionWithAnswer(block) {
  const lines = block.split('\n')
  const headerLine = lines[0].trim()

  // 编号 + 题型
  const headerMatch = headerLine.match(/^(\d+)\.\s+【(.+?)】/)
  if (!headerMatch) return { error: 'HEADER_PARSE_FAILED', block: block.substring(0, 80) }

  const id = parseInt(headerMatch[1], 10)
  const typeLabel = headerMatch[2]
  const type = TYPE_MAP[typeLabel]
  if (!type) return { error: 'UNKNOWN_TYPE', id, typeLabel, block: block.substring(0, 80) }

  // 题干：】之后到第一个 "- A." 之前（含跨行）
  const stemStart = block.indexOf('】') + 1
  const firstOption = block.search(/\n-\s+[A-E]\./)
  if (firstOption === -1) return { error: 'NO_OPTIONS_FOUND', id, block: block.substring(0, 120) }
  const stem = block.substring(stemStart, firstOption).replace(/\n/g, '').trim()

  // 选项（每行 "- A. xxx"，贪婪匹配到行尾。换行符已统一为 \n）
  const optionRegex = /-\s+([A-E])\.\s+(.+)/g
  const optionMap = {}
  let optMatch
  while ((optMatch = optionRegex.exec(block)) !== null) {
    optionMap[optMatch[1]] = optMatch[2].trim()
  }
  const optionKeys = Object.keys(optionMap).sort()
  const options = optionKeys.map(k => optionMap[k])

  // 答案（贪婪匹配到行尾，. 不跨越 \n）
  const answerMatch = block.match(/答案：(.+)/)
  const answer = answerMatch ? answerMatch[1].trim() : undefined

  // 解析（从"解析："到块末尾或下一个题目头）
  const expMatch = block.match(/解析：([\s\S]+?)(?=\n\d+\.\s+【|$)/)
  const explanation = expMatch ? expMatch[1].replace(/\n/g, ' ').trim() : undefined

  return { id, type, stem, options, answer, explanation }
}

/** 解析单道题（无答案版，仅提取编号+题型+题干+选项用于交叉验证） */
function parseQuestionWithoutAnswer(block) {
  const headerMatch = block.trim().match(/^(\d+)\.\s+【(.+?)】/)
  if (!headerMatch) return { error: 'HEADER_PARSE_FAILED', block: block.substring(0, 80) }

  const id = parseInt(headerMatch[1], 10)
  const typeLabel = headerMatch[2]
  const type = TYPE_MAP[typeLabel]
  if (!type) return { error: 'UNKNOWN_TYPE', id, typeLabel }

  const stemStart = block.indexOf('】') + 1
  const firstOption = block.search(/\n-\s+[A-E]\./)
  if (firstOption === -1) return { error: 'NO_OPTIONS_FOUND', id }
  const stem = block.substring(stemStart, firstOption).replace(/\n/g, '').trim()

  return { id, type, stem }
}

/** 交叉验证 */
function crossValidate(withAnswerQuestions, withoutAnswerQuestions) {
  const logs = []
  const withMap = new Map(withAnswerQuestions.map(q => [q.id, q]))
  const withoutMap = new Map(withoutAnswerQuestions.map(q => [q.id, q]))

  // 检查编号差异
  const withIds = new Set(withMap.keys())
  const withoutIds = new Set(withoutMap.keys())
  const onlyInWith = [...withIds].filter(id => !withoutIds.has(id))
  const onlyInWithout = [...withoutIds].filter(id => !withIds.has(id))

  if (onlyInWith.length > 0) {
    logs.push(`[交叉验证] 仅在 with-answer 中存在的编号 (${onlyInWith.length}): ${onlyInWith.slice(0, 20).join(', ')}${onlyInWith.length > 20 ? '...' : ''}`)
  }
  if (onlyInWithout.length > 0) {
    logs.push(`[交叉验证] 仅在 without-answer 中存在的编号 (${onlyInWithout.length}): ${onlyInWithout.slice(0, 20).join(', ')}${onlyInWithout.length > 20 ? '...' : ''}`)
  }

  // 逐题比对题干
  let mismatchCount = 0
  for (const id of withIds) {
    const w = withMap.get(id)
    const wo = withoutMap.get(id)
    if (!wo) continue
    if (w.stem !== wo.stem) {
      mismatchCount++
      if (mismatchCount <= 20) {
        logs.push(`[交叉验证] #${id} 题干不一致: with-answer="${w.stem.substring(0, 60)}..." without-answer="${wo.stem.substring(0, 60)}..."`)
      }
    }
  }
  if (mismatchCount > 0) {
    logs.push(`[交叉验证] 题干不一致总数: ${mismatchCount}`)
  }

  return { logs, mismatchIds: 0 /* 不一致时跳过，不阻断 */ }
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
  const isDry = process.argv.includes('--dry')
  console.log(isDry ? '🔍 干跑模式 — 仅生成异常报告' : '🔨 正式模式 — 输出 questions.json')

  const allLogs = []

  // 1. pandoc 转换两个 docx
  console.log('\n📄 转换 docx → 纯文本...')
  let withText, withoutText
  try {
    withText = docxToText(WITH_ANSWER)
    console.log(`  有答案版: ${withText.split('\n').length} 行`)
  } catch (e) {
    console.error('❌ 转换有答案版失败:', e.message)
    allLogs.push(`[错误] pandoc 转换 ${WITH_ANSWER} 失败: ${e.message}`)
    writeLog(allLogs)
    process.exit(1)
  }
  try {
    withoutText = docxToText(WITHOUT_ANSWER)
    console.log(`  无答案版: ${withoutText.split('\n').length} 行`)
  } catch (e) {
    console.error('❌ 转换无答案版失败:', e.message)
    allLogs.push(`[错误] pandoc 转换 ${WITHOUT_ANSWER} 失败: ${e.message}`)
    writeLog(allLogs)
    process.exit(1)
  }

  console.log('\n📋 解析题目...')
  const withBlocks = splitQuestions(withText)
  const withoutBlocks = splitQuestions(withoutText)
  console.log(`  有答案版: ${withBlocks.length} 题`)
  console.log(`  无答案版: ${withoutBlocks.length} 题`)

  // 3. 解析有答案版
  const withAnswerQuestions = []
  for (const block of withBlocks) {
    const result = parseQuestionWithAnswer(block)
    if (result.error) {
      allLogs.push(`[解析异常] ${result.error} | id=${result.id ?? '?'} | ${result.block}`)
    } else {
      withAnswerQuestions.push(result)
    }
  }

  // 4. 解析无答案版（用于交叉验证）
  const withoutAnswerQuestions = []
  for (const block of withoutBlocks) {
    const result = parseQuestionWithoutAnswer(block)
    if (result.error) {
      allLogs.push(`[解析异常(无答案版)] ${result.error} | id=${result.id ?? '?'}`)
    } else {
      withoutAnswerQuestions.push(result)
    }
  }

  // 5. 交叉验证
  console.log('\n🔬 交叉验证...')
  const { logs: crossLogs } = crossValidate(withAnswerQuestions, withoutAnswerQuestions)
  allLogs.push(...crossLogs)
  if (crossLogs.length === 0) {
    console.log('  ✅ 全部通过')
    allLogs.push('[交叉验证] ✅ 全部通过 — 两个文件编号和题干一致')
  }

  // 6. 格式异常汇总
  const typeLabelCount = {}
  withAnswerQuestions.forEach(q => {
    const label = Object.keys(TYPE_MAP).find(k => TYPE_MAP[k] === q.type)
    typeLabelCount[label] = (typeLabelCount[label] || 0) + 1
  })
  const answerFormats = { single: 0, multi: 0 }
  withAnswerQuestions.forEach(q => {
    if (q.answer) {
      answerFormats[q.answer.includes(',') ? 'multi' : 'single']++
    }
  })

  const summary = [
    `\n📊 统计:`,
    `  总题数: ${withAnswerQuestions.length}`,
    `  单选题(single): ${typeLabelCount['单选题'] || 0}`,
    `  多选题(multi): ${typeLabelCount['多选题'] || 0}`,
    `  判断题(tf): ${typeLabelCount['判断题'] || 0}`,
    `  单选答案: ${answerFormats.single}`,
    `  多选答案: ${answerFormats.multi}`,
    `  解析失败: ${withBlocks.length - withAnswerQuestions.length}`,
  ]
  console.log(summary.join('\n'))
  allLogs.push(...summary)

  // 7. 输出
  if (isDry) {
    console.log('\n🔍 干跑完成，未写入 JSON 文件。')
    allLogs.push('\n🔍 干跑完成。')
  } else {
    mkdirSync(PUBLIC_DIR, { recursive: true })
    // 只输出有答案版（合并了答案和解析）
    const output = withAnswerQuestions.map(q => ({
      id: q.id,
      type: q.type,
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
    }))
    writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf-8')
    const sizeKB = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1)
    console.log(`\n✅ 已输出 ${OUTPUT_JSON} (${output.length} 题, ${sizeKB} KB)`)
    allLogs.push(`\n✅ 正式输出: ${output.length} 题 → ${OUTPUT_JSON}`)
  }

  writeLog(allLogs)
}

main()
