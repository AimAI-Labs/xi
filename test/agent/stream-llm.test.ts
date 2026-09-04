import test from 'ava'

import { MockLLMClient, OpenAICompatibleClient } from '../../src/agent/LLMClient.js'
import type { LLMStreamChunk } from '../../src/agent/types.js'

test('MockLLMClient queues stream chunks and yields them in sequence', async (t) => {
  const client = new MockLLMClient()
  const expectedChunks: LLMStreamChunk[] = [
    { reasoning_content: '思考中...' },
    { content: '你好' },
    { content: '，世界！' },
    { isDone: true },
  ]

  client.queueStreamChunks(expectedChunks)

  const received: LLMStreamChunk[] = []
  for await (const chunk of client.chatStream([{ role: 'user', content: 'hi' }])) {
    received.push(chunk)
  }

  t.is(received.length, 4)
  t.is(received[0]?.reasoning_content, '思考中...')
  t.is(received[1]?.content, '你好')
  t.is(received[2]?.content, '，世界！')
  t.true(received[3]?.isDone)
})

test('OpenAICompatibleClient parses SSE text stream with reasoning_content and content', async (t) => {
  const sseBody = [
    'data: {"choices":[{"delta":{"reasoning_content":"仔细思考一会"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"这是"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"回答"}}]}\n\n',
    'data: [DONE]\n\n',
  ].join('')

  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody))
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    }

    const client = new OpenAICompatibleClient({ apiKey: 'test-key' })
    const received: LLMStreamChunk[] = []

    for await (const chunk of client.chatStream([{ role: 'user', content: 'test' }])) {
      received.push(chunk)
    }

    t.true(received.length >= 3)
    const reasoningChunk = received.find((c) => c.reasoning_content)
    t.is(reasoningChunk?.reasoning_content, '仔细思考一会')

    const content = received.map((c) => c.content || '').join('')
    t.is(content, '这是回答')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OpenAICompatibleClient assembles chunked tool_calls arguments from SSE', async (t) => {
  const sseBody = [
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"bash","arguments":""}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"command\\":"}}]}}]}\n\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"node -v\\"}"}}]}}]}\n\n',
    'data: [DONE]\n\n',
  ].join('')

  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseBody))
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    }

    const client = new OpenAICompatibleClient({ apiKey: 'test-key' })
    let finalToolCalls = undefined

    for await (const chunk of client.chatStream([{ role: 'user', content: 'run node -v' }])) {
      if (chunk.tool_calls && chunk.tool_calls.length > 0) {
        finalToolCalls = chunk.tool_calls
      }
    }

    t.truthy(finalToolCalls)
    t.is(finalToolCalls!.length, 1)
    t.is(finalToolCalls![0]!.id, 'call_123')
    t.is(finalToolCalls![0]!.function.name, 'bash')
    t.is(finalToolCalls![0]!.function.arguments, '{"command":"node -v"}')
  } finally {
    globalThis.fetch = originalFetch
  }
})
