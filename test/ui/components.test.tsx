import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { Header } from '../../src/ui/components/Header.js'
import { InputPrompt } from '../../src/ui/components/InputPrompt.js'
import { MessageItem } from '../../src/ui/components/MessageItem.js'
import { Spinner } from '../../src/ui/components/Spinner.js'
import type { DisplayItem } from '../../src/ui/types.js'

test('Header renders version, model and session', (t) => {
  const { lastFrame } = render(<Header model="gpt-4o-mini" sessionId="session-1" version="0.0.0" />)
  const frame = lastFrame() || ''
  t.true(frame.includes('xi'))
  t.true(frame.includes('gpt-4o-mini'))
  t.true(frame.includes('session-1'))
})

test('MessageItem renders user and assistant messages properly', (t) => {
  const userItem: DisplayItem = {
    id: '1',
    role: 'user',
    content: '你好呀',
    timestamp: Date.now(),
  }

  const assistantItem: DisplayItem = {
    id: '2',
    role: 'assistant',
    content: '我是 xi AI 助手',
    timestamp: Date.now(),
  }

  const { lastFrame: f1 } = render(<MessageItem item={userItem} />)
  t.true((f1() || '').includes('你好呀'))

  const { lastFrame: f2 } = render(<MessageItem item={assistantItem} />)
  t.true((f2() || '').includes('我是 xi AI 助手'))
})

test('MessageItem renders thinking and tool results', (t) => {
  const thinkingItem: DisplayItem = {
    id: '3',
    role: 'thinking',
    content: '正在规划计算步骤...',
    timestamp: Date.now(),
  }

  const toolItem: DisplayItem = {
    id: '4',
    role: 'tool',
    content: 'calculator: 56',
    timestamp: Date.now(),
  }

  const { lastFrame: f1 } = render(<MessageItem item={thinkingItem} />)
  t.true((f1() || '').includes('正在规划计算步骤...'))

  const { lastFrame: f2 } = render(<MessageItem item={toolItem} />)
  t.true((f2() || '').includes('calculator: 56'))
})

test('Spinner displays status text when active', (t) => {
  const { lastFrame } = render(<Spinner status="正在思考中..." />)
  t.true((lastFrame() || '').includes('正在思考中...'))
})

test('InputPrompt renders properly', (t) => {
  const { lastFrame } = render(<InputPrompt onSubmit={() => {}} onExit={() => {}} />)
  t.true((lastFrame() || '').includes('xi >'))
})
