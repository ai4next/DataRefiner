# AI非标数据清洗工坊 — 技术设计文档

> 版本: v1.0 | 状态: Final | 最后更新: 2026-05-10

---

## 1. 系统架构

### 1.1 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                Web (React 18 + Vite 5)                    │
│  react-router-dom + i18next + WebSocket Client            │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTP REST API + WebSocket
┌─────────────────────────▼────────────────────────────────┐
│               Server (Express + TypeScript)                │
│                                                           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ 用户模块  │  │ 文件管理模块  │  │ 诊断引擎           │   │
│  │ JWT认证   │  │ multer上传   │  │ xlsx逐列profile    │   │
│  │ 套餐计费  │  │ 生命周期管理  │  └─────────┬─────────┘   │
│  └──────────┘  └──────────────┘            │              │
│                                             │             │
│  ┌──────────┐  ┌──────────────┐  ┌─────────▼──────────┐   │
│  │ 清洗引擎  │  │ 导出模块      │  │ AI分析模块          │   │
│  │ 策略模式  │  │ xlsx/csv/    │  │ LangChain+LLM      │   │
│  │ 可逆执行   │  │ PDF报告       │  │ 采样分析+规则兜底   │   │
│  └──────────┘  └──────────────┘  └────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  异步任务（inline处理，WebSocket推送进度）            │   │
│  │  诊断/清洗执行 → 异步处理，实时进度推送                │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────┬──────────────────────────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
    ┌────▼────┐ ┌──▼───┐ ┌───▼─────┐
    │ SQLite   │ │ File  │ │ In-     │
    │ (业务数据 │ │ System│ │ Memory  │
    │ 模板/    │ │ up-   │ │ (会话/  │
    │ 计费)    │ │ loads/ │ │ 缓存)   │
    └─────────┘ └───────┘ └─────────┘
