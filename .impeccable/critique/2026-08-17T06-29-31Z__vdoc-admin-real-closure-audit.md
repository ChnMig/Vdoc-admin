---
target: Vdoc Admin 真实全栈闭环与产品逻辑
total_score: 40
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
p2_count: 0
timestamp: 2026-08-17T06-29-31Z
updated_at: 2026-08-17T11:11:36Z
slug: vdoc-admin-real-closure-audit
---

Method: source/contract audit + production Docker Compose + real PostgreSQL/RustFS + real MCP stdio transport + private sanitized usage readback + unit/integration/browser/build verification + one final Impeccable detector pass. The project has not launched, so the audit evaluates the current clean product path without adding a historical-compatibility gate.

结论：**当前可由工程实现和本地真实环境验证的 P0/P1/P2 已清零，Vdoc 是外部 Pilot 候选，不是已上线产品。** Team → active Project → active Document → active Branch → Draft submit/review → immutable Published Version → MCP published-content read → sanitized usage evidence 已形成同一条可复核状态链。精确 Project/Document/Branch/Draft/Version/Endpoint/Diff/Token 上下文由 URL 承载；无效或越权深链保持空选择并明确提示，不静默选择其他实体。Public Share 的创建、匿名读取、历史、下载、密码与撤销边界仍独立成立。

## Design Health Score

| # | Nielsen 启发式 | 分数 | 当前结论 |
|---|---|---:|---|
| 1 | 系统状态可见性 | 4 | Loading、错误、生命周期状态、Token 状态与真实 `published_content_read` Agent activity 分离展示。 |
| 2 | 系统与现实世界匹配 | 4 | Approve 创建不可变 Published Version；Promote 创建晋级草稿；MCP 不可直接发布。 |
| 3 | 用户控制与自由 | 4 | 关键操作绑定精确实体且二次确认；Share/Token 可单独撤销；错误可恢复。 |
| 4 | 一致性与标准 | 4 | active/current、角色、状态、Diff、原生 select 和中英文语义一致。 |
| 5 | 错误预防 | 4 | 审核、归档、撤销、失效和 AI 交互均受真实状态与权限门控。 |
| 6 | 识别优于记忆 | 4 | URL、实体名、masked ID、版本对、工具名和审计目标共同提供可识别上下文。 |
| 7 | 灵活性与效率 | 4 | 精确实体 URL 可复制、刷新、跨页面保留；Diff ID 可恢复 immutable version pair。 |
| 8 | 美观与极简 | 4 | 工作台层级、证据区、操作区和错误提示清楚，无 detector 命中。 |
| 9 | 错误恢复 | 4 | Backend 中断、无效深链、过期/撤销 Token 与异步竞态均有显式恢复或隔离。 |
| 10 | 帮助与文档 | 4 | API、OpenAPI、Pilot、部署、stdio 黑盒验收和发布边界均有可执行说明。 |
| **总分** |  | **40/40** | **工程与本地真实环境范围内闭环；外部发布仍由独立 gate 决定。** |

## Closure Matrix

| 闭环 | 通过条件 | 实际证据 | 结果 |
|---|---|---|---|
| Workspace readiness | 当前 Project/Document 的真实状态均满足 | Dashboard 只认可 active entities、published Version 与成功 published read | Pass |
| Draft review | selected submitted Draft 经明确审核产生 immutable Version | 定向与全量 Admin 测试、Backend E2E | Pass |
| Semantic Diff | 真变化被识别，nil/empty 不制造假变化 | Backend semantic-diff 回归与 `make verify` | Pass |
| Exact deep link | URL 恢复精确实体，无效/越权时不回退 | Project/Document/Branch/Draft/Version/Endpoint/Diff/Token 测试；invalid Token 不请求或复用 all-owned usage | Pass |
| MCP capability | 可安装 stdio adapter 发现工具并读取发布内容 | 黑盒部署返回 18 tools，精确 endpoint 读取成功 | Pass |
| MCP audit evidence | 只记录脱敏、可信、可归属的读取证据 | `adapter=stdio`、`evidence_kind=published_content_read`、精确 canonical IDs；失败调用不保留请求方实体 ID | Pass |
| Secret boundary | usage 不返回 secret/schema/content/IP/User-Agent | 部署态 raw response 禁止值扫描通过；Token 深链不自动 reveal | Pass |
| Public Share | 创建后匿名可读，撤销后不可复用 | Admin/Backend 单元、集成和浏览器业务测试 | Pass |
| Pilot integrity | 自动化不能冒充目标用户与签字 | 四类 target-user role、逐角色 criteria/feedback、证据 hash、双人签字负矩阵 | Pass |
| Persistence | PostgreSQL/RustFS 跨进程保存真实状态 | `vdoc-e2e.sh live-compose` 完整通过 | Pass |

