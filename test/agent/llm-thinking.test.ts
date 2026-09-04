import test from 'ava'

import { OpenAICompatibleClient } from '../../src/agent/LLMClient.js'

test.serial(
  'OpenAICompatibleClient.chat injects thinking disabled/enabled to request body',
  async (t) => {
    const originalFetch = globalThis.fetch
    const capturedBodies: any[] = []

    globalThis.fetch = (async (_url: string, init: any) => {
      capturedBodies.push(JSON.parse(init.body))
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'ok',
              },
            },
          ],
        }),
      } as any
    }) as any

    try {
      const client = new OpenAICompatibleClient({ apiKey: 'sk-test' })

      // 1. thinking: false -> { type: 'disabled' }
      await client.chat([{ role: 'user', content: 'hello' }], undefined, { thinking: false })
      t.deepEqual(capturedBodies[0]?.thinking, { type: 'disabled' })

      // 2. thinking: true -> { type: 'enabled' }
      await client.chat([{ role: 'user', content: 'hello' }], undefined, { thinking: true })
      t.deepEqual(capturedBodies[1]?.thinking, { type: 'enabled' })

      // 3. undefined options -> no thinking field
      await client.chat([{ role: 'user', content: 'hello' }])
      t.is(capturedBodies[2]?.thinking, undefined)
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)

test.serial(
  'OpenAICompatibleClient.chatStream injects thinking disabled/enabled to request body',
  async (t) => {
    const originalFetch = globalThis.fetch
    const capturedBodies: any[] = []

    globalThis.fetch = (async (_url: string, init: any) => {
      capturedBodies.push(JSON.parse(init.body))

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return {
        ok: true,
        body: stream,
      } as any
    }) as any

    try {
      const client = new OpenAICompatibleClient({ apiKey: 'sk-test' })

      // 1. thinking: false in stream
      const iter1 = client.chatStream([{ role: 'user', content: 'hello' }], undefined, {
        thinking: false,
      })
      for await (const _chunk of iter1) {
        // consume
      }
      t.deepEqual(capturedBodies[0]?.thinking, { type: 'disabled' })

      // 2. thinking: true in stream
      const iter2 = client.chatStream([{ role: 'user', content: 'hello' }], undefined, {
        thinking: true,
      })
      for await (const _chunk of iter2) {
        // consume
      }
      t.deepEqual(capturedBodies[1]?.thinking, { type: 'enabled' })

      // 3. undefined in stream
      const iter3 = client.chatStream([{ role: 'user', content: 'hello' }])
      for await (const _chunk of iter3) {
        // consume
      }
      t.is(capturedBodies[2]?.thinking, undefined)
    } finally {
      globalThis.fetch = originalFetch
    }
  },
)
