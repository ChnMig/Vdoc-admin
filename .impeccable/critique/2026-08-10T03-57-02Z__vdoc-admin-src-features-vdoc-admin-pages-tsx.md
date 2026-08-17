---
target: 当前 Vdoc Admin 的闭环与产品逻辑
status: superseded
superseded_by: 2026-08-17T06-29-31Z__vdoc-admin-real-closure-audit.md
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-10T03-57-02Z
slug: vdoc-admin-src-features-vdoc-admin-pages-tsx
---
> 历史审计快照：本文件保留 2026-08-10 当时的问题与评分，不代表当前开放问题。P0/P1/P2 的当前状态与验证证据以 [2026-08-17 真实闭环审计](./2026-08-17T06-29-31Z__vdoc-admin-real-closure-audit.md) 为准。

Method: dual-agent (A: /root/assessment_a · B: /root/assessment_b)

结论：严格说，Vdoc 已有后端能力链路，但还没有完成可信的产品闭环。当前可以手工走通 Team → Project → Document → Draft → Approve → Version → Diff → Token；但 Admin 会过早宣告完成，且没有把正确角色、当前对象、有效状态和 Agent 实际连通绑定成一个可验证结果。

## Design Health Score

| # | Nielsen 启发式 | 分数 | 关键问题 |
|---|---|---:|---|
| 1 | 系统状态可见性 | 2 | 有 loading、badge 和部分状态，但普通 mutation 缺少就地成功/失败反馈，闭环完成度也会误报。 |
| 2 | 系统与现实世界匹配 | 2 | 领域词汇准确，但 Approve/Publish/Promote、Active/Published、Revoked/Expired 等语义混用。 |
| 3 | 用户控制与自由 | 1 | 上下文跨页丢失，多数高风险操作无确认，失败后表单输入被清空。 |
| 4 | 一致性与标准 | 2 | 视觉组件一致，但角色门控、状态命名、复制反馈、撤销确认和安装说明不一致。 |
| 5 | 错误预防 | 1 | 无权限、无效状态、空关联、同分支 Promote 等动作仍可提交，主要依赖后端拒绝。 |
| 6 | 识别优于记忆 | 2 | 页面内 selector 清晰，但用户必须反复记住并恢复 Project/Document/Branch/Version。 |
| 7 | 灵活性与效率 | 1 | 有命令菜单，但没有实体深链、最近上下文、相邻版本比较或生命周期直达。 |
| 8 | 美观与极简 | 3 | 控制台气质克制、易读；重复页头、说明、selector 和常驻创建表单挤占任务空间。 |
| 9 | 错误恢复 | 2 | 分享流程恢复较好；通用表单会在异步成功前 reset，多数 mutation 错误没有局部恢复路径。 |
| 10 | 帮助与文档 | 2 | Next action、empty state 和公共文档有价值，但动作不可点击，部分 MCP/Skill 指引与正式契约冲突。 |
| **总分** |  | **18/40** | **Poor / 较差：视觉底座可靠，工作流模型需在发布前修正。** |

## Design Specificity Verdict

**LLM 评估**：内容是 Vdoc 特有的，交互骨架仍可替换。Project/Document/Branch、不可变 Version、语义 Diff、MCP scope 与 capability share 都很有产品辨识度；但重复 PageChrome、常驻 Create form、集合表格和各自为政的 selector，仍是一套通用 CRUD Admin。准确概括是：**product-authored content inside a category-interchangeable operating model**。

**确定性扫描**：Impeccable CLI 对目标文件返回 0 条规则命中、无 false positive。这只说明没有击中其静态反模式规则，不代表逻辑通过。独立源码/契约核对另外确认了 10 类逻辑问题，包括：3913 行单体承载 11 个页面、表单提前 reset、required relation 可为空、Versions 继承旧 branch filter、危险动作缺少保护、异步/空状态混淆和复制反馈不一致。

**浏览器证据**：当前构建可渲染，但访问 `/versions` 因无认证会话重定向到 `/sign-in?redirect=%2Fversions`；未读取或输入任何凭据。浏览器环境不提供可变注入面，因此没有可靠的用户可见 overlay，也不作 overlay 已显示的声明。工作台判断采用源码、后端契约和现有四张 Dashboard/Documents/Diffs/Versions 截图交叉验证。

## Overall Impression