## Resolved P2 Boundaries

- 精确深链：父级 authenticated search schema 承载所有稳定实体 ID；页面选择更新 URL，Sidebar、Command Menu 和 CTA 保留 search。无效/越权实体保持空选择并显示具体目标；Token URL 变化会立即清除明文、复制状态和过期异步结果。
- Agent 读取证据：Backend 为 `tools/list` 与 MCP tool call 写审计；成功发布内容读取标记 `published_content_read`。usage API 按 owner 限定，SuperAdmin 仅能在显式 `token_id` 下跨 owner；metadata 白名单且不返回请求内容、secret、IP 或 User-Agent。
- 审计可信度：tool name 只接受已知枚举；实体 ID 只接受 canonical 32 位小写十六进制，并且仅在工具成功后记录。stdio 必须同时匹配固定 User-Agent 与 adapter header；其他调用记为 direct。
- Pilot 闭环：`project_admin`、`writer`、`reader`、`external_reader` 均必须是 target user，执行角色映射 criteria，并在 Pilot 窗口内提交有 hash 证据的 verbatim feedback。Staff、缺角色、缺反馈、同人签字、篡改、路径逃逸、symlink、secret 与 workspace 漂移均不能关闭 gate。
- 可重复部署证据：`npm run verify:live-audit` 在显式确认的空白 loopback 部署中完成注册、发布、真实 stdio 读取、usage 回读、脱敏断言、Token revoke 与 Project archive。脚本要求写入前空库确认，并提供隔离 Compose 端口/卷流程。

## Verification Evidence

- Admin Vitest：43 files，332/332 tests passed；深链/Token/状态机主文件 59/59 passed。
- Admin quality gates：ESLint、Prettier、TypeScript 与 Vite production build 全通过；构建无 TanStack 分包告警。
- Playwright：5 passed；1 个 capability-gated live marker probe 按设计 skipped。
- Impeccable detector：本轮 UI 冻结后仅执行一次，exit 0，JSON `[]`。
- Backend：`make verify` 通过，覆盖全量 test、vet、race、build 与 module verification；MCP/private/services/E2E 定向回归通过。
- Live persistence：`./scripts/vdoc-e2e.sh live-compose --env-file ../.env` 通过，真实 PostgreSQL/RustFS 依赖 ready。
- Vdoc MCP：24/24 tests passed；最终隔离部署黑盒结果为 `status=pass`、`adapter=stdio`、`published_content_read`、2 usage events、18 tools，secret/schema/content/IP/User-Agent 均 absent。
- Root gates：Pilot 正负矩阵、release harness、workspace contracts、Compose provisioning、local bootstrap 与 workspace lock tests 通过。

## Remaining External Release Gates

这些不是剩余工程 P2，也不能由本次 agent 自行伪造为完成：

1. 各子仓提交后重建 `workspace.lock.json` 与 control-plane digest。当前 dirty worktrees 与旧 digest 不一致，因此 workspace package/full release gate 按设计失败。
2. 四类真实目标用户完成受控 Pilot，保留同意记录、任务证据和原始反馈；两名不同真人完成 payload-bound sign-off。
3. 在目标部署平台验证 TLS/反向代理、备份恢复、外部 Agent 安装和不可变证据存储；发布 bootstrap 与 checksum 到真实不可变地址。

## Release Boundary

当前准确口径是：**工程闭环完成、本地 production-like 候选通过、可以进入外部 Pilot；尚不能宣称上线闭环完成。** 最终 `verifier_status` 仍由干净 workspace、真人 Pilot、独立签字和目标部署证据共同决定。
