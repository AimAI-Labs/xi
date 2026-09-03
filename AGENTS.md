# xi 项目工程与协作规范 (AGENTS.md)

本文件是 `xi` 项目的最高工程规范与架构指引，适用于所有参与本项目的 AI Coding Agent 及人类开发者。在着手任何设计、编码或调试任务前，必须通读并严格遵守本规范。

---

## 1. 核心理念与开发哲学 (Philosophy & Principles)

- **极简至上 (KISS - Keep It Simple, Stupid)**：
  - 崇尚清晰、简洁、高内聚的代码结构，避免过度工程化、冗余层级与无意义的防御性抽象。
  - 非必要不引入额外第三方依赖，优先利用现代 Node.js 原生 API 与已有的轻量工具。
- **第一性原理 (First Principles Thinking)**：
  - 立足于终端人机交互（TUI）与 Agent 执行循环（ReAct）的本质进行剖析与设计。
  - 选用极速、高确定性的现代工程化工具链（如 Rust 驱动的 OXC 工具链、严谨轻量的 `smol-toml`）。
- **事实为本 (Fact-Driven)**：
  - 以真实运行输出和测试结果为最高准则。严禁未经测试或未见验证证据就做出“已修复/已完成”的断言。

---

## 2. 技术栈与环境规范 (Tech Stack & Environment)

| 维度             | 规范 / 选型                                             | 说明                                                       |
| :--------------- | :------------------------------------------------------ | :--------------------------------------------------------- |
| **运行时**       | Node.js `>= 22`                                         | 采用原生 ECMAScript Modules (`"type": "module"`)           |
| **开发语言**     | TypeScript 5.x                                          | 严格类型检查模式 (`tsconfig.json` & `tsconfig.build.json`) |
| **终端 UI 引擎** | React 18 + [Ink 4](https://github.com/vadimdemedes/ink) | 终端交互式命令行组件化渲染                                 |
| **CLI 解析**     | `meow 11`                                               | 极简优雅的命令行参数解析                                   |
| **配置格式**     | `smol-toml 1.8`                                         | 严格遵循 TOML v1.0.0 规范，配置文件为全局 `~/.xi.toml`     |
| **代码格式化**   | `oxfmt 0.66.x`                                          | 极速 Rust 原生格式化工具，**严禁**使用 Prettier            |
| **代码检查**     | `oxlint 1.81.x`                                         | 极速 Rust 原生静态检查工具，**严禁**使用 ESLint            |
| **测试体系**     | `ava 5.x` + `tsx` + `ink-testing-library 3.x`           | 通过 `--import=tsx` 直接执行 ESM TypeScript 测试           |
| **开发平台**     | Windows 本地开发优先                                    | 兼容 PowerShell 命令语法；跨平台兼容 macOS / Linux         |

---

## 3. 系统架构与目录拓扑 (Architecture & Layout)

项目的源码位于 `src/` 目录下，测试位于 `test/` 目录下。

```text
xi/
├── src/
│   ├── cli.tsx                     # CLI 主入口，参数解析与多模式分发
│   ├── app.tsx                     # 简单问候组件（基础 Demo）
│   ├── agent/                      # Agent 核心运行时与模型交互层
│   │   ├── index.ts                # 统一导出入口
│   │   ├── types.ts                # Agent、工具、消息、追踪等核心类型定义
│   │   ├── AgentRuntime.ts         # ReAct 核心循环机（Thought -> Tool Call -> Observation -> Answer）
│   │   ├── LLMClient.ts            # 模型客户端抽象、OpenAI 兼容客户端及 Mock 客户端
│   │   ├── ToolRegistry.ts         # 工具注册中心，负责 Schema 生成与安全容错调用
│   │   ├── ContextManager.ts       # 上下文管理：MicroCompact 历史裁剪与滑动窗口控制
│   │   ├── SessionStore.ts         # 多会话隔离存储机
│   │   ├── Tracer.ts               # 运行链路事件记录器
│   │   └── tools/                  # 内置 Agent 工具集
│   │       ├── CalculatorTool.ts   # 基础数学运算求值
│   │       ├── SearchTool.ts       # 本地/网络知识检索模拟
│   │       ├── BashTool.ts         # 终端 Shell 命令执行工具
│   │       └── TodoTool.ts         # 待办事项会话级管理工具
│   ├── commands/                   # 可扩展 Slash 交互式命令系统
│   │   ├── index.ts                # 默认注册中心工厂函数与导出
│   │   ├── types.ts                # SlashCommand 接口定义与执行上下文
│   │   ├── CommandRegistry.ts      # 命令注册表（支持名称、别名与前缀补全匹配）
│   │   └── builtin/                # 内置 Slash 命令
│   │       ├── HelpCommand.ts      # /help：展示可用命令与注册工具
│   │       ├── ModelCommand.ts     # /model：查看或切换当前激活模型
│   │       ├── KeyCommand.ts        # /key：查看脱敏 Key 或更新并写入全局配置
│   │       ├── SessionCommand.ts   # /session：查看当前会话或切换/新建会话
│   │       ├── ClearCommand.ts     # /clear：清空当前终端屏幕消息
│   │       └── ExitCommand.ts      # /exit：退出终端助手
│   ├── config/                     # 全局 TOML 配置模块
│   │   ├── index.ts                # loadConfig, saveConfig, resolveApiKey, getConfigPath
│   │   └── types.ts                # XiConfig、LLMConfig 等类型定义
│   └── ui/                         # React + Ink 交互式终端 UI 组件
│       ├── App.tsx                 # TUI 核心控制器与全局状态机
│       └── components/             # 终端 UI 子组件
│           ├── ApiKeySetup.tsx     # 初次使用未检测到 API Key 时的交互式配置卡片
│           ├── InputPrompt.tsx     # 暗灰背景沉浸式输入框，支持 Tab 切换思考模式与历史回溯
│           ├── SlashMenu.tsx       # 键入 / 浮出候选命令浮层菜单，支持上下键导航与回车补全
│           ├── Header.tsx          # 顶部状态栏（版本、模型、会话 ID）
│           ├── MessageItem.tsx     # 消息流与思考链渲染项
│           └── Spinner.tsx         # 异步执行指示器
├── test/                           # 自动化单元测试与集成测试
│   ├── agent/                      # AgentRuntime、LLMClient、ContextManager、Tools 单测
│   ├── commands/                   # CommandRegistry 及各 Slash 命令单测
│   ├── config.test.ts              # 全局配置读写、优先级解析单测
│   └── ui/                         # Ink 组件无头渲染与交互单测
└── docs/                           # 规范文档与方案设计 (docs/superpowers/specs/)
```

---

## 4. 关键设计细节 (Key Design Details)

### 4.1 全局配置与 API Key 优先级

- **配置文件**：统一存储于用户家目录下的 `~/.xi.toml`（跨平台统一使用 `node:os` 的 `os.homedir()` 解析）。
- **默认模型与提供商**：默认使用 DeepSeek 官方 API（Base URL: `https://api.deepseek.com`，默认模型: `deepseek-v4-flash`）。
- **Key 解析优先级**：
  1. `process.env['DEEPSEEK_API_KEY']`（最高优先级）
  2. `config.llm.api_key`（来自 `~/.xi.toml`）
  3. `process.env['OPENAI_API_KEY']`（向后兼容兜底）
- **首次交互式配置**：当 `resolveApiKey()` 为空时，TUI 会自动挂载 `<ApiKeySetup />`，引导用户输入并持久化保存至 `~/.xi.toml`，无须手动改动配置文件。

### 4.2 思考流提炼与模型适配

- `OpenAICompatibleClient` 原生兼容 DeepSeek 协议，支持提取 `choices[0].message.reasoning_content`；
- 同时具备正则解析能力，可无缝提取文本中由 `<think>...</think>` 包裹的思考流内容，并统一呈现给终端用户。

### 4.3 终端交互美学规范

- **暗色沉浸感**：输入框采用整行暗灰色背景（`#2d2d2d`）与统一内边距，呈现现代 CLI 质感。
- **键盘导航状态机**：
  - 键入 `/` 唤出 Slash 菜单；
  - 菜单打开期间，`↑` / `↓` 拦截历史翻查逻辑，改为在候选菜单项中循环切换；
  - `Enter` 键补全命令并附带空格；`Esc` 键关闭菜单；
  - `Tab` 键在输入框中循环切换思考模式（开/关）。

---

## 5. 开发工作流与常用命令 (Workflows & Commands)

在开发与调试过程中，严格使用以下命令：

```powershell
# 1. 监听并增量构建 TypeScript（开发推荐）
npm run dev

# 2. 生产构建（输出至 dist/）
npm run build

# 3. 代码格式化校验与自动修复（基于 oxfmt）
npm run format:check   # 仅校验格式是否符合规范
npm run format         # 自动格式化所有文件

# 4. 代码静态检查与自动修复（基于 oxlint）
npm run lint           # 执行静态代码检查
npm run lint:fix       # 自动修复可修复的 lint 问题

# 5. TypeScript 类型全面检查
npm run typecheck      # tsc --noEmit

# 6. 运行全套终检测试（门禁必须通过）
npm test               # 依次执行 format:check -> lint -> typecheck -> ava

# 7. 仅执行单元测试
npm run test:unit      # 运行 AVA 测试套件

# 8. 直接运行本地交互式终端调试
npx tsx src/cli.tsx
```

---

## 6. 编码规范与关键约束 (Coding Standards & Constraints)

1. **显式 ESM 后缀导入（重要）**：
   - 本项目配置为 ESM 模块（`"type": "module"`）。在 `src/` 和 `test/` 中的所有相对路径导入，**必须**显式指定 `.js` 扩展名（哪怕源文件是 `.ts` 或 `.tsx`）。
   - 正确：`import { AgentRuntime } from './AgentRuntime.js'`
   - 错误：`import { AgentRuntime } from './AgentRuntime'`
2. **严禁引入 ESLint / Prettier**：
   - 项目工程化已全面迁移至 OXC 原生工具链（`oxfmt` + `oxlint`）。任何 PR 或改动严禁添加 `.eslintrc*`、`.prettierrc*` 或安装此类依赖。
3. **类型安全与完备性**：
   - 保持 TypeScript 严格模式，避免使用松懈的 `any`；必要时应在各模块的 `types.ts` 中定义清晰的 Interface。
4. **终端 UI 防抖与防重绘**：
   - 在 React + Ink 组件中，避免频繁不必要的状态更新引起终端刷屏或闪烁；
   - 键盘输入（`useInput`）应确保由正确的聚焦组件或顶层状态机集中分发，避免事件竞争冲突。
5. **跨平台路径操作**：
   - 严禁硬编码 Linux 风格的 `/root/` 或 Windows 的 `C:\` 路径；
   - 文件路径拼接统一使用 `node:path`，家目录统一使用 `os.homedir()`。

---

## 7. AI Agent 协作行为守则 (Agent Action Guidelines)

1. **调研先行**：
   - 在对已有功能做改动前，务必先通过文件查看工具研读相关代码与既有单测，厘清现有设计契约，切勿凭空假设。
2. **测试同步推进**：
   - 每当新增特性、新增 Slash 命令、修改配置逻辑或修复 Bug 时，必须同步编写或更新对应的 AVA 单元测试（位于 `test/` 下相应目录）。
3. **交付终检门禁（硬性约束）**：
   - 在完成任何代码编写后，**必须**在终端执行 `npm test`；
   - 确保输出结果包含：
     - `All matched files use the correct format.`（格式 100% 正确）
     - `Found 0 warnings and 0 errors.`（Lint 0 告警 0 错误）
     - TypeScript 编译无类型报错；
     - 所有的单元测试全部 Passed；
   - **严禁**在存在测试失败或类型报错的情况下向用户声称任务已完成。
