# DataRefiner — AI非标数据清洗工坊

为中小企业提供 AI 辅助的非标数据清洗服务。上传混乱的 Excel/CSV/ERP 数据导出文件，AI 自动诊断质量问题，生成清洗方案，一键执行。

## 核心流程

```
上传文件 → AI自动诊断 → 查看健康报告 → 确认清洗方案 → 执行清洗 → 预览结果 → 下载
```

## 文档

| 文档 | 说明 |
|------|------|
| [PRD.md](docs/PRD.md) | 产品需求文档 — 定位、用户画像、功能模块、MVP范围 |
| [technical-design.md](docs/technical-design.md) | 技术设计文档 — 架构、数据库、API、引擎设计 |
| [ux-design.md](docs/ux-design.md) | UI/交互设计文档 — 页面布局、交互流程、组件清单 |

## 技术栈

| 层面 | 技术 |
|------|------|
| 运行时 | Node.js 22 + TypeScript 5.9 |
| 后端 | Express 4 + SQLite (better-sqlite3) |
| 前端 | React 18 + Vite 5 + react-router-dom 7 |
| AI | LangChain + Claude/OpenAI |
| 实时 | WebSocket (ws) |
| 容器化 | Docker Compose |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 构建共享类型包
npm run build --workspace @datarefiner/shared

# 3. 启动开发环境（前后端同时启动）
npm run dev

# 或使用 Docker Compose 一键启动
docker compose up

# 访问
前端: http://localhost:5173
API:  http://localhost:4001/api
```

## 环境变量

在项目根目录创建 `.env` 文件（参考 `.env.example`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端端口 | 4001 |
| AI_API_KEY | LLM API Key（可选，不设置则使用规则引擎） | - |
| AI_MODEL | LLM模型名 | claude-haiku-4-5-20251001 |
| JWT_SECRET | JWT签名密钥 | dev-secret-change-in-production |
| DB_PATH | SQLite文件路径 | ./datarefiner.db |
| UPLOAD_DIR | 上传文件目录 | ./uploads |
| LOG_LEVEL | 日志级别 | info |

## 项目结构

```
datarefiner/
├── apps/
│   ├── server/      # Express 后端
│   └── web/         # React 前端
├── packages/
│   └── shared/      # 前后端共享类型
├── docs/            # 产品文档
├── uploads/         # 文件存储（自动创建）
└── docker-compose.yml
```

## License

MIT