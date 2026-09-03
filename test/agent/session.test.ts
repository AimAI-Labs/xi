import test from 'ava'

import { SessionStore } from '../../src/agent/SessionStore.js'
import type { Message } from '../../src/agent/types.js'

test('SessionStore manages sessions and isolates messages between sessions', (t) => {
  const store = new SessionStore()

  const s1 = store.getOrCreateSession('window-1')
  const s2 = store.getOrCreateSession('window-2')

  t.is(s1.id, 'window-1')
  t.is(s2.id, 'window-2')
  t.deepEqual(s1.messages, [])
  t.deepEqual(s2.messages, [])

  // 窗口 1 追加消息
  const msg1: Message = { role: 'user', content: '让 Agent 查天气记待办' }
  store.appendMessage('window-1', msg1)

  // 窗口 2 追加消息
  const msg2: Message = { role: 'user', content: '让 Agent 写周报记待办' }
  store.appendMessage('window-2', msg2)

  // 验证隔离
  const s1Messages = store.getMessages('window-1')
  const s2Messages = store.getMessages('window-2')

  t.is(s1Messages.length, 1)
  t.is(s1Messages[0]?.content, '让 Agent 查天气记待办')

  t.is(s2Messages.length, 1)
  t.is(s2Messages[0]?.content, '让 Agent 写周报记待办')
})

test('SessionStore supports clear and delete', (t) => {
  const store = new SessionStore()
  store.getOrCreateSession('temp-session')
  t.true(store.has('temp-session'))

  store.delete('temp-session')
  t.false(store.has('temp-session'))
})
