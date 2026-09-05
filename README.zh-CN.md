[English](README.md) | **简体中文**

# xi (ξ)

> 极简且沉浸式的终端交互 AI Agent CLI 助手，基于 React + Ink 构建。
>
> A minimal and immersive terminal AI agent CLI with ReAct runtime, tool calling, and session management.

---

## 特性亮点 (Features)

- 🖥️ **沉浸式终端交互**：基于 React 18 与 Ink 4 驱动，暗色质感输入框、状态栏与快捷按键导航。
- 🔄 **自研 ReAct 运行时**：不依赖三方 Agent 库，纯原生实现完整的 Thought → Action → Observation 闭环。
- 🛠️ **内置实用工具集**：
  - `calculator`：安全四则数学运算求值
  - `search`：本地与网络知识检索
  - `bash`：终端 Shell 命令执行（内置高危敏感命令拦截与用户确认机制）
  - `todo`：会话级任务与待办清单管理
- 🧠 **思考流深度适配**：原生兼容 DeepSeek 协议的 `reasoning_content` 与 `<think>...</think>` 思考过程提取。
- 💾 **多会话与上下文管理**：支持会话持久化（`~/.xi/session`）与超长历史消息滑动窗口压缩（MicroCompact）。
- ⚡ **交互式 Slash 指令**：键入 `/` 呼出浮层菜单，支持 `/help`、`/model`、`/key`、`/session`、`/clear`、`/exit` 等。

---

## 快速上手 (Quick Start)

### 免安装直接运行

```bash
npx @aimai-labs/xi
```

### 全局安装

```bash
npm install --global @aimai-labs/xi
xi
```

---

## CLI 用法 (CLI Usage)

```text
Usage
  $ xi [command]

Commands
  (无参数直接运行) 进入交互式 REPL 终端
  agent <prompt>   运行 Agent 处理单次任务
  demo             运行内置全功能 Agent 演示

Options
  --session        指定会话 ID (默认: "default")
  --verbose        输出详细链路跟踪 (默认: true)
  --name           Your name (单次欢迎模式)

Examples
  $ xi
  $ xi agent "帮我计算 (100 + 20) * 3"
  $ xi demo
```

---

## 配置说明 (Configuration)

首次运行未检测到 API Key 时，终端会自动弹出交互式配置向导；也可以通过在 REPL 终端中输入 `/key` 进行设置。

全局配置文件统一存储于 `~/.xi/xi.toml`，默认采用 DeepSeek 官方 API：

```toml
[llm]
provider = "deepseek"
api_key = "sk-..."
model = "deepseek-v4-flash"
base_url = "https://api.deepseek.com"
```

同时支持环境变量覆盖：`DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`。

---

## License

[MIT](LICENSE)
