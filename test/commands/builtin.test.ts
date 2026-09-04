import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'

import { AgentRuntime, ToolRegistry } from '../../src/agent/index.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import { ClearCommand } from '../../src/commands/builtin/ClearCommand.js'
import { ExitCommand } from '../../src/commands/builtin/ExitCommand.js'
import { HelpCommand } from '../../src/commands/builtin/HelpCommand.js'
import { KeyCommand } from '../../src/commands/builtin/KeyCommand.js'
import { ModelCommand } from '../../src/commands/builtin/ModelCommand.js'
import { SessionCommand } from '../../src/commands/builtin/SessionCommand.js'
import { CommandRegistry } from '../../src/commands/CommandRegistry.js'
import type { CommandContext } from '../../src/commands/types.js'
import type { XiConfig } from '../../src/config/types.js'

const testSandboxDir = path.join(os.tmpdir(), `xi-cmd-test-${Date.now()}-${Math.random()}`)
const testSandboxToml = path.join(testSandboxDir, 'xi.toml')

test.before(() => {
  fs.mkdirSync(testSandboxDir, { recursive: true })
  process.env['XI_CONFIG_PATH'] = testSandboxToml
})

test.after.always(() => {
  delete process.env['XI_CONFIG_PATH']
  fs.rmSync(testSandboxDir, { recursive: true, force: true })
})

function createTestContext(): { ctx: CommandContext; state: any } {
  const state = {
    sessionId: 'session-default',
    currentModel: 'gpt-4o-mini',
    cleared: false,
    exited: false,
    lastConfigChange: null as XiConfig | null,
  }

  const toolRegistry = new ToolRegistry()
  const runtime = new AgentRuntime({
    llmClient: new MockLLMClient(),
    toolRegistry,
  })

  const ctx: CommandContext = {
    get sessionId() {
      return state.sessionId
    },
    setSessionId: (id) => {
      state.sessionId = id
    },
    get currentModel() {
      return state.currentModel
    },
    setCurrentModel: (model) => {
      state.currentModel = model
    },
    runtime,
    clearScreen: () => {
      state.cleared = true
    },
    exit: () => {
      state.exited = true
    },
    onConfigChange: (cfg) => {
      state.lastConfigChange = cfg
    },
  }

  return { ctx, state }
}

test('ModelCommand displays current model or updates it', async (t) => {
  const cmd = new ModelCommand()
  const { ctx, state } = createTestContext()

  // 1. 无参查询
  const res1 = await cmd.execute('', ctx)
  t.is(res1.type, 'output')
  t.true(res1.message?.includes('gpt-4o-mini'))
  t.true(res1.message?.includes('https://api.deepseek.com'))
  t.true(res1.message?.includes('可用模型: mock-model-a, mock-model-b'))

  // 2. 带参切换
  const res2 = await cmd.execute('deepseek-chat', ctx)
  t.is(res2.type, 'output')
  t.is(state.currentModel, 'deepseek-chat')
  t.true(res2.message?.includes('已切换模型为: deepseek-chat'))
  t.true(res2.message?.includes('~/.xi/xi.toml'))
  t.is(state.lastConfigChange?.llm.model, 'deepseek-chat')
})

test('KeyCommand displays and updates API Key', async (t) => {
  const cmd = new KeyCommand()
  const { ctx, state } = createTestContext()

  // 1. 无参查询
  const res1 = await cmd.execute('', ctx)
  t.is(res1.type, 'output')
  t.truthy(res1.message)

  // 2. 配置 Key
  const res2 = await cmd.execute('sk-new-key-12345678', ctx)
  t.is(res2.type, 'output')
  t.true(res2.message?.includes('成功更新并保存'))
  t.true(res2.message?.includes('~/.xi/xi.toml'))
  t.is(state.lastConfigChange?.llm.api_key, 'sk-new-key-12345678')
  t.true(fs.existsSync(testSandboxToml))
})

test('SessionCommand displays or switches session', async (t) => {
  const cmd = new SessionCommand()
  const { ctx, state } = createTestContext()

  const res1 = await cmd.execute('', ctx)
  t.true(res1.message?.includes('session-default'))

  const res2 = await cmd.execute('window-2', ctx)
  t.is(state.sessionId, 'window-2')
  t.true(res2.message?.includes('已切换到会话: window-2'))
})

test('ClearCommand calls clearScreen', async (t) => {
  const cmd = new ClearCommand()
  const { ctx, state } = createTestContext()

  const res = await cmd.execute('', ctx)
  t.is(res.type, 'silent')
  t.true(state.cleared)
})

test('ExitCommand calls exit', async (t) => {
  const cmd = new ExitCommand()
  const { ctx, state } = createTestContext()

  const res = await cmd.execute('', ctx)
  t.is(res.type, 'exit')
  t.true(state.exited)
})

test('HelpCommand formats registered commands and tools', async (t) => {
  const registry = new CommandRegistry()
  const helpCmd = new HelpCommand(registry)
  registry.register(helpCmd)
  registry.register(new ModelCommand())

  const { ctx } = createTestContext()
  const res = await helpCmd.execute('', ctx)
  t.is(res.type, 'output')
  t.true(res.message?.includes('/model'))
  t.true(res.message?.includes('/help'))
})
