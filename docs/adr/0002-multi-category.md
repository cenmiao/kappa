# ADR 0002: 多题库分类支持

## 状态

已接受（2026-06-25）

## 背景

题库源文件为 tiku/ 目录下 4 套 .docx 文件，分属不同知识领域（综合管理、税务公共知识、政治理论、强基培训）。用户需要能够选择"全部"或单选某套题库进行练习，错题池和进度需按题库分类隔离。

原 PRD（0001-prd.md）将"多题库支持"列为 Out of Scope。本次 PRD（Issue #12）正式纳入需求，重构数据模型和应用架构以支持多题库分类。

## 决策

### 1. 题库分类标识：字符串类型 category 字段

Question、WrongAnswer、Attempt 均新增 `category: string` 字段。"全部"模式用固定字符串 `"全部"` 表示，非空值。

### 2. 题库选择交互：首页下拉框 + URL 参数 + localStorage 记忆

用户在首页通过下拉框选择题库，选择结果通过 URL 参数 `?category=xxx` 传递给所有子页面。localStorage 记忆上次选择作为默认值。缺少 category 参数时重定向回首页并 Toast 提示。

### 3. 全局上下文设计：首页单选，子页面只读

题库选择是全局上下文——用户在首页选好，所有子页面自动以该题库为范围。切换题库的唯一路径是回到首页重新选择。

### 4. 转换脚本简化：单文件多合并流程

废弃原双文件交叉验证逻辑（parseQuestionWithoutAnswer、crossValidate）。脚本扫描 tiku/ 目录下所有 .docx，按文件名首字符排序后合并。合并后按文件顺序重新分配全局递增 ID，category 从文件名【xxx】提取。

### 5. 数据库升级 v3 → v4

wrongAnswers 和 attempts store 新增 category 索引。升级时静默清空旧 wrongAnswers 和 old attempts 数据。

### 6. 随机模式出题策略

单套题库题量不足时允许重复并提示用户。缺失题型配额弹性分配给其他题型，总题数保持 80，总分恒定 100。错题强化按 category 过滤。

### 7. 顺序模式进度独立

每种题库分类（含"全部"）拥有独立的顺序练习进度。progress key 格式为 `sequential:分类名`。

### 8. 管理面板实时统计

题目数量分布从 questions 表实时按 category 分组统计，不依赖 meta 字段。

## 后果

- 新增 3 个 Question/WrongAnswer/Attempt 字段
- 新增首页下拉框组件
- 修改 6 个 DB 函数签名 + 过滤逻辑
- 数据库升级 v3 → v4
- 重写题库转换脚本
- 旧 attempt/wrongAnswer 数据在升级时清空

## 相关

- PRD Issue: [#12](https://github.com/cenmiao/kappa/issues/12)
- 此前 ADR: [0001-prd.md](./0001-prd.md)
- 领域术语: [CONTEXT.md](../../CONTEXT.md)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
