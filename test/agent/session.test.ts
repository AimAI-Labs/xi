import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'

import { SessionStore } from '../../src/agent/SessionStore.js'
import type { Message } from '../../src/agent/types.js'

test('SessionStore manages sessions and isolates messages between sessions', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store = new SessionStore(tmpDir)

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

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore supports clear and delete and syncs to disk', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store = new SessionStore(tmpDir)
  store.getOrCreateSession('temp-session')
  t.true(store.has('temp-session'))

  const sessionFile = path.join(tmpDir, 'temp-session.json')
  t.true(fs.existsSync(sessionFile))

  store.delete('temp-session')
  t.false(store.has('temp-session'))
  t.false(fs.existsSync(sessionFile))

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore persists sessions to disk and reloads on cold start', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store1 = new SessionStore(tmpDir)

  const userMsg: Message = { role: 'user', content: '测试持久化' }
  const asstMsg: Message = { role: 'assistant', content: '确认收到', reasoning_content: '思考链条' }
  store1.appendMessage('chat-persist', userMsg)
  store1.appendMessage('chat-persist', asstMsg)

  const filePath = path.join(tmpDir, 'chat-persist.json')
  t.true(fs.existsSync(filePath))

  // 模拟冷启动：新建 store2 指向相同目录
  const store2 = new SessionStore(tmpDir)
  t.true(store2.has('chat-persist'))
  const messages = store2.getMessages('chat-persist')
  t.is(messages.length, 2)
  t.is(messages[0]?.content, '测试持久化')
  t.is(messages[1]?.content, '确认收到')
  t.is(messages[1]?.role, 'assistant')

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore immediate atomic write on setMessages and clearMessages', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store = new SessionStore(tmpDir)

  store.setMessages('atomic-test', [{ role: 'user', content: '原始消息' }])
  const filePath = path.join(tmpDir, 'atomic-test.json')
  t.true(fs.existsSync(filePath))
  let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  t.is(content.messages.length, 1)

  store.clearMessages('atomic-test')
  content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  t.is(content.messages.length, 0)

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore getAllSessionIds scans disk on cold start', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store1 = new SessionStore(tmpDir)

  store1.appendMessage('session-alpha', { role: 'user', content: 'A' })
  store1.appendMessage('session-beta', { role: 'user', content: 'B' })

  // 冷启动新实例
  const store2 = new SessionStore(tmpDir)
  const ids = store2.getAllSessionIds()
  t.true(ids.includes('session-alpha'))
  t.true(ids.includes('session-beta'))

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore gracefully handles corrupted json file without throwing', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  fs.mkdirSync(tmpDir, { recursive: true })

  // 写入非法 JSON 损坏文件
  const corruptFile = path.join(tmpDir, 'corrupt-session.json')
  fs.writeFileSync(corruptFile, '{ invalid json content !!!', 'utf-8')

  const store = new SessionStore(tmpDir)
  t.notThrows(() => {
    const session = store.getSession('corrupt-session')
    t.is(session, undefined)
  })

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore sanitizes session id to safe filename', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store = new SessionStore(tmpDir)

  const unsafeId = 'test/window:01*?path'
  store.appendMessage(unsafeId, { role: 'user', content: '安全路径测试' })

  // 不应在外部目录创建文件，而在 tmpDir 内部安全落盘
  const files = fs.readdirSync(tmpDir)
  t.is(files.length, 1)
  t.false(files[0]!.includes('/'))
  t.false(files[0]!.includes(':'))

  const reloaded = store.getMessages(unsafeId)
  t.is(reloaded.length, 1)
  t.is(reloaded[0]?.content, '安全路径测试')

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('SessionStore.getAllSessions returns sessions sorted by updatedAt descending', (t) => {
  const tmpDir = path.join(os.tmpdir(), `xi-test-session-${Date.now()}-${Math.random()}`)
  const store = new SessionStore(tmpDir)

  // 1. 先写 session-early
  const s1 = store.getOrCreateSession('session-early')
  s1.updatedAt = 1000
  s1.messages = [{ role: 'user', content: '早先对话' }]
  store.setMessages('session-early', s1.messages)

  // 2. 写 session-latest
  const s2 = store.getOrCreateSession('session-latest')
  s2.updatedAt = 5000
  s2.messages = [
    { role: 'user', content: '最新对话1' },
    { role: 'assistant', content: '最新回答' },
  ]
  store.setMessages('session-latest', s2.messages)

  // 3. 写 session-middle
  const s3 = store.getOrCreateSession('session-middle')
  s3.updatedAt = 3000
  s3.messages = [{ role: 'user', content: '中间对话' }]
  store.setMessages('session-middle', s3.messages)

  // 手动调整磁盘和内存中的 updatedAt 确保稳定
  store.getSession('session-early')!.updatedAt = 1000
  store.getSession('session-latest')!.updatedAt = 5000
  store.getSession('session-middle')!.updatedAt = 3000

  // 重新从冷启动的新 store 实例测试（验证不仅内存正确，磁盘序列化也能正确读取并降序排列）
  const coldStore = new SessionStore(tmpDir)
  // 为精确测试 updatedAt 排序，直接修改冷启动 store 内存中的 session 或依赖读取
  const list = coldStore.getAllSessions()

  t.is(list.length, 3)
  // 必须按 updatedAt 降序排序
  t.true(list[0]!.updatedAt >= list[1]!.updatedAt)
  t.true(list[1]!.updatedAt >= list[2]!.updatedAt)

  // 验证提取的字段
  const target = list.find((item) => item.id === 'session-latest')
  t.truthy(target)
  t.is(target?.messageCount, 2)
  t.is(target?.lastUserMessage, '最新对话1')

  const middle = list.find((item) => item.id === 'session-middle')
  t.is(middle?.lastUserMessage, '中间对话')

  // 空会话
  coldStore.getOrCreateSession('session-empty')
  const updatedList = coldStore.getAllSessions()
  const emptyTarget = updatedList.find((item) => item.id === 'session-empty')
  t.is(emptyTarget?.lastUserMessage, undefined)

  fs.rmSync(tmpDir, { recursive: true, force: true })
})
