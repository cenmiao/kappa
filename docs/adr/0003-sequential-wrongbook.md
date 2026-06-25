# ADR 0003: 顺序练习重构 + 错题本功能

## 状态

已接受（2026-06-25）

## 背景

当前顺序练习套用随机练习的 80 题限制和 100 分制打分，与其"系统性学习"的定位不匹配。用户需要能够按编号顺序持续刷完整套题库，并在做题过程中获得即时反馈。此外，虽然系统已有错题池（wrongAnswers store），但用户没有主动查看和管理错题的入口。

## 决策

### 1. 顺序练习改为全量加载 + 逐题反馈

- 加载当前分类的全部题目（按 ID 升序），不再截取 80 题
- 取消 100 分制打分和 Attempt 记录生成
- 单选/判断：点击选项即判对错、显示解析
- 多选：新增"提交"按钮，点击后判对错、显示解析
- 移除"不确定"标记按钮

### 2. done 记录替代简单进度数字

progress store 新增 key `sequential:{category}:done`，值为 `Record<number, { userAnswer: string; isCorrect: boolean }>`。每道题完成后立即逐题写入。旧 `sequential:{category}` number 值自动迁移为 done 记录（标记为"已完成但无作答记录"）。

### 3. 已完成题目只读回顾

已完成题不可重做，灰色基调展示用户答案、正确答案和解析。用户跳转到已完成题时为只读模式，只有第一个未完成题可作答。

### 4. 新增错题本模式

- 首页新增第四张卡片"错题本"
- 路由 `/quiz?mode=wrongbook&category=xxx`
- 加载全部错题，随机排列，交互同顺序模式
- 答对 → 从错题池移除；答错 → 保留
- 不生成 Attempt 记录，每次进入重新随机排列

### 5. 错题本跟随首页分类选择器

错题本按 category 过滤错题，"全部"模式显示所有错题。无错题时卡片显示"暂无错题"，可点击进入查看空状态。

### 6. 历史记录仅展示随机模式

顺序模式和错题本模式均不写入 attempts 表。旧的顺序模式 Attempt 记录继续展示以保持向后兼容。

## 后果

- 修改 useQuizState hook：initQuiz 支持新的 sequential/wrongbook 参数，新增 submitOne 逐题反馈方法
- 修改 progress store：新增 done 记录 CRUD 方法
- 修改 QuizPage：条件渲染逐题反馈 UI、多选提交按钮、只读回顾状态
- 修改 HomePage：新增错题本卡片
- 更新 CONTEXT.md 领域术语
- 旧顺序进度数据自动迁移

## 相关

- PRD Issue: [#22](https://github.com/cenmiao/kappa/issues/22)
- 此前 ADR: [0002-multi-category.md](./0002-multi-category.md)
- 领域术语: [CONTEXT.md](../../CONTEXT.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
