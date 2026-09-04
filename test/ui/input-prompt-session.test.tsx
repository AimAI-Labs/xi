import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import type { SessionSummary } from '../../src/agent/SessionStore.js'
import { InputPrompt } from '../../src/ui/components/InputPrompt.js'

test('InputPrompt renders SessionMenu when typing /session with a space', async (t) => {
  const sessions: SessionSummary[] = [
    { id: 'session-default', updatedAt: 5000, createdAt: 1000, messageCount: 3 },
    { id: 'session-debug', updatedAt: 3000, createdAt: 2000, messageCount: 1 },
  ]

  const { lastFrame } = render(
    <InputPrompt
      currentSessionId="session-default"
      initialValue="/session "
      onExit={() => {}}
      onFetchSessions={() => sessions}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))

  const frame = lastFrame() || ''
  t.true(frame.includes('会话列表'))
  t.true(frame.includes('session-default'))
  t.true(frame.includes('(当前)'))
  t.true(frame.includes('session-debug'))
  t.true(frame.includes('3 条消息'))
})

test('InputPrompt supports /s alias for session menu', async (t) => {
  const sessions: SessionSummary[] = [
    { id: 'session-alpha', updatedAt: 5000, createdAt: 1000, messageCount: 2 },
  ]

  const { lastFrame } = render(
    <InputPrompt
      currentSessionId="session-alpha"
      initialValue="/s "
      onExit={() => {}}
      onFetchSessions={() => sessions}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))

  const frame = lastFrame() || ''
  t.true(frame.includes('会话列表'))
  t.true(frame.includes('session-alpha'))
})

test('InputPrompt filters sessions with fuzzyMatch when typing filter keyword', async (t) => {
  const sessions: SessionSummary[] = [
    { id: 'test-stream', updatedAt: 5000, createdAt: 1000, messageCount: 2 },
    { id: 'window-dev', updatedAt: 4000, createdAt: 2000, messageCount: 4 },
  ]

  // 输入 /session ts，应该通过 fuzzyMatch 匹配出 test-stream，排除 window-dev
  const { lastFrame } = render(
    <InputPrompt
      currentSessionId="window-dev"
      initialValue="/session ts"
      onExit={() => {}}
      onFetchSessions={() => sessions}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))

  const frame = lastFrame() || ''
  t.true(frame.includes('test-stream'))
  t.false(frame.includes('window-dev'))
})

test('InputPrompt renders SessionMenu below the input dialog box', async (t) => {
  const sessions: SessionSummary[] = [
    { id: 'session-1', updatedAt: 5000, createdAt: 1000, messageCount: 1 },
  ]

  const { lastFrame } = render(
    <InputPrompt
      currentSessionId="session-1"
      initialValue="/session "
      onExit={() => {}}
      onFetchSessions={() => sessions}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))

  const frame = lastFrame() || ''
  const inputPos = frame.indexOf('ξ >')
  const menuPos = frame.indexOf('会话列表')
  t.true(inputPos !== -1)
  t.true(menuPos !== -1)
  t.true(inputPos < menuPos, '输入对话框应位于菜单浮层之上（菜单位于对话框下方）')
})