Vdoc 已经能让人相信它“懂文档生命周期”，但还不能让人相信它“守住了生命周期”。最大的机会不是再加页面，而是建立一个持久的 Project → Document 工作区：当前角色、Branch、Draft 状态、审查证据、Version 和下一步都围绕同一对象展开。

认知负荷偏高：视觉分组与层级合格，但日常页面同时暴露创建、编辑、筛选、审查、内容、Diff、AI 和分享；移动端尤其会先消耗一屏在说明和 selector 上。情绪曲线从 Dashboard 的“安全控制台”承诺开始，在 Draft review 的多动作与弱状态约束处跌到最低，Versions/Diffs 恢复可信度，最后又在 MCP/Skill 的复制粘贴式交接处失去闭环感。

## What’s Working

- 控制平面视觉语言克制、密集但可读。语义表格、带标签 selector、monospace ID、响应式网格和状态文字符合“可信事实控制室”的方向。
- Version/Diff 浏览是最像 Vdoc 的部分：raw/normalized/stable 内容、endpoint 分组与搜索、breaking/must-handle 筛选、Markdown facts 都强化了“已审核事实高于草稿”的层级。
- Public Share 的安全实现值得保留：fragment secret、匿名请求边界、复制失败反馈和 revoke confirm 都比其他危险操作更完整。

## Priority Issues

### [P1] 闭环定义错了，而且上下文不能随流程前进

**为什么重要**：Dashboard 只检查 Team、Project、Document、Branch、任意 Draft、任意 Token；没有 Submitted、Review、Published Version 或 Agent read verification。Branch 在创建 Document 时本就自动生成，撤销/过期 Token 也能贡献 total。卡片还是不可点击的 `div`，并用第一个 Project/Document 代表整个工作区。于是界面可以在尚无已发布事实、尚无可用 Agent 连接时显示“Done”。跨页后 selector 又回到各页本地状态或第一项，无法分享精确 Version/Diff 链接。

证据：[Dashboard 与 selection hooks](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:719)、[onboarding 计算](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:909)。

**修复**：把 readiness 改成选定 Project/Document 下的状态机：Document ready → Draft created → Submitted → Awaiting review → Published Version → active scoped Token → MCP `tools/list`/read tool verified。把实体 ID 放入 URL search params，并让每一步 CTA 直达同一上下文。

**Suggested command**：`$impeccable shape`

### [P1] 角色模型只在后端成立，前端仍向所有人展示同一套控制台

**为什么重要**：Reader/Writer 会看到注定失败的创建、审查和管理动作；Project Admin 的成员管理又依赖 SuperAdmin-only 的 Users API，因此 user picker 为空，核心任务实质受阻。Users/Teams/Projects 导航和表单也不按角色收敛，失败大多只表现为 403 或空数据。

证据：[ProjectsPage 无条件调用用户目录](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:1418)、[后端 Users 权限](/Users/chenming/work/Vdoc/Vdoc/services/vdoc/store.go:569)、[静态导航](/Users/chenming/work/Vdoc/Vdoc-admin/src/components/layout/data/sidebar-data.ts:32)。

**修复**：为选定 Project 生成统一 capability matrix；按角色隐藏或只读化导航与动作，同时提供 Project Admin 可用的受限用户搜索/选择契约。无权限时解释原因，不要展示可点击但必败的按钮。

**Suggested command**：`$impeccable harden`

### [P1] 写入与审查控件会误导用户，且错误恢复不安全

**为什么重要**：Document/Branch 的 Update 只是把原 DTO 原样重发，没有编辑入口；选择 Draft 后表单切成 Update，却不回填所选内容。共享 FormCard 在 mutation 成功前立即 reset，失败输入丢失。Review note 声称属于已选 Draft，但任意行的 Approve/Reject 都会携带同一 note，可能把 Draft A 的意见发给 Draft B；Submit/Request/Reject 也未按状态禁用。多数 archive、权限切换、member removal、approve/reject、token revoke 没有分享撤销已有的确认保护。

证据：[FormCard reset](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:525)、[Document Update 原样重发](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:1826)、[review mutation](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:2153)、[Draft row actions](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:2521)。

**修复**：将 Draft review 改为单一 selected-draft console，把 note、diff、content、AI 与 valid action 绑定到同一 draft ID；由实体状态机产出允许动作。表单只在成功后 reset，失败保留值并显示局部错误。补真实 edit mode 与一致的 destructive confirm。

**Suggested command**：`$impeccable harden`

### [P1] 状态词和操作顺序没有忠实表达后端事实