```

### 1.2 技术选型

| 层面 | 技术 | 理由 |
|------|------|------|
| 运行时 | Node.js 22 + TypeScript 5.9 | 全栈统一语言，类型安全 |
| 后端框架 | Express 4 | 轻量、灵活、已验证的架构 |
| 数据库 | SQLite (better-sqlite3) | 零配置、适合MVP、私有部署友好 |
| 数据读取 | xlsx (SheetJS) / csv-parse | Excel/CSV解析 |
| 校验 | Zod | 类型安全的运行时校验 |
| AI/LLM | LangChain + Claude/OpenAI | 统一AI集成方式 |
| 日志 | pino | 高性能结构化日志 |
| 实时通信 | ws (WebSocket) | 双向实时推送进度 |
| 前端框架 | React 18 | 组件化生态丰富 |
| 构建工具 | Vite 5 | 快速HMR、代理转发 |
| CSS | 纯CSS（组件化文件） | 轻量无额外依赖 |
| 路由 | react-router-dom 7 | SPA路由 |
| 国际化 | i18next | 中英文支持 |
| 共享类型 | packages/shared | 前后端类型统一 |
| 容器化 | Docker Compose | 开发+私有部署同一套配置 |
| 定时任务 | node-cron | 每日过期数据清理 |
| PDF生成 | PDFKit | 清洗报告导出 |

---

## 2. 项目结构

```
datarefiner/
├── apps/
│   ├── server/                  # Express 后端
│   │   └── src/
│   │       ├── main.ts          # 入口: Express + WebSocket + Cron
│   │       ├── routes/          # API 路由
│   │       │   ├── auth.routes.ts
│   │       │   ├── files.routes.ts
│   │       │   ├── diagnosis.routes.ts
│   │       │   ├── cleaning.routes.ts
│   │       │   ├── templates.routes.ts
│   │       │   └── billing.routes.ts
│   │       ├── controllers/     # 请求处理
│   │       │   ├── auth.controller.ts
│   │       │   ├── files.controller.ts
│   │       │   ├── diagnosis.controller.ts
│   │       │   ├── cleaning.controller.ts
│   │       │   └── billing.controller.ts
│   │       ├── services/        # 核心业务逻辑
│   │       │   ├── diagnosis-engine.ts  # 诊断引擎
│   │       │   ├── cleaning-engine.ts   # 清洗引擎（9种动作）
│   │       │   ├── ai-analyzer.ts       # AI分析
│   │       │   ├── file-manager.ts      # 文件管理
│   │       │   └── exporter.ts          # 导出模块
│   │       ├── lib/             # 基础设施
│   │       │   ├── db.ts                # SQLite连接
│   │       │   ├── schema/              # SQL建表文件
│   │       │   │   ├── system.sql
│   │       │   │   └── business.sql
│   │       │   ├── logger.ts            # pino日志
│   │       │   ├── llm.ts               # LangChain封装
│   │       │   └── event-bus.ts         # 事件总线
│   │       ├── middleware/      # Express中间件
│   │       │   ├── error-handler.ts
│   │       │   ├── request-logger.ts
│   │       │   ├── validate.ts  # Zod校验
│   │       │   └── auth.ts      # JWT认证
│   │       ├── websocket/       # WebSocket服务器
│   │       │   └── ws-server.ts
│   │       └── workers/         # 异步任务（预留）
│   │           ├── diagnosis-worker.ts
│   │           └── cleaning-worker.ts
│   │
│   └── web/                     # React前端
│       └── src/
│           ├── main.tsx         # 入口
│           ├── App.tsx          # 路由配置
│           ├── components/
│           │   ├── landing/     # 首页
│           │   ├── upload/      # 上传页
│           │   ├── diagnosis/   # 诊断报告
│           │   ├── cleaning/    # 清洗方案
│           │   ├── result/      # 结果预览
│           │   ├── dashboard/   # 工作台看板
│           │   ├── templates/   # 模板管理
│           │   ├── settings/    # 账户设置
│           │   └── common/      # 通用（Login/TaskWizard/TaskHistory）
│           ├── hooks/           # 自定义Hooks
│           ├── lib/             # API封装
│           ├── styles/          # CSS组件
│           └── i18n.ts          # 国际化
│
├── packages/
│   └── shared/                  # 共享类型定义
│       └── src/
│           ├── types.ts
│           └── index.ts
│
├── uploads/                     # 文件存储目录（gitignored）
├── docker-compose.yml
├── package.json                 # npm workspaces根
└── tsconfig.base.json
```

---

## 3. 数据库设计

### 3.1 设计原则

- 使用 **SQLite (better-sqlite3)**，零配置启动
- SQL建表文件放在 `lib/schema/` 目录，启动时自动初始化
- 主键使用 TEXT 类型的 UUID v4
- 非结构化数据（诊断报告、清洗方案）使用 JSON 列存储
- 文件路径使用相对路径，基于 `uploads/` 目录
- 外键 ON DELETE CASCADE 保证数据一致性

### 3.2 表结构

**users** — 用户表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| phone | TEXT UNIQUE | 手机号 |
| company_name | TEXT | 公司名（可选） |
| plan_type | TEXT | free/basic/pro/enterprise |
| monthly_quota | INTEGER | 月配额行数 |
| used_quota | INTEGER | 已使用行数 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

**files** — 文件表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK | 所有者 |
| original_name | TEXT | 原始文件名 |
| stored_path | TEXT | 存储路径 |
| file_size | INTEGER | 文件大小（字节） |
| row_count | INTEGER | 行数 |
| col_count | INTEGER | 列数 |
| encoding | TEXT | 编码 |
| status | TEXT | uploaded/diagnosing/diagnosed/planning/cleaning/completed/expired |
| uploaded_at | TEXT | 上传时间 |
| expires_at | TEXT | 过期时间（+7天） |

**diagnosis_reports** — 诊断报告

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| file_id | TEXT FK UNIQUE | 关联文件 |
| report_json | TEXT | JSON: 列profile + 健康评分 |
| ai_suggestions_json | TEXT | JSON: AI建议 |
| created_at | TEXT | 创建时间 |

**cleaning_plans** — 清洗方案

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| file_id | TEXT FK UNIQUE | 关联文件 |
| plan_json | TEXT | JSON: 动作列表 |
| status | TEXT | draft/confirmed/running/done |
| created_at | TEXT | 创建时间 |
| confirmed_at | TEXT | 确认时间 |

**cleaning_results** — 清洗结果

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| plan_id | TEXT FK | 关联方案 |
| file_id | TEXT FK | 关联文件 |
| result_file_path | TEXT | 结果文件路径 |
| stats_json | TEXT | JSON: 统计信息 |
| created_at | TEXT | 创建时间 |

**cleaning_templates** — 清洗模板

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK | 所有者 |
| name | TEXT | 模板名称 |
| template_json | TEXT | JSON: 动作列表 |
| source_columns | TEXT | 源列名（逗号分隔） |
| created_at | TEXT | 创建时间 |

**billing_records** — 计费记录

| 列名 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| user_id | TEXT FK | 用户 |
| file_id | TEXT FK | 关联文件 |
| rows_processed | INTEGER | 处理行数 |
| deducted_at | TEXT | 扣费时间 |

---

## 4. 诊断引擎设计

### 4.1 架构

```
输入: ParsedData (headers + rows)
     │
     ▼
