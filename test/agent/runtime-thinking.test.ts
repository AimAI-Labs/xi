import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'

import { AgentRuntime } from '../../src/agent/AgentRuntime.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import type { LLMCallOptions } from '../../src/agent/LLMClient.js'

const testSandboxDir = path.join(
  os.tmpdir(),
  `xi-runtime-thinking-test-${Date.now()}-${Math.random()}`,
)

test.before(() => {
  fs.mkdirSync(testSandboxDir, { recursive: true })
  process.env['XI_SESSION_DIR'] = testSandboxDir
})

test.after.always(() => {
  delete process.env['XI_SESSION_DIR']
  fs.rmSync(testSandboxDir, { recursive: true, force: true })
})

test('AgentRuntime.runStream forwards thinking option to LLMClient', async (t) => {
  const capturedOptions: (LLMCallOptions | undefined)[] = []

  const mockClient = new MockLLMClient({
    handler: async (_msgs, _tools, options) => {
      capturedOptions.push(options)
      return { content: 'done' }
    },
  })

  const runtime = new AgentRuntime({ llmClient: mockClient })

  // 1. runStream with thinking: false
  const iter1 = runtime.runStream('sess-stream-1', 'hi', { thinking: false })
  for await (const _ev of iter1) {
    // consume
  }
  t.is(capturedOptions.length, 1)
  t.deepEqual(capturedOptions[0], { thinking: false })

  // 2. runStream with thinking: true
  const iter2 = runtime.runStream('sess-stream-2', 'hi', { thinking: true })
  for await (const _ev of iter2) {
    // consume
  }
  t.is(capturedOptions.length, 2)
  t.deepEqual(capturedOptions[1], { thinking: true })
})

test('AgentRuntime.run forwards thinking option to LLMClient', async (t) => {
  const capturedOptions: (LLMCallOptions | undefined)[] = []

  const mockClient = new MockLLMClient({
    handler: async (_msgs, _tools, options) => {
      capturedOptions.push(options)
      return { content: 'done' }
    },
  })

  const runtime = new AgentRuntime({ llmClient: mockClient })

  // 1. run with thinking: false
  await runtime.run('sess-run-1', 'hi', { thinking: false })
  t.is(capturedOptions.length, 1)
  t.deepEqual(capturedOptions[0], { thinking: false })

  // 2. run with thinking: true
  await runtime.run('sess-run-2', 'hi', { thinking: true })
  t.is(capturedOptions.length, 2)
  t.deepEqual(capturedOptions[1], { thinking: true })
})
