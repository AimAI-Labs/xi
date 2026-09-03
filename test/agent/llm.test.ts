import test from 'ava'

import { MockLLMClient } from '../../src/agent/LLMClient.js'
import type { Message } from '../../src/agent/types.js'

test('MockLLMClient queues responses and returns them in sequence', async (t) => {
  const client = new MockLLMClient()

  // 预置两轮回复
  client.queueResponse({
    content: null,
    reasoning_content: '用户想计算表达式，需要调用计算器',
    tool_calls: [
      {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'calculator',
          arguments: JSON.stringify({ expression: '5 * 6' }),
        },
      },
    ],
  })

  client.queueResponse({
    content: '5 乘以 6 的结果是 30。',
    reasoning_content: '计算器已返回 30，直接总结回答',
  })

  const messages1: Message[] = [{ role: 'user', content: '5 * 6 等于几？' }]
  const res1 = await client.chat(messages1)
  t.is(res1.tool_calls?.length, 1)
  t.is(res1.tool_calls?.[0]?.function.name, 'calculator')
  t.is(res1.reasoning_content, '用户想计算表达式，需要调用计算器')

  const messages2: Message[] = [
    ...messages1,
    { role: 'assistant', content: null, tool_calls: res1.tool_calls },
    { role: 'tool', tool_call_id: 'call_123', name: 'calculator', content: '30' },
  ]
  const res2 = await client.chat(messages2)
  t.is(res2.content, '5 乘以 6 的结果是 30。')
  t.falsy(res2.tool_calls)
})

test('MockLLMClient supports handler function for dynamic responses', async (t) => {
  const client = new MockLLMClient({
    handler: async (messages) => {
      const lastMsg = messages[messages.length - 1]
      return {
        content: `Echo: ${lastMsg?.content}`,
      }
    },
  })

  const res = await client.chat([{ role: 'user', content: 'Ping' }])
  t.is(res.content, 'Echo: Ping')
})
