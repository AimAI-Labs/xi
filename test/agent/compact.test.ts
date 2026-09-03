import test from 'ava'

import { ContextManager } from '../../src/agent/ContextManager.js'
import type { Message } from '../../src/agent/types.js'

test('ContextManager prepends system prompt if provided and not present', (t) => {
  const cm = new ContextManager({ systemPrompt: 'You are a helpful assistant' })
  const history: Message[] = [{ role: 'user', content: 'hello' }]

  const prepared = cm.prepareContext(history)
  t.is(prepared.length, 2)
  t.is(prepared[0]?.role, 'system')
  t.is(prepared[0]?.content, 'You are a helpful assistant')
  t.is(prepared[1]?.role, 'user')
})

test('ContextManager applies MicroCompact to old bulky tool results', (t) => {
  const cm = new ContextManager({
    enableMicroCompact: true,
    maxToolResultLength: 100, // 阈值设小便于测试
  })

  const longContent = 'A'.repeat(500)
  const recentLongContent = 'B'.repeat(500)

  const history: Message[] = [
    { role: 'user', content: 'step 1' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'tc-1', type: 'function', function: { name: 'bash', arguments: '{}' } }],
    },
    { role: 'tool', tool_call_id: 'tc-1', name: 'bash', content: longContent },
    { role: 'assistant', content: 'done step 1' },
    { role: 'user', content: 'step 2' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'tc-2', type: 'function', function: { name: 'bash', arguments: '{}' } }],
    },
    // 最新的 tool result
    { role: 'tool', tool_call_id: 'tc-2', name: 'bash', content: recentLongContent },
  ]

  const prepared = cm.prepareContext(history)

  // 历史的 tc-1 应该被裁剪截断
  const oldToolMsg = prepared.find((m) => m.role === 'tool' && m.tool_call_id === 'tc-1')
  t.truthy(oldToolMsg)
  t.true(oldToolMsg!.content.length < 250)
  t.true(oldToolMsg!.content.includes('[Tool result truncated'))

  // 最新的 tc-2 不应该被截断，保留给当前轮次决策
  const latestToolMsg = prepared.find((m) => m.role === 'tool' && m.tool_call_id === 'tc-2')
  t.truthy(latestToolMsg)
  t.is(latestToolMsg!.content, recentLongContent)
})

test('ContextManager applies sliding window when message count exceeds threshold', (t) => {
  const cm = new ContextManager({
    maxContextMessages: 5,
    enableMicroCompact: false,
  })

  const history: Message[] = [
    { role: 'user', content: 'goal: write report' },
    { role: 'assistant', content: 'ok' },
    { role: 'user', content: 'msg 1' },
    { role: 'assistant', content: 'reply 1' },
    { role: 'user', content: 'msg 2' },
    { role: 'assistant', content: 'reply 2' },
    { role: 'user', content: 'msg 3' },
  ]

  const prepared = cm.prepareContext(history)
  t.true(prepared.length <= 5)
  // 保留最初目标
  t.is(prepared[0]?.content, 'goal: write report')
  // 保留最新消息
  t.is(prepared[prepared.length - 1]?.content, 'msg 3')
})
