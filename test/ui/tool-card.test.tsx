import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { ToolCallCard } from '../../src/ui/components/ToolCallCard.js'

test('ToolCallCard renders running state with bash command', (t) => {
  const { lastFrame } = render(
    <ToolCallCard args={{ command: 'git status' }} status="running" toolName="bash" />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('bash'))
  t.true(frame.includes('git status'))
})

test('ToolCallCard: bash hides output by default and displays command and Ctrl+O hint', (t) => {
  const { lastFrame } = render(
    <ToolCallCard
      args={{ command: 'node -v' }}
      durationMs={120}
      result="v22.0.0"
      status="completed"
      toolName="bash"
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('✔'))
  t.true(frame.includes('bash'))
  t.true(frame.includes('node -v'))
  t.true(frame.includes('120ms'))
  t.true(frame.includes('Ctrl+O 展开'))
  // 默认不显示内容
  t.false(frame.includes('v22.0.0'))
})

test('ToolCallCard: bash shows full output when isExpanded is true', (t) => {
  const { lastFrame } = render(
    <ToolCallCard
      args={{ command: 'node -v' }}
      durationMs={120}
      isExpanded={true}
      result="v22.0.0"
      status="completed"
      toolName="bash"
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('✔'))
  t.true(frame.includes('bash'))
  t.true(frame.includes('node -v'))
  t.true(frame.includes('120ms'))
  t.true(frame.includes('Ctrl+O 折叠'))
  // 展开后显示具体输出内容
  t.true(frame.includes('v22.0.0'))
})

test('ToolCallCard renders error state with error message', (t) => {
  const { lastFrame } = render(
    <ToolCallCard
      args={{ command: 'unknown-cmd' }}
      durationMs={50}
      isExpanded={true}
      result="Command not found"
      status="error"
      toolName="bash"
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('✖'))
  t.true(frame.includes('bash'))
  t.true(frame.includes('Command not found'))
})