**为什么重要**：共享 `statusLabel` 让 Published Version 显示 Active、Disabled User 显示 Archived；Token 状态 3 Expired 被显示为 Revoked，Draft Published 被称为 Approved。Diff change type 4–10 会显示 `Unknown n`。文案又暗示“Approve 后再 Promote”，但 Approve 已直接发布 Version，而 Promote 实际创建跨分支 Draft。审查动作还出现在 diff/content/AI 证据之前。

证据：[共享状态映射](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:212)、[后端枚举](/Users/chenming/work/Vdoc/Vdoc/common/vdoc/codes.go:1)。

**修复**：按实体建立 typed status/change maps；将 Promote 统一命名为“Create promotion draft / 创建晋级草稿”。审查顺序改为状态与来源 → machine diff/content → optional AI → review note → 唯一有效主动作。

**Suggested command**：`$impeccable clarify`

### [P2] MCP、Skill 与分享都停在复制粘贴，没有证明交付成功

**为什么重要**：Admin 生成 direct HTTP + raw Authorization header；PRD、站点文档和 `Vdoc-mcp` 的正式路径却是 `npx -y @vdoc/mcp` + `VDOC_BASE_URL` + `VDOC_MCP_TOKEN`。Skill 页面又要求 `cp -R Vdoc-skill ...`，只适合拥有源码 checkout 的开发者。没有 client profile、下载/安装入口、secret-safe copy 状态、`tools/list` 测试或有效权限解释。Public Share 也列出所有 active branch，而未先约束“必须已有 Published Version”。

证据：[Admin MCP/Skill 输出](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/pages.tsx:3663)、[正式 MCP 示例](/Users/chenming/work/Vdoc/Vdoc-mcp/README.md:61)、[分享创建条件 UI](/Users/chenming/work/Vdoc/Vdoc-admin/src/features/vdoc-admin/document-share-panel.tsx:226)。

**修复**：明确每类客户端的 canonical connection profile，默认输出正式 stdio adapter 配置；提供 Skill 下载/安装方式与连接测试，展示 effective permission = token scope × project role。分享入口移到 Published Version/eligible branch 上，并把缺少版本作为前置状态而非通用错误。

**Suggested command**：`$impeccable onboard`

## Persona Red Flags

**首次使用的 Project Admin**：Dashboard 可能展示另一个第一项目的角色；setup 卡不跳转；Document 创建后已自动建 branch 却仍提示手工建；成员选择器拿不到用户目录；没有资格的分享功能直接消失而不解释所需角色。

**Writer / Reviewer**：Reader 看见 Create/Submit，Writer 看见 Approve/Reject；五个 Draft 行动作缺少状态引导；review note 可能落到另一行；Approve 已发布但文案暗示还有 Promote；高风险动作位于证据之前。

**Frontend / MCP user**：无法收藏精确 Project/Document/Version/Diff；版本下拉只显示可能重复的 version name，缺少 branch；部分 diff 类型变 Unknown；Admin 与正式 stdio 安装指引像两套规范；无法证明 token、adapter、Skill 和 backend tools 已连通。

## Minor Observations

- Versions 切换 Project/Document 时没有清掉旧 branch filter，可能以旧 branch ID 查询新上下文。
- NativeSelect 自带空 placeholder，Drafts/Versions 又显式加入一个空值 All，出现重复选项；关联字段也无法声明 required。
- Branch 创建未提示只接受 `dev`、`test`、`prod` 或 `feature/*`，而前三者已自动创建。
- MCP expiry 是自由文本 ISO date；expired token 仍显示 Revoked，revoke 也没有确认。
- Token copy 不报告成功/失败，而 Public Share 已有可复用的 `role=status` 反馈模式。
- AI chat session 一旦离开页面没有列表或恢复入口，持久化会话在 UI 中变成孤儿。
- Sidebar 的 Team Switcher 是静态品牌控件，并不代表当前 Team/Project。
- 3913 行页面单体不是直接的用户缺陷，但会持续放大状态、权限和反馈逻辑漂移。

## Questions to Consider

- Vdoc 的主导航单位究竟应是 11 个实体页，还是一个持久的 Project → Document workspace？
- 如果 Approve 就是 Publish，Promote 是否只应出现在 branch workflow，并明确叫“创建晋级草稿”？
- “闭环完成”的最低证据是存在 Version，还是 Agent 已用 active token 成功读取该 Published Version？
