import test from 'ava'

import { AgentRuntime } from '../../src/agent/AgentRuntime.js'
import { ContextManager } from '../../src/agent/ContextManager.js'
import { MockLLMClient } from '../../src/agent/LLMClient.js'
import { SessionStore } from '../../src/agent/SessionStore.js'
import { ToolRegistry } from '../../src/agent/ToolRegistry.js'
import { BashTool } from '../../src/agent/tools/BashTool.js'
import { CalculatorTool } from '../../src/agent/tools/CalculatorTool.js'
import { SearchTool } from '../../src/agent/tools/SearchTool.js'
import { TodoTool } from '../../src/agent/tools/TodoTool.js'
import { Tracer } from '../../src/agent/Tracer.js'

function setupTestEnvironment() {
  const registry = new ToolRegistry()
  registry.register(new CalculatorTool())
  registry.register(
    new SearchTool({
      mockData: {
        北京天气: '北京今日晴，气温 22°C。',
      },
    }),
  )
  registry.register(new TodoTool())
  registry.register(new BashTool())

  const sessionStore = new SessionStore()
  const contextManager = new ContextManager()
  const tracer = new Tracer({ verbose: false })
  const llmClient = new MockLLMClient()

  const runtime = new AgentRuntime({
    llmClient,
    toolRegistry: registry,
    sessionStore,
    contextManager,
    tracer,
  })

  return { runtime, llmClient, sessionStore, tracer }
}

test('Scenario 1: Direct text response without tools (Step 1 -> Step 2 -> finish)', async (t) => {
  const { runtime, llmClient } = setupTestEnvironment()

  llmClient.queueResponse({
    content: '你好！我是你的 AI 助手，有什么可以帮你的？',
    reasoning_content: '用户单纯打招呼，无需调用任何工具',
  })

  const result = await runtime.run('session-1', '你好')
  t.is(result.finalResponse, '你好！我是你的 AI 助手，有什么可以帮你的？')
  t.is(result.turnsCount, 1)
})

test('Scenario 2: Single tool invocation loop (Step 1 -> Step 2 -> Step 3 -> Step 4 -> finish)', async (t) => {
  const { runtime, llmClient, sessionStore } = setupTestEnvironment()

  // 第 1 轮：模型决策调用计算器
  llmClient.queueResponse({
    content: null,
    reasoning_content: '计算 128 * 4 需要使用 calculator 工具',
    tool_calls: [
      {
        id: 'call_calc_1',
        type: 'function',
        function: {
          name: 'calculator',
          arguments: JSON.stringify({ expression: '128 * 4' }),
        },
      },
    ],
  })

  // 第 2 轮：模型根据工具返回结果，给出最终回复
  llmClient.queueResponse({
    content: '128 乘以 4 的结果是 512。',
    reasoning_content: '计算器已返回 512，组织最终答案',
  })

  const result = await runtime.run('session-calc', '128 * 4 等于多少？')
  t.is(result.finalResponse, '128 乘以 4 的结果是 512。')
  t.is(result.turnsCount, 2)

  // 验证 Session 上下文完整保存了完整链路
  const messages = sessionStore.getMessages('session-calc')
  t.is(messages.length, 4) // user -> assistant(tool_calls) -> tool -> assistant(final)
  t.is(messages[0]?.role, 'user')
  t.is(messages[1]?.role, 'assistant')
  t.is(messages[2]?.role, 'tool')
  t.is((messages[2] as any).content, '512')
  t.is(messages[3]?.role, 'assistant')
})

test('Scenario 3: Multi-step chained tools (Search weather -> Add Todo -> Final answer)', async (t) => {
  const { runtime, llmClient } = setupTestEnvironment()

  // 轮次 1：调用 Search
  llmClient.queueResponse({
    content: null,
    reasoning_content: '先查询北京天气',
    tool_calls: [
      {
        id: 'call_search',
        type: 'function',
        function: {
          name: 'search',
          arguments: JSON.stringify({ query: '北京天气' }),
        },
      },
    ],
  })

  // 轮次 2：根据天气查到的结果，调用 Todo
  llmClient.queueResponse({
    content: null,
    reasoning_content: '天气已查到是晴天，记录到待办清单',
    tool_calls: [
      {
        id: 'call_todo',
        type: 'function',
        function: {
          name: 'todo',
          arguments: JSON.stringify({ action: 'add', item: '晴天去户外散步' }),
        },
      },
    ],
  })

  // 轮次 3：完成任务，总结回答
  llmClient.queueResponse({
    content: '已为您查询到北京天气为晴，并已为您添加了“晴天去户外散步”的待办事项！',
    reasoning_content: '多步任务已全部完成',
  })

  const result = await runtime.run('session-chain', '帮我查下北京天气，并根据天气记一个待办')
  t.true(result.finalResponse.includes('晴天去户外散步'))
  t.is(result.turnsCount, 3)
})

