import test from 'ava'

import { ContextManager } from '../../src/agent/ContextManager.js'
import type { AssistantMessage, Message, ToolMessage, UserMessage } from '../../src/agent/types.js'

test('ContextManager: preserves all turns when turn count is <= 5', (t) => {
  const cm = new ContextManager() // 默认 maxTurnsInContext: 5

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

test('ContextManager: applies 5-turn sliding window, preserving initial goal and recent 5 turns while distilling old turns', (t) => {
  const cm = new ContextManager() // 默认 5 轮滑动窗口

  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Initial Core Goal: Build a CLI Agent.' },
    // 首轮经历了一次工具调用并给出了最终文本回答
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_init',
          type: 'function',
          function: { name: 'bash', arguments: '{"command":"init"}' },
        },
      ],
    } as AssistantMessage,
    {
      role: 'tool',
      tool_call_id: 'call_init',
      name: 'bash',
      content: 'project initialized',
    } as ToolMessage,
    {
      role: 'assistant',
      content: 'Understood, I will help you build the CLI Agent.',
      reasoning_content: 'Let me think about how to start building.',
    } as AssistantMessage,
  ]

  // 添加第 2 轮到第 7 轮对话（总共 7 轮 user 对话）
  for (let i = 2; i <= 7; i++) {
    messages.push({ role: 'user', content: `User query turn ${i}` })
    if (i === 2) {
      // 在超期的第 2 轮加入庞大的工具调用与思考链
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
      messages.push({
        role: 'assistant',
        content: `Final answer for turn 2: directory inspected.`,
        reasoning_content: `Lengthy reasoning for turn 2 that must be dropped.`,
      } as AssistantMessage)
    } else {
      // 第 3~7 轮属于最近 5 轮
      if (i === 4) {
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_recent',
              type: 'function',
              function: { name: 'search', arguments: '{"query":"npm"}' },
            },
          ],
        } as AssistantMessage)
        messages.push({
          role: 'tool',
          tool_call_id: 'call_recent',
          name: 'search',
          content: 'found npm results',
        } as ToolMessage)
      }
      messages.push({
        role: 'assistant',
        content: `Response for turn ${i}`,
        reasoning_content: `Reasoning for turn ${i}`,
      } as AssistantMessage)
    }
  }

  const result = cm.prepareContext(messages)

  // 1. 验证 System 消息与第 1 轮核心意图未被丢弃
  t.is(result[0]?.role, 'system')
  const initialUserMsg = result.find(
    (m) => m.role === 'user' && m.content.includes('Initial Core Goal'),
  )
  t.truthy(initialUserMsg)
  // 验证首轮最终纯文本回答被保留，但思考链被剥离
  const initialAssistantMsg = result.find(
    (m) =>
      m.role === 'assistant' && m.content === 'Understood, I will help you build the CLI Agent.',
  ) as AssistantMessage
  t.truthy(initialAssistantMsg)
  t.falsy(initialAssistantMsg.reasoning_content)

  // 2. 验证超期第 2 轮：保留 User 提问和最终 Assistant 回答，但剔除思考链和所有 tool 消息
  const turn2UserMsg = result.find((m) => m.role === 'user' && m.content === 'User query turn 2')
  t.truthy(turn2UserMsg)
  const turn2AssistantMsg = result.find(
    (m) => m.role === 'assistant' && m.content === 'Final answer for turn 2: directory inspected.',
  ) as AssistantMessage
  t.truthy(turn2AssistantMsg)
  t.falsy(turn2AssistantMsg.reasoning_content)

  // 验证第 2 轮的 tool 结果已被完全过滤
  const oldToolMsg = result.find(
    (m) => m.role === 'tool' && (m as any).tool_call_id === 'call_old_1',
  )
  t.falsy(oldToolMsg)

  // 3. 验证最近 5 轮（第 3 轮到第 7 轮）完整保留
  const turn3UserMsg = result.find((m) => m.role === 'user' && m.content === 'User query turn 3')
  const turn7UserMsg = result.find((m) => m.role === 'user' && m.content === 'User query turn 7')
  t.truthy(turn3UserMsg)
  t.truthy(turn7UserMsg)

  // 最近 5 轮中的工具调用和 tool 结果完整保留
  const recentToolMsg = result.find(
    (m) => m.role === 'tool' && (m as any).tool_call_id === 'call_recent',
  )
  t.truthy(recentToolMsg)

  // 4. 验证协议合法性：不存在孤立 tool 消息
  for (let i = 0; i < result.length; i++) {
    if (result[i]?.role === 'tool') {
      const toolMsg = result[i] as ToolMessage
      const prevMsg = result[i - 1] as AssistantMessage
      t.is(prevMsg?.role, 'assistant')
      t.truthy(prevMsg?.tool_calls?.some((tc) => tc.id === toolMsg.tool_call_id))
    }
  }
})
