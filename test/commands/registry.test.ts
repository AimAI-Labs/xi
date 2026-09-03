import test from 'ava'

import { CommandRegistry } from '../../src/commands/CommandRegistry.js'
import type { CommandContext, SlashCommand } from '../../src/commands/types.js'

function createMockContext(): CommandContext {
  let sessionId = 'default'
  let currentModel = 'gpt-4o-mini'
  return {
    sessionId,
    setSessionId: (id: string) => {
      sessionId = id
    },
    currentModel,
    setCurrentModel: (model: string) => {
      currentModel = model
    },
    runtime: {} as any,
    clearScreen: () => {},
    exit: () => {},
  }
}

test('CommandRegistry registers and executes commands by name or alias', async (t) => {
  const registry = new CommandRegistry()

  const dummyCmd: SlashCommand = {
    name: 'ping',
    aliases: ['p'],
    description: 'Ping command',
    execute: async (args) => ({
      type: 'output',
      message: `pong: ${args}`,
    }),
  }

  registry.register(dummyCmd)

  t.truthy(registry.get('ping'))
  t.truthy(registry.get('p'))
  t.falsy(registry.get('unknown'))

  const ctx = createMockContext()
  const res1 = await registry.execute('/ping hello', ctx)
  t.is(res1.type, 'output')
  t.is(res1.message, 'pong: hello')

  const res2 = await registry.execute('/p world', ctx)
  t.is(res2.type, 'output')
  t.is(res2.message, 'pong: world')
})

test('CommandRegistry handles unknown commands with helpful suggestion', async (t) => {
  const registry = new CommandRegistry()
  const ctx = createMockContext()

  const res = await registry.execute('/foo bar', ctx)
  t.is(res.type, 'output')
  t.true(res.message?.includes('未知命令 "/foo"'))
  t.true(res.message?.includes('/help'))
})

test('CommandRegistry formats help list of all registered commands', (t) => {
  const registry = new CommandRegistry()
  registry.register({
    name: 'model',
    description: '切换模型',
    usage: '/model [name]',
    execute: async () => ({ type: 'silent' }),
  })

  const list = registry.getAll()
  t.is(list.length, 1)
  t.is(list[0]?.name, 'model')
})
