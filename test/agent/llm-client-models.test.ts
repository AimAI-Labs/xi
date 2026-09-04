import test from 'ava'

import { MockLLMClient, OpenAICompatibleClient } from '../../src/agent/LLMClient.js'

test('OpenAICompatibleClient fetches models from /models and parses data[].id', async (t) => {
  const originalFetch = globalThis.fetch
  let fetchCallCount = 0

  globalThis.fetch = (async (url: string, init: any) => {
    fetchCallCount++
    t.is(url, 'https://api.deepseek.com/models')
    t.is(init.headers['Authorization'], 'Bearer sk-test-key')

    return {
      ok: true,
      json: async () => ({
        object: 'list',
        data: [
          { id: 'deepseek-chat', object: 'model' },
          { id: 'deepseek-reasoner', object: 'model' },
          { id: 'deepseek-coder', object: 'model' },
        ],
      }),
    } as any
  }) as any

  try {
    const client = new OpenAICompatibleClient({
      apiKey: 'sk-test-key',
      baseURL: 'https://api.deepseek.com',
    })

    const models = await client.fetchModels()
    t.deepEqual(models, ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'])
    t.is(fetchCallCount, 1)

    // 验证内存缓存：再次调用应复用缓存，不再发起 fetch
    const cachedModels = await client.fetchModels()
    t.deepEqual(cachedModels, ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'])
    t.is(fetchCallCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OpenAICompatibleClient falls back gracefully when fetch fails or returns error status', async (t) => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as any
  }) as any

  try {
    const client = new OpenAICompatibleClient({
      apiKey: 'sk-test-key',
    })

    const models = await client.fetchModels()
    t.true(models.length > 0)
    t.true(models.includes('deepseek-chat'))
    t.true(models.includes('deepseek-reasoner'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('OpenAICompatibleClient returns fallback models when apiKey is missing', async (t) => {
  const originalDeepSeekKey = process.env['DEEPSEEK_API_KEY']
  const originalOpenAIKey = process.env['OPENAI_API_KEY']
  delete process.env['DEEPSEEK_API_KEY']
  delete process.env['OPENAI_API_KEY']

  try {
    const client = new OpenAICompatibleClient({
      apiKey: '',
    })

    const models = await client.fetchModels()
    t.true(models.includes('deepseek-chat'))
  } finally {
    if (originalDeepSeekKey) process.env['DEEPSEEK_API_KEY'] = originalDeepSeekKey
    if (originalOpenAIKey) process.env['OPENAI_API_KEY'] = originalOpenAIKey
  }
})

test('MockLLMClient implements fetchModels and allows setAvailableModels', async (t) => {
  const mockClient = new MockLLMClient()
  const defaultModels = await mockClient.fetchModels()
  t.true(defaultModels.length > 0)

  mockClient.setAvailableModels(['custom-model-1', 'custom-model-2'])
  const customModels = await mockClient.fetchModels()
  t.deepEqual(customModels, ['custom-model-1', 'custom-model-2'])
})