┌──────────────────────────────────────┐
│          ColumnProfiler              │
│  (逐列执行)                           │
│                                      │
│  1. 类型推断器                        │
│     - 正则匹配: 日期/数字/手机/邮箱   │
│     - 兜底: 文本                      │
│                                      │
│  2. 空值检测                          │
│     - null / undefined / '' 计数     │
│                                      │
│  3. 重复行检测                        │
│     - 完全重复行检测与计数             │
│                                      │
│  4. 异常值检测                        │
│     - 数值: IQR                      │
│     - 文本: 长度分布                  │
│                                      │
│  5. 格式一致性检测                     │
│     - subtype占比分析                 │
│                                      │
│  6. 采样                             │
│     - head(10) 样本                  │
└──────────┬───────────────────────────┘
           │
           ▼
     DiagnosisResult (JSON-serializable)
```

### 4.2 类型推断优先级

```
1. null/undefined/空串 → "null"
2. 全数字串 + 长度=11 → "phone"
3. 匹配日期模式 → "date"
4. 匹配 ^1[3-9]\d{9}$ → "phone"
5. 匹配 ^\d{17}[\dXx]$ → "id_card"
6. 匹配邮箱正则 → "email"
7. 匹配 URL 正则 → "url"
8. 匹配 ^[+-]?\d+(\.\d+)?$ → "number"
9. 匹配金额模式（含¥$元等） → "amount"
10. 以上都不匹配 → "text"
```

### 4.3 健康评分算法

```
score = 100
- 每有空值列(rate>5%) → -5
- 每有格式不一致列(consistency<80%) → -5
- 每有异常值列 → -3
- 有完全重复行 → -10
- 取 max(0, score)
```

---

## 5. AI 分析模块

### 5.1 设计原则

**LLM只分析采样+元数据，绝不读全量数据。**

理由：
- 成本控制：采样+profile控制在1000 tokens内
- 速度：不需要等全量执行完毕
- 隐私：用户数据不上送LLM，只送统计信息和样本

### 5.2 LangChain 集成

```typescript
const model = new ChatAnthropic({
  model: "claude-haiku-4-5-20251001",
  temperature: 0,
});
```

### 5.3 流程

1. 诊断引擎完成 → 产出 profile dict
2. 采样器提取每列 10个典型值 + 列统计信息
3. 构造 LangChain prompt
4. 调用 LLM
5. 解析返回的 JSON
6. 合并: LLM建议 + 规则引擎建议 → 去重 → 排序
7. 返回给前端展示

### 5.4 降级策略

当 LLM 调用失败或 API Key 未配置时，自动降级为规则引擎生成的建议：
- 空值 > 5% → fill_null
- 日期格式不一致 → format_date
- 手机号含分隔符 → clean_phone
- 金额含单位 → format_number
- 全部列 → trim_whitespace

---

## 6. 清洗引擎设计

### 6.1 策略模式

9种清洗动作注册在 actionRegistry 中，统一接口：

```typescript
type ActionExecutor = (rows: Row[], headers: HeaderRow, params: Record<string, unknown>)
  => { rows: Row[]; log: OperationLog };
