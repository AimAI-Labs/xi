**English** | [简体中文](README.zh-CN.md)

# xi (ξ)

> A minimal and immersive terminal AI agent CLI with ReAct runtime, tool calling, and session management.

---

## Features

- 🖥️ **Immersive Terminal Interface**: Powered by React 18 & Ink 4, featuring dark-themed input styling, status bar, and intuitive keyboard navigation.
- 🔄 **In-House ReAct Loop**: No third-party agent framework dependency; native implementation of the Thought → Action → Observation execution loop.
- 🛠️ **Built-in Toolset**:
  - `calculator`: Safe arithmetic evaluation
  - `search`: Local and mock web knowledge retrieval
  - `bash`: Terminal shell execution with safety confirmation & destructive command interception
  - `todo`: Session-scoped task and todo list management
- 🧠 **Thinking Stream Support**: Deep integration with reasoning protocols, extracting `reasoning_content` and `<think>...</think>` blocks.
- 💾 **Session & Context Management**: Supports persistent sessions (`~/.xi/session`) and sliding-window context compression (MicroCompact).
- ⚡ **Interactive Slash Commands**: Type `/` to open floating menu for `/help`, `/model`, `/key`, `/session`, `/clear`, `/exit`, etc.

---

## Quick Start

### Run Directly with NPX

```bash
npx @aimai-labs/xi
```

### Global Installation

```bash
npm install --global @aimai-labs/xi
xi
```

---

## CLI Usage

```text
Usage
  $ xi [command]

Commands
  (Run without arguments) Launch interactive REPL terminal
  agent <prompt>          Run Agent for a single task
  demo                    Run built-in full-featured Agent demo

Options
  --session               Specify session ID (default: "default")
  --verbose               Output detailed trace logs (default: true)
  --name                  Your name (single-run greeting mode)

Examples
  $ xi
  $ xi agent "Help me calculate (100 + 20) * 3"
  $ xi demo
```

---

## Configuration

When run for the first time without an API Key, an interactive configuration prompt appears automatically. You can also configure keys anytime inside REPL by typing `/key`.

Global configurations are stored in `~/.xi/xi.toml` (defaults to the official DeepSeek API):

```toml
[llm]
provider = "deepseek"
api_key = "sk-..."
model = "deepseek-v4-flash"
base_url = "https://api.deepseek.com"
```

Environment variables are also supported: `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`.

---

## License

[MIT](LICENSE)
