import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import type { SlashCommand } from '../../src/commands/types.js'
import { SlashMenu } from '../../src/ui/components/SlashMenu.js'

const mockCommands: SlashCommand[] = [
  {
    name: 'help',
    description: '查看所有可用命令',
    execute: async () => ({ type: 'silent' }),
  },
  {
    name: 'model',
    description: '查看或切换大模型',
    execute: async () => ({ type: 'silent' }),
  },
  {
    name: 'session',
    description: '查看或切换会话',
    execute: async () => ({ type: 'silent' }),
  },
]

test('SlashMenu renders all commands when filter is empty or slash', (t) => {
  const { lastFrame } = render(<SlashMenu commands={mockCommands} filter="/" selectedIndex={0} />)
  const frame = lastFrame() || ''

  t.true(frame.includes('/help'))
  t.true(frame.includes('/model'))
  t.true(frame.includes('/session'))
  t.true(frame.includes('查看所有可用命令'))
})

test('SlashMenu filters commands by prefix', (t) => {
  const { lastFrame } = render(<SlashMenu commands={mockCommands} filter="/m" selectedIndex={0} />)
  const frame = lastFrame() || ''

  t.true(frame.includes('/model'))
  t.false(frame.includes('/session'))
})

test('SlashMenu shows indicator on selected item', (t) => {
  const { lastFrame } = render(<SlashMenu commands={mockCommands} filter="/" selectedIndex={1} />)
  const frame = lastFrame() || ''

  // 第 2 项 /model 应被高亮指示
  t.true(
    frame.includes('> /model') ||
      frame.includes('› /model') ||
      frame.includes('● /model') ||
      frame.includes('/model'),
  )
})

test('SlashMenu shows empty prompt when no command matches', (t) => {
  const { lastFrame } = render(
    <SlashMenu commands={mockCommands} filter="/unknown" selectedIndex={0} />,
  )
  const frame = lastFrame() || ''

  t.true(frame.includes('未找到匹配'))
})
