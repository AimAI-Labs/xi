import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { AgentRuntime } from '../../src/agent/index.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import type { AgentOptions } from '../../src/agent/types.js'
import { CommandRegistry } from '../../src/commands/CommandRegistry.js'
import App from '../../src/ui/App.js'

const testSandboxDir = path.join(
  os.tmpdir(),
  `xi-app-thinking-ui-test-${Date.now()}-${Math.random()}`,
)

test.before(() => {
  fs.mkdirSync(testSandboxDir, { recursive: true })
  process.env['XI_SESSION_DIR'] = testSandboxDir
})

test.after.always(() => {
  delete process.env['XI_SESSION_DIR']
  fs.rmSync(testSandboxDir, { recursive: true, force: true })
})

async function waitForCondition(check: () => boolean, timeoutMs = 1500): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (check()) return true
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  return check()
}

test('App passes thinkingEnabled status to runtime.runStream and toggles via Tab', async (t) => {
  const capturedOptions: (AgentOptions | undefined)[] = []

  const llm = new MockLLMClient({
    handler: async () => ({ content: 'done' }),
  })
  const runtime = new AgentRuntime({ llmClient: llm })
  const originalRunStream = runtime.runStream.bind(runtime)

  runtime.runStream = async function* (
    sessionId: string,
    userPrompt: string,
    options?: AgentOptions,
  ) {
    capturedOptions.push(options)
    yield* originalRunStream(sessionId, userPrompt, options)
  }

  const registry = new CommandRegistry()

  const { lastFrame, stdin } = render(
    <App
      runtime={runtime}
      commandRegistry={registry}
      initialSessionId="test-thinking-session"
      requireApiKey={false}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 50))

  // 默认状态下思考模式开启
  t.true((lastFrame() || '').includes('思考: 开'))

  // 1. 提交第一条消息：此时思考模式应为 true
  stdin.write('第一条问题\r\n')

  await waitForCondition(() => capturedOptions.length === 1)
  t.is(capturedOptions[0]?.thinking, true)

  // 等待第一轮处理完毕并渲染完成
  await waitForCondition(() => (lastFrame() || '').includes('done'))
  await new Promise((resolve) => setTimeout(resolve, 50))

  // 2. 按 Tab 键切换思考模式为关
  stdin.write('\t')
  await waitForCondition(() => (lastFrame() || '').includes('思考: 关'))
  t.true((lastFrame() || '').includes('思考: 关'))

  // 3. 提交第二条消息：此时思考模式应为 false
  stdin.write('第二条问题\r\n')

  await waitForCondition(() => capturedOptions.length === 2)
  t.is(capturedOptions[1]?.thinking, false)
})
