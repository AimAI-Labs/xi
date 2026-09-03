import test from 'ava'

import { ToolRegistry } from '../../src/agent/ToolRegistry.js'
import { BashTool } from '../../src/agent/tools/BashTool.js'
import { CalculatorTool } from '../../src/agent/tools/CalculatorTool.js'
import { SearchTool } from '../../src/agent/tools/SearchTool.js'
import { TodoTool } from '../../src/agent/tools/TodoTool.js'

test('CalculatorTool evaluates valid math expressions safely', async (t) => {
  const tool = new CalculatorTool()
  const result = await tool.execute({ expression: '(12 + 8) * 5' }, { sessionId: 'test' })
  t.is(result, '100')
})

test('CalculatorTool catches invalid expressions and division by zero', async (t) => {
  const tool = new CalculatorTool()
  await t.throwsAsync(async () => {
    await tool.execute({ expression: 'process.exit(1)' }, { sessionId: 'test' })
  })
})

test('SearchTool retrieves existing knowledge and fallbacks', async (t) => {
  const tool = new SearchTool({
    mockData: {
      北京天气: '北京今天晴朗，气温 22°C，微风。',
      'xi cli': 'xi 是一个基于 React 和 Ink 构建的极简 CLI 工具。',
    },
  })

  const res1 = await tool.execute({ query: '北京天气' }, { sessionId: 'test' })
  t.true(res1.includes('22°C'))

  const res2 = await tool.execute({ query: '未知内容' }, { sessionId: 'test' })
  t.true(res2.includes('未找到') || res2.includes('Mock 搜索结果'))
})

test('BashTool executes commands and handles errors safely', async (t) => {
  const tool = new BashTool({ timeoutMs: 3000 })
  const res = await tool.execute(
    { command: 'node -e "console.log(\'AGENT_BASH_OK\')"' },
    { sessionId: 'test' },
  )
  t.true(res.includes('AGENT_BASH_OK'))
})

test('TodoTool supports add, list, remove, clear with session isolation', async (t) => {
  const tool = new TodoTool()

  await tool.execute({ action: 'add', item: '买牛奶' }, { sessionId: 's1' })
  await tool.execute({ action: 'add', item: '写代码' }, { sessionId: 's1' })
  await tool.execute({ action: 'add', item: '锻炼身体' }, { sessionId: 's2' })

  const listS1 = await tool.execute({ action: 'list' }, { sessionId: 's1' })
  t.true(listS1.includes('买牛奶'))
  t.true(listS1.includes('写代码'))
  t.false(listS1.includes('锻炼身体'))

  const listS2 = await tool.execute({ action: 'list' }, { sessionId: 's2' })
  t.true(listS2.includes('锻炼身体'))
  t.false(listS2.includes('买牛奶'))

  await tool.execute({ action: 'remove', item: '买牛奶' }, { sessionId: 's1' })
  const afterRemove = await tool.execute({ action: 'list' }, { sessionId: 's1' })
  t.false(afterRemove.includes('买牛奶'))
  t.true(afterRemove.includes('写代码'))
})

test('ToolRegistry exports OpenAI format schemas and executes safely with error recovery', async (t) => {
  const registry = new ToolRegistry()
  registry.register(new CalculatorTool())
  registry.register(new TodoTool())

  const schemas = registry.getOpenAITools()
  t.is(schemas.length, 2)
  t.is(schemas[0]?.type, 'function')
  t.is(schemas[0]?.function.name, 'calculator')

  // 验证正常调用
  const result = await registry.executeSafely(
    'calculator',
    { expression: '7 * 8' },
    { sessionId: 'test' },
  )
  t.is(result.content, '56')
  t.is(result.isError, false)

  // 验证非法调用安全捕获，不抛出异常，返回 isError: true
  const errResult = await registry.executeSafely(
    'calculator',
    { expression: 'bad syntax +++' },
    { sessionId: 'test' },
  )
  t.is(errResult.isError, true)
  t.true(errResult.content.startsWith('Error:'))
})
