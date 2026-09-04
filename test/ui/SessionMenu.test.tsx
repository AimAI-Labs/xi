import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import type { SessionSummary } from '../../src/agent/SessionStore.js'
import { fuzzyMatch, SessionMenu } from '../../src/ui/components/SessionMenu.js'

test('fuzzyMatch supports exact, substring, and subsequence abbreviation search', (t) => {
  // 1. 空查询
  t.true(fuzzyMatch('', 'test-stream'))

  // 2. 子串匹配
  t.true(fuzzyMatch('stream', 'test-stream'))
  t.true(fuzzyMatch('test', 'test-stream'))
  t.true(fuzzyMatch('STREAM', 'test-stream'))

  // 3. 缩写/跳跃子序列匹配
  t.true(fuzzyMatch('ts', 'test-stream'))
  t.true(fuzzyMatch('tst', 'test-stream'))
  t.true(fuzzyMatch('w2', 'window-2'))
  t.true(fuzzyMatch('win2', 'window-2'))

  // 4. 不匹配
  t.false(fuzzyMatch('xyz', 'test-stream'))
  t.false(fuzzyMatch('2w', 'window-2'))
})

test('SessionMenu renders sessions list and highlights selected item', (t) => {
  const sessions: SessionSummary[] = [
    { id: 'session-alpha', updatedAt: 5000, createdAt: 1000, messageCount: 4 },
    { id: 'session-beta', updatedAt: 3000, createdAt: 2000, messageCount: 1 },
  ]

  const { lastFrame } = render(
    <SessionMenu
      currentSessionId="session-alpha"
      filter=""
      selectedIndex={1}
      sessions={sessions}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('会话列表'))
  t.true(frame.includes('session-alpha'))
  t.true(frame.includes('(当前)'))
  t.true(frame.includes('session-beta'))
  t.true(frame.includes('> session-beta'))
  t.true(frame.includes('4 条消息'))
  t.true(frame.includes('1 条消息'))
})

test('SessionMenu filters sessions by fuzzyMatch', (t) => {
  const sessions: SessionSummary[] = [
    { id: 'test-stream', updatedAt: 5000, createdAt: 1000, messageCount: 2 },
    { id: 'window-project', updatedAt: 4000, createdAt: 2000, messageCount: 5 },
    { id: 'work-log', updatedAt: 3000, createdAt: 3000, messageCount: 0 },
  ]

  // 输入 "ts" 应该模糊匹配到 test-stream
  const { lastFrame } = render(
    <SessionMenu
      currentSessionId="test-stream"
      filter="ts"
      selectedIndex={0}
      sessions={sessions}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('test-stream'))
  t.false(frame.includes('window-project'))
  t.false(frame.includes('work-log'))
})

test('SessionMenu renders empty hint when no session matches', (t) => {
  const sessions: SessionSummary[] = [
    { id: 'session-alpha', updatedAt: 5000, createdAt: 1000, messageCount: 2 },
  ]

  const { lastFrame } = render(
    <SessionMenu
      currentSessionId="session-alpha"
      filter="non-existent"
      selectedIndex={0}
      sessions={sessions}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('未找到匹配的会话'))
})

test('SessionMenu displays lastUserMessage after session id and truncates long text', (t) => {
  const sessions: SessionSummary[] = [
    {
      id: 'session-weather',
      updatedAt: 5000,
      createdAt: 1000,
      messageCount: 2,
      lastUserMessage: '帮我查询北京今日天气',
    },
    {
      id: 'session-long',
      updatedAt: 4000,
      createdAt: 2000,
      messageCount: 3,
      lastUserMessage: '这是一个非常非常非常非常非常非常非常长的提问内容',
    },
  ]

  const { lastFrame } = render(
    <SessionMenu
      currentSessionId="session-weather"
      filter=""
      selectedIndex={0}
      sessions={sessions}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('session-weather'))
  t.true(frame.includes('帮我查询北京今日天气'))
  t.true(frame.includes('session-long'))
  t.true(frame.includes('...'))
})

test('SessionMenu filters by lastUserMessage content using fuzzy search', (t) => {
  const sessions: SessionSummary[] = [
    {
      id: 'session-mtmkr8d6',
      updatedAt: 5000,
      createdAt: 1000,
      messageCount: 4,
      lastUserMessage: '写一份周报总结大纲',
    },
    {
      id: 'session-other',
      updatedAt: 3000,
      createdAt: 2000,
      messageCount: 2,
      lastUserMessage: '计算加减法',
    },
  ]

  // 用户通过输入消息关键词“周报”进行模糊搜索
  const { lastFrame } = render(
    <SessionMenu
      currentSessionId="session-other"
      filter="周报"
      selectedIndex={0}
      sessions={sessions}
    />,
  )

  const frame = lastFrame() || ''
  t.true(frame.includes('session-mtmkr8d6'))
  t.true(frame.includes('写一份周报总结大纲'))
  t.false(frame.includes('session-other'))
})
