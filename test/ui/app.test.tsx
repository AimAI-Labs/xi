import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { AgentRuntime } from '../../src/agent/index.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import { HelpCommand } from '../../src/commands/builtin/HelpCommand.js'
import { CommandRegistry } from '../../src/commands/CommandRegistry.js'
import App from '../../src/ui/App.js'

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
  t.true(frame.includes('xi'))
  t.true(frame.includes('test-app'))
  t.true(frame.includes('xi >'))
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
