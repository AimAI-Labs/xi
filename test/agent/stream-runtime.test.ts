import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'

import { AgentRuntime } from '../../src/agent/AgentRuntime.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import { ToolRegistry } from '../../src/agent/ToolRegistry.js'
import { CalculatorTool } from '../../src/agent/tools/CalculatorTool.js'
import type { AgentStreamEvent } from '../../src/agent/types.js'

const testSandboxDir = path.join(
  os.tmpdir(),
  `xi-stream-runtime-test-${Date.now()}-${Math.random()}`,
)

test.before(() => {
  fs.mkdirSync(testSandboxDir, { recursive: true })
  process.env['XI_SESSION_DIR'] = testSandboxDir
})

test.after.always(() => {
  delete process.env['XI_SESSION_DIR']
  fs.rmSync(testSandboxDir, { recursive: true, force: true })
})

test('AgentRuntime.runStream: text response yields thinking_delta, content_delta and finished', async (t) => {
  const mockClient = new MockLLMClient()
  mockClient.queueStreamChunks([
    { reasoning_content: '分析问题中...' },
    { content: '你好，' },
    { content: '我是小汐！' },
    { isDone: true },
  ])

  const runtime = new AgentRuntime({ llmClient: mockClient })
  const events: AgentStreamEvent[] = []

  for await (const ev of runtime.runStream('session-test-1', '你好')) {
    events.push(ev)
  }

  const thinkingEvents = events.filter((e) => e.type === 'thinking_delta')
  const contentEvents = events.filter((e) => e.type === 'content_delta')
  const finishedEvent = events.find((e) => e.type === 'finished')

  t.is(thinkingEvents.length, 1)
  t.is((thinkingEvents[0] as any).delta, '分析问题中...')

  t.is(contentEvents.length, 2)
  const fullContent = contentEvents.map((c: any) => c.delta).join('')
  t.is(fullContent, '你好，我是小汐！')

  t.truthy(finishedEvent)
  t.is((finishedEvent as any).finalResponse, '你好，我是小汐！')

  // 验证 sessionStore 持久化
  const messages = runtime.getSessionStore().getMessages('session-test-1')
  t.is(messages.length, 2)
  t.is(messages[0]?.role, 'user')
  t.is(messages[1]?.role, 'assistant')
  t.is(messages[1]?.content, '你好，我是小汐！')
})

test('AgentRuntime.runStream: tool invocation yields tool_start and tool_end with args and duration', async (t) => {
  const toolRegistry = new ToolRegistry().register(new CalculatorTool())
  const mockClient = new MockLLMClient()

  // 第 1 轮返回工具调用
  mockClient.queueStreamChunks([
    {
      tool_calls: [
        {
          id: 'call_calc_1',
          type: 'function',
          function: {
            name: 'calculator',
            arguments: JSON.stringify({ expression: '40 + 2' }),
          },
        },
      ],
      isDone: true,
    },
  ])

  // 第 2 轮返回最终回答
  mockClient.queueStreamChunks([{ content: '计算结果为 42。' }, { isDone: true }])

  const runtime = new AgentRuntime({
    llmClient: mockClient,
    toolRegistry,
  })

  const events: AgentStreamEvent[] = []
  for await (const ev of runtime.runStream('session-tool-test', '计算 40 + 2')) {
    events.push(ev)
  }

  const toolStart = events.find((e) => e.type === 'tool_start') as any
  t.truthy(toolStart)
  t.is(toolStart.toolName, 'calculator')
  t.deepEqual(toolStart.args, { expression: '40 + 2' })

  const toolEnd = events.find((e) => e.type === 'tool_end') as any
  t.truthy(toolEnd)
  t.is(toolEnd.toolName, 'calculator')
  t.is(toolEnd.result, '42')
  t.false(toolEnd.isError)
  t.true(typeof toolEnd.durationMs === 'number')

  const finished = events.find((e) => e.type === 'finished') as any
  t.truthy(finished)
  t.is(finished.finalResponse, '计算结果为 42。')
})
