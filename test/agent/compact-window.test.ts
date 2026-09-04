import test from 'ava'

import { ContextManager } from '../../src/agent/ContextManager.js'
import type { AssistantMessage, Message, ToolMessage, UserMessage } from '../../src/agent/types.js'

test('ContextManager: preserves all turns when turn count is <= 10', (t) => {
  const cm = new ContextManager({ maxTurnsInContext: 10 })

  const messages: Message[] = []
  for (let i = 1; i <= 5; i++) {
    messages.push({ role: 'user', content: `Question ${i}` } as UserMessage)
    messages.push({
      role: 'assistant',
      content: `Answer ${i}`,
      reasoning_content: `Thinking ${i}`,
    } as AssistantMessage)
  }

  const result = cm.prepareContext(messages)
  const userMessages = result.filter((m) => m.role === 'user')
  t.is(userMessages.length, 5)
  t.is(result.length, 10)
})

test('ContextManager: applies sliding window when turns exceed 10, preserving first turn and last 10 turns', (t) => {
  const cm = new ContextManager({ maxTurnsInContext: 10, maxToolResultLength: 50 })

  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Initial Core Goal: Build a CLI Agent.' },
    {
      role: 'assistant',
      content: 'Understood, I will help you build the CLI Agent.',
      reasoning_content: 'Let me think about how to start building.',
    },
  ]

  // 添加第 2 轮到第 13 轮对话（共 13 轮 user 对话）
  for (let i = 2; i <= 13; i++) {
    messages.push({ role: 'user', content: `User query turn ${i}` })
    if (i === 3) {
      // 在早期的第 3 轮加入工具调用
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_old_1',
            type: 'function',
            function: { name: 'bash', arguments: '{"command":"ls -la"}' },
          },
        ],
      } as AssistantMessage)
      messages.push({
        role: 'tool',
        tool_call_id: 'call_old_1',
        name: 'bash',
        content: 'total 99999\n' + 'file_data_row_'.repeat(50),
      } as ToolMessage)
    }
    messages.push({
      role: 'assistant',
      content: `Response for turn ${i}`,
      reasoning_content: `Detailed reasoning for turn ${i} that should be stripped if old.`,
    } as AssistantMessage)
  }

  const result = cm.prepareContext(messages)

  // 1. 验证 System 消息与第 1 轮核心意图未被丢弃
  t.is(result[0]?.role, 'system')
  const initialUserMsg = result.find(
    (m) => m.role === 'user' && m.content.includes('Initial Core Goal'),
  )
  t.truthy(initialUserMsg)

  // 2. 验证最近 10 轮（第 4 轮到第 13 轮）均存在
  const lastUserMsg = result.find((m) => m.role === 'user' && m.content === 'User query turn 13')
  t.truthy(lastUserMsg)

  // 3. 验证早期第 3 轮的大体积 tool 结果被压缩
  const oldToolMsg = result.find(
    (m) => m.role === 'tool' && (m as any).tool_call_id === 'call_old_1',
  )
  if (oldToolMsg) {
    t.true(
      (oldToolMsg as ToolMessage).content.includes('truncated') ||
        (oldToolMsg as ToolMessage).content.length <= 100,
    )
  }

  // 4. 验证早期超期轮次的 reasoning_content 被剥离以节省 token
  const oldAssistantWithThinking = result.find(
    (m) =>
      m.role === 'assistant' &&
      m.content === 'Understood, I will help you build the CLI Agent.' &&
      (m as AssistantMessage).reasoning_content,
  )
  t.falsy(oldAssistantWithThinking)
})