```

### 6.2 支持的清洗动作

| Action | type | 逻辑 |
|--------|------|------|
| DropDuplicates | remove_duplicates | 按指定列去重，保留首次出现行 |
| FillNull | fill_null | 空值填充指定内容 |
| FormatDate | format_date | 统一日期格式为 yyyy-MM-dd |
| FormatNumber | format_number | 移除非数字字符（¥、元、$等） |
| TrimWhitespace | trim_whitespace | 去掉文本前后空格 |
| CleanPhone | clean_phone | 移除手机号中的空格和横杠 |
| SplitColumn | split_column | 按分隔符拆分一列为多列 |
| MergeColumns | merge_columns | 多列按分隔符合并为一列 |
| RemoveOutliers | remove_outliers | 按IQR移除数值异常行 |

---

## 7. API 设计

### 7.1 端点清单

| Method | Path | 说明 |
|--------|------|------|
| POST | /api/auth/login | 手机号验证码登录（自动注册） |
| GET | /api/auth/me | 获取当前用户信息 |
| POST | /api/files/upload | 上传文件（multipart） |
| GET | /api/files | 用户文件列表 |
| GET | /api/files/:id | 获取文件详情 |
| GET | /api/files/:id/preview | 预览前100行 |
| DELETE | /api/files/:id | 手动删除文件 |
| POST | /api/files/:id/diagnose | 触发诊断（异步） |
| GET | /api/files/:id/diagnosis | 获取诊断结果 |
| GET | /api/files/:id/plan | 获取/自动生成清洗方案 |
| POST | /api/files/:id/plan/generate | AI生成清洗方案 |
| PUT | /api/files/:id/plan | 更新清洗方案（确认） |
| POST | /api/files/:id/clean | 执行清洗（异步） |
| GET | /api/files/:id/result/preview | 清洗后预览 |
| GET | /api/files/:id/result/download?format=xlsx|csv | 下载结果文件 |
| GET | /api/files/:id/result/report | 下载清洗报告PDF |
| GET | /api/templates | 用户模板列表 |
| POST | /api/templates | 保存为模板 |
| DELETE | /api/templates/:id | 删除模板 |
| GET | /api/billing/usage | 当前用量 |
| GET | /api/billing/records | 消费记录 |
| GET | /api/health | 健康检查 |

### 7.2 WebSocket 事件

```
连接: ws://host/ws?sessionId={fileId}

服务端推送事件:
  { sessionId, type: 'progress'|'complete'|'error', stage: 'diagnose'|'clean'|'export',
    data: { progress?: 0-1, message?: string, resultId?: string, error?: string } }
```

---

## 8. 文件管理

### 8.1 上传校验

1. 扩展名白名单: [.xlsx, .xls, .csv, .tsv]
2. 魔数校验: .xlsx → PK\x03\x04, .xls → \xD0\xCF\x11\xE0
3. 文件大小 ≤ 100MB

### 8.2 存储路径

```
uploads/
├── {file_id}_原始文件名.ext     # 原始文件（UUID重命名防冲突）
├── {resultId}_清洗结果.xlsx     # 清洗结果
└── {resultId}_报告.pdf          # 清洗报告
```

### 8.3 生命周期管理

node-cron 每天凌晨2点执行：
- 查询 expires_at < now() 的文件
- 删除文件系统中的对应文件
- 更新数据库 status = 'expired'
- 关联数据通过 ON DELETE CASCADE 自动清理

### 8.4 下载

- 直接文件下载（MVP阶段不设过期链接）
- 用户只能操作自己的文件（路由中间件鉴权）

---

## 9. 部署

### 9.1 开发环境 (Docker Compose)

```yaml
services:
  server:4001  → Express + tsx watch
  web:5173     → Vite Dev Server (代理 /api → server:4001)
```

启动: `docker compose up`
访问: http://localhost:5173

### 9.2 生产环境推荐

- 云服务器: 2C4G 起步
- 数据库: SQLite文件
- 前端: Vite build → Nginx托管
- 反向代理: Nginx + Let's Encrypt (HTTPS)
- 备份: 定时备份 SQLite文件和 uploads/ 目录

---

## 10. 关键依赖

| 包 | 用途 |
|----|------|
| express | Web框架 |
| better-sqlite3 | SQLite数据库 |
| xlsx (SheetJS) | Excel读写 |
| csv-parse | CSV解析 |
| zod | 校验 |
| multer | 文件上传 |
| uuid | ID生成 |
| jsonwebtoken | JWT认证 |
| pino | 日志 |
| ws | WebSocket |
| @langchain/core/anthropic | AI集成 |
| node-cron | 定时任务 |
| pdfkit | PDF生成 |