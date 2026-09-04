import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { AgentRuntime } from '../../src/agent/index.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import { HelpCommand } from '../../src/commands/builtin/HelpCommand.js'
import { CommandRegistry } from '../../src/commands/CommandRegistry.js'
import { createDefaultCommandRegistry } from '../../src/commands/index.js'
import App from '../../src/ui/App.js'

const testSandboxDir = path.join(os.tmpdir(), `xi-app-ui-test-${Date.now()}-${Math.random()}`)

test.before(() => {
  fs.mkdirSync(testSandboxDir, { recursive: true })
  process.env['XI_SESSION_DIR'] = testSandboxDir
})

test.after.always(() => {
  delete process.env['XI_SESSION_DIR']
  fs.rmSync(testSandboxDir, { recursive: true, force: true })
})

async function waitForCondition(check: () => boolean, timeoutMs = 1000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (check()) return true
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  return check()
}

test('App mounts and renders Header and prompt', (t) => {
  const llm = new MockLLMClient()
  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = new CommandRegistry()

  const { lastFrame } = render(
    <App
      runtime={runtime}
      commandRegistry={registry}
      initialSessionId="test-app"
      requireApiKey={false}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('ξ'))
  t.true(frame.includes('test-app'))
  t.true(frame.includes('ξ >'))
})

test('App executes slash commands and displays feedback', async (t) => {
  const llm = new MockLLMClient()
  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = new CommandRegistry()
  registry.register(new HelpCommand(registry))

  const { lastFrame, stdin } = render(
    <App
      runtime={runtime}
      commandRegistry={registry}
      initialSessionId="test-cmd"
      requireApiKey={false}
    />,
  )

  // 等待 React 挂载完成 useEffect
  await new Promise((resolve) => setTimeout(resolve, 30))

  // 模拟输入 /help 并回车
  stdin.write('/help\r\n')

  const matched = await waitForCondition(() => {
    const frame = lastFrame() || ''
    return frame.includes('Slash 命令清单')
  })

  t.true(matched)
})

test('App handles user question and renders Agent response', async (t) => {
  const llm = new MockLLMClient()
  llm.queueResponse({
    content: '你好，我是 Agent 回复！',
  })
  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = new CommandRegistry()

  const { lastFrame, stdin } = render(
    <App
      runtime={runtime}
      commandRegistry={registry}
      initialSessionId="test-chat"
      requireApiKey={false}
    />,
  )

  // 等待 React 挂载完成
  await new Promise((resolve) => setTimeout(resolve, 30))

  stdin.write('你好呀\r\n')

  const matched = await waitForCondition(() => {
    const frame = lastFrame() || ''
    return frame.includes('你好，我是 Agent 回复！')
  })

  t.true(matched)
})

test('App enters ApiKeySetup mode when requireApiKey is true', (t) => {
  const { lastFrame } = render(<App requireApiKey={true} />)
  const frame = lastFrame() || ''
  t.true(frame.includes('欢迎使用 xi 智能终端助手'))
  t.true(frame.includes('DeepSeek'))
  t.true(frame.includes('Key >'))
})

test('App streams thinking and tool call with command visualization', async (t) => {
  const llm = new MockLLMClient()
  llm.queueStreamChunks([
    { reasoning_content: '思考中...' },
    {
      tool_calls: [
        {
          id: 'call_bash_1',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({ command: 'echo "hello from tool"' }),
          },
        },
      ],
      isDone: true,
    },
  ])
  llm.queueStreamChunks([{ content: '命令执行完成啦！' }, { isDone: true }])

  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = new CommandRegistry()

  const { lastFrame, stdin } = render(
    <App
      commandRegistry={registry}
      initialSessionId="test-stream"
      requireApiKey={false}
      runtime={runtime}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('运行 echo 命令\r\n')

  const matched = await waitForCondition(() => {
    const frame = lastFrame() || ''
    return (
      frame.includes('思考中...') &&
      frame.includes('bash') &&
      frame.includes('echo "hello from tool"') &&
      frame.includes('命令执行完成啦！')
    )
  })

  t.true(matched)
})

test('App preserves sequential order of Pre-Tool Content -> Tool -> Post-Tool Content', async (t) => {
  const llm = new MockLLMClient()
  // Turn 1: 文本 + 工具调用
  llm.queueStreamChunks([
    { content: '好的，我先为你执行命令：' },
    {
      tool_calls: [
        {
          id: 'call_bash_order',
          type: 'function',
          function: {
            name: 'bash',
            arguments: JSON.stringify({ command: 'node -v' }),
          },
        },
      ],
      isDone: true,
    },
  ])
  // Turn 2: 后续回答
  llm.queueStreamChunks([{ content: '根据命令返回，当前版本已就绪。' }, { isDone: true }])

  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = new CommandRegistry()

  const { lastFrame, stdin } = render(
    <App
      commandRegistry={registry}
      initialSessionId="test-order"
      requireApiKey={false}
      runtime={runtime}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('查看版本\r\n')

  const matched = await waitForCondition(() => {
    const frame = lastFrame() || ''
    const prePos = frame.indexOf('好的，我先为你执行命令：')
    const toolPos = frame.indexOf('[bash]')
    const postPos = frame.indexOf('根据命令返回，当前版本已就绪。')
    return (
      prePos !== -1 && toolPos !== -1 && postPos !== -1 && prePos < toolPos && toolPos < postPos
    )
  })

  t.true(matched)
})

test('App restores conversation history seamlessly with isHistorical flag on mount', (t) => {
  const llm = new MockLLMClient()
  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = new CommandRegistry()

  // 预置历史消息
  runtime.getSessionStore().appendMessage('hist-session', {
    role: 'user',
    content: '之前讨论过的历史问题',
  })
  runtime.getSessionStore().appendMessage('hist-session', {
    role: 'assistant',
    content: '这是之前的历史回答',
  })

  const { lastFrame } = render(
    <App
      commandRegistry={registry}
      initialSessionId="hist-session"
      requireApiKey={false}
      runtime={runtime}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('之前讨论过的历史问题'))
  t.true(frame.includes('这是之前的历史回答'))
})

test('App switches session via /session command and loads its history', async (t) => {
  const llm = new MockLLMClient()
  const runtime = new AgentRuntime({ llmClient: llm })
  const registry = createDefaultCommandRegistry()

  // 预置目标会话的历史
  runtime.getSessionStore().appendMessage('window-target', {
    role: 'user',
    content: '目标窗口的独特历史问答',
  })

  const { lastFrame, stdin } = render(
    <App
      commandRegistry={registry}
      initialSessionId="window-origin"
      requireApiKey={false}
      runtime={runtime}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  t.false((lastFrame() || '').includes('目标窗口的独特历史问答'))

  // 切换会话
  stdin.write('/session window-target\r\n')

  const matched = await waitForCondition(() => {
    const frame = lastFrame() || ''
    return frame.includes('目标窗口的独特历史问答') && frame.includes('window-target')
  })

  t.true(matched)
})