test('Scenario 4: Multi-session isolation (Window 1 vs Window 2 independent)', async (t) => {
  const { runtime, llmClient, sessionStore } = setupTestEnvironment()

  // 窗口 1: 查天气记待办
  llmClient.queueResponse({
    content: '窗口 1: 已记录待办：外出防晒',
  })
  await runtime.run('window-1', '查天气记待办')

  // 窗口 2: 写周报记待办
  llmClient.queueResponse({
    content: '窗口 2: 已记录待办：本周五前完成周报',
  })
  await runtime.run('window-2', '写周报记待办')

  // 验证两窗口完全隔离
  const msgs1 = sessionStore.getMessages('window-1')
  const msgs2 = sessionStore.getMessages('window-2')

  t.is(msgs1.length, 2)
  t.is(msgs1[0]?.content, '查天气记待办')
  t.is(msgs2.length, 2)
  t.is(msgs2[0]?.content, '写周报记待办')

  // 窗口 1 继续追问，互不干扰
  llmClient.queueResponse({
    content: '窗口 1 回复：你之前让我查天气记待办',
  })
  const followUp1 = await runtime.run('window-1', '我刚才让你做了什么？')
  t.true(followUp1.finalResponse.includes('查天气记待办'))
})

test('Scenario 5: Follow-up handling (pure text and with tool results)', async (t) => {
  const { runtime, llmClient } = setupTestEnvironment()

  // 轮次 1：执行计算
  llmClient.queueResponse({
    content: null,
    tool_calls: [
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'calculator', arguments: JSON.stringify({ expression: '20 + 30' }) },
      },
    ],
  })
  llmClient.queueResponse({
    content: '20 + 30 等于 50。',
  })
  await runtime.run('session-followup', '20 加 30 是多少？')

  // 追问：带着工具上下文继续追问并进行下一步计算
  llmClient.queueResponse({
    content: null,
    reasoning_content: '前一步结果是 50，现在用户要求乘以 2，调用 50 * 2',
    tool_calls: [
      {
        id: 'call_2',
        type: 'function',
        function: { name: 'calculator', arguments: JSON.stringify({ expression: '50 * 2' }) },
      },
    ],
  })
  llmClient.queueResponse({
    content: '把刚才的结果 50 乘以 2 得到 100。',
  })

  const followUpResult = await runtime.run('session-followup', '把刚才算出来的结果乘以 2')
  t.true(followUpResult.finalResponse.includes('100'))
})

test('Scenario 6: Tool error handling and self-healing', async (t) => {
  const { runtime, llmClient } = setupTestEnvironment()

  // 轮次 1：调用了错误的表达式
  llmClient.queueResponse({
    content: null,
    tool_calls: [
      {
        id: 'call_bad',
        type: 'function',
        function: { name: 'calculator', arguments: JSON.stringify({ expression: '10 / 0' }) },
      },
    ],
  })

  // 轮次 2：LLM 看到工具返回的错误信息（除以零），进行自愈和向用户解释
  llmClient.queueResponse({
    content: '抱歉，除以零在数学上是没有意义的，无法计算该表达式。',
    reasoning_content: '感知到计算器返回了除以零错误，向用户友好说明',
  })

  const res = await runtime.run('session-err', '计算 10 / 0')
  t.true(res.finalResponse.includes('除以零'))
})

test('Scenario 7: Max turns guard prevents infinite loops', async (t) => {
  const { runtime, llmClient } = setupTestEnvironment()

  // 构造死循环：总是返回 tool_call
  llmClient.setHandler(async () => ({
    content: null,
    tool_calls: [
      {
        id: `call_loop_${Date.now()}`,
        type: 'function',
        function: { name: 'calculator', arguments: JSON.stringify({ expression: '1 + 1' }) },
      },
    ],
  }))

  const res = await runtime.run('session-loop', '循环测试', { maxTurns: 3 })
  t.true(
    res.finalResponse.includes('达到最大轮次限制') ||
      res.finalResponse.includes('Max turns reached'),
  )
  t.is(res.turnsCount, 3)
})
