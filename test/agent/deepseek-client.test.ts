import test from 'ava'

import { OpenAICompatibleClient } from '../../src/agent/LLMClient.js'

test('OpenAICompatibleClient defaults to DeepSeek endpoint and deepseek-v4-flash', (t) => {
  const originalDeepSeekKey = process.env['DEEPSEEK_API_KEY']
  const originalOpenAIKey = process.env['OPENAI_API_KEY']
  delete process.env['DEEPSEEK_API_KEY']
  delete process.env['OPENAI_API_KEY']

  try {
    const client = new OpenAICompatibleClient()
    t.is(client.getBaseURL(), 'https://api.deepseek.com')
    t.is(client.getModel(), 'deepseek-v4-flash')
  } finally {
    if (originalDeepSeekKey) process.env['DEEPSEEK_API_KEY'] = originalDeepSeekKey
    if (originalOpenAIKey) process.env['OPENAI_API_KEY'] = originalOpenAIKey
  }
})

test('OpenAICompatibleClient properly parses reasoning_content and think tags from DeepSeek response', async (t) => {
  const originalFetch = globalThis.fetch

  // 模拟 DeepSeek API 返回 choices[0].message 带 reasoning_content 与 <think>
  globalThis.fetch = (async (url: string, init: any) => {
    t.true(url.includes('chat/completions'))
    const body = JSON.parse(init.body)
    t.is(body.model, 'deepseek-v4-flash')

    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '<think>这是内置在文本里的分析思考过程</think>最终回答在这里',
              reasoning_content: 'API 返回的显式思考链',
            },
          },
        ],
      }),
    } as any
  }) as any

  try {
    const client = new OpenAICompatibleClient({
      apiKey: 'sk-test',
    })

    const response = await client.chat([{ role: 'user', content: '测试思考模式' }])
    t.is(response.content, '最终回答在这里')
    t.true(response.reasoning_content?.includes('API 返回的显式思考链'))
    t.true(response.reasoning_content?.includes('这是内置在文本里的分析思考过程'))
  } finally {
    globalThis.fetch = originalFetch
  }
})
