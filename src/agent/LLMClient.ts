import type { LLMResponse, LLMStreamChunk, Message, ToolCall } from './types.js'

export interface LLMCallOptions {
  thinking?: boolean
}

export interface LLMClient {
  chat(messages: Message[], tools?: any[], options?: LLMCallOptions): Promise<LLMResponse>
  chatStream(
    messages: Message[],
    tools?: any[],
    options?: LLMCallOptions,
  ): AsyncIterable<LLMStreamChunk>
  fetchModels?(): Promise<string[]>
}

export interface OpenAICompatibleClientOptions {
  apiKey?: string
  baseURL?: string
  model?: string
  temperature?: number
}

export class OpenAICompatibleClient implements LLMClient {
  private apiKey: string
  private baseURL: string
  private model: string
  private temperature: number
  private cachedModels: string[] | null = null
  private fetchModelsPromise: Promise<string[]> | null = null

  constructor(options: OpenAICompatibleClientOptions = {}) {
    this.apiKey =
      options.apiKey || process.env['DEEPSEEK_API_KEY'] || process.env['OPENAI_API_KEY'] || ''
    this.baseURL =
      options.baseURL ||
      process.env['DEEPSEEK_BASE_URL'] ||
      process.env['OPENAI_BASE_URL'] ||
      'https://api.deepseek.com'
    this.model =
      options.model ||
      process.env['DEEPSEEK_MODEL'] ||
      process.env['OPENAI_MODEL'] ||
      'deepseek-v4-flash'
    this.temperature = options.temperature ?? 0.2
  }

  getBaseURL(): string {
    return this.baseURL
  }

  getModel(): string {
    return this.model
  }

  async fetchModels(): Promise<string[]> {
    if (this.cachedModels) {
      return this.cachedModels
    }

    if (this.fetchModelsPromise) {
      return this.fetchModelsPromise
    }

    const defaultModels = ['deepseek-chat', 'deepseek-reasoner']

    if (!this.apiKey) {
      return defaultModels
    }

    this.fetchModelsPromise = (async () => {
      try {
        const url = `${this.baseURL.replace(/\/+$/, '')}/models`
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        })

        if (!res.ok) {
          return defaultModels
        }

        const json = (await res.json()) as any
        const data = Array.isArray(json?.data) ? json.data : []
        const modelIds = data
          .map((item: any) => (typeof item?.id === 'string' ? item.id.trim() : ''))
          .filter(Boolean)

        const result = modelIds.length > 0 ? modelIds : defaultModels
        this.cachedModels = result
        return result
      } catch {
        return defaultModels
      } finally {
        this.fetchModelsPromise = null
      }
    })()

    return this.fetchModelsPromise
  }

  async chat(messages: Message[], tools?: any[], options?: LLMCallOptions): Promise<LLMResponse> {
    const url = `${this.baseURL.replace(/\/+$/, '')}/chat/completions`

    const body: Record<string, any> = {
      model: this.model,
      messages,
      temperature: this.temperature,
    }

    if (options?.thinking !== undefined) {
      body['thinking'] = { type: options.thinking ? 'enabled' : 'disabled' }
    }

    if (tools && tools.length > 0) {
      body['tools'] = tools
      body['tool_choice'] = 'auto'
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`LLM 请求失败 (status: ${res.status}): ${errText}`)
    }

    const data = (await res.json()) as any
    const choice = data.choices?.[0]
    if (!choice || !choice.message) {
      throw new Error('LLM 响应格式异常: 未返回有效 choice 节点')
    }

    const msg = choice.message
    let content: string | null = msg.content ?? null
    let reasoning: string | null = msg.reasoning_content ?? null

    // 兼容可能内嵌在 content 中的 <think>...</think> 标签（如 DeepSeek R1 格式）
    if (content && content.includes('<think>')) {
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
      if (thinkMatch) {
        reasoning = (reasoning ? `${reasoning}\n` : '') + thinkMatch[1]?.trim()
        content = content.replace(/<think>[\s\S]*?<\/think>/, '').trim()
      }
    }

    const toolCalls: ToolCall[] | undefined = msg.tool_calls

    return {
      content,
      reasoning_content: reasoning,
      tool_calls: toolCalls,
    }
  }

  async *chatStream(
    messages: Message[],
    tools?: any[],
    options?: LLMCallOptions,
  ): AsyncIterable<LLMStreamChunk> {
    const url = `${this.baseURL.replace(/\/+$/, '')}/chat/completions`

    const body: Record<string, any> = {
      model: this.model,
      messages,
      temperature: this.temperature,
      stream: true,
    }

    if (options?.thinking !== undefined) {
      body['thinking'] = { type: options.thinking ? 'enabled' : 'disabled' }
    }

    if (tools && tools.length > 0) {
      body['tools'] = tools
      body['tool_choice'] = 'auto'
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`LLM 流式请求失败 (status: ${res.status}): ${errText}`)
    }

    if (!res.body) {
      throw new Error('LLM 流式响应无可用数据体')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    const toolCallsAcc = new Map<number, { id: string; name: string; arguments: string }>()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line || !line.startsWith('data:')) continue

          const payloadStr = line.slice(5).trim()
          if (payloadStr === '[DONE]') {
            if (toolCallsAcc.size > 0) {
              const tool_calls: ToolCall[] = Array.from(toolCallsAcc.values()).map((t) => ({
                id: t.id,
                type: 'function',
                function: {
                  name: t.name,
                  arguments: t.arguments,
                },
              }))
              yield { tool_calls, isDone: true }
              toolCallsAcc.clear()
            } else {
              yield { isDone: true }
            }
            return
          }

          try {
            const data = JSON.parse(payloadStr)
            const delta = data.choices?.[0]?.delta
            if (!delta) continue

            if (delta.reasoning_content) {
              yield { reasoning_content: delta.reasoning_content }
            }

            if (delta.content) {
              yield { content: delta.content }
            }

            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                const current = toolCallsAcc.get(idx) ?? { id: '', name: '', arguments: '' }
                if (tc.id) current.id = tc.id
                if (tc.function?.name) current.name += tc.function.name
                if (tc.function?.arguments) current.arguments += tc.function.arguments
                toolCallsAcc.set(idx, current)
              }
            }
          } catch {
            // 忽略非合法 JSON 片段
          }
        }
      }

      if (toolCallsAcc.size > 0) {
        const tool_calls: ToolCall[] = Array.from(toolCallsAcc.values()).map((t) => ({
          id: t.id,
          type: 'function',
          function: {
            name: t.name,
            arguments: t.arguments,
          },
        }))
        yield { tool_calls, isDone: true }
      } else {
        yield { isDone: true }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

export type DynamicMockHandler = (
  messages: Message[],
  tools?: any[],
  options?: LLMCallOptions,
) => Promise<LLMResponse>

export interface MockLLMClientOptions {
  handler?: DynamicMockHandler
}

export class MockLLMClient implements LLMClient {
  private responseQueue: LLMResponse[] = []
  private streamQueue: LLMStreamChunk[][] = []
  private handler?: DynamicMockHandler
  private availableModels: string[] = ['mock-model-a', 'mock-model-b']

  constructor(options: MockLLMClientOptions = {}) {
    this.handler = options.handler
  }

  queueResponse(response: LLMResponse): this {
    this.responseQueue.push(response)
    return this
  }

  queueStreamChunks(chunks: LLMStreamChunk[]): this {
    this.streamQueue.push(chunks)
    return this
  }

  setHandler(handler: DynamicMockHandler): this {
    this.handler = handler
    return this
  }

  async chat(messages: Message[], tools?: any[], options?: LLMCallOptions): Promise<LLMResponse> {
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!
    }

    if (this.handler) {
      return this.handler(messages, tools, options)
    }

    // 兜底返回默认问候
    return {
      content: 'Hello! I am your AI assistant.',
    }
  }

  async *chatStream(
    messages: Message[],
    tools?: any[],
    options?: LLMCallOptions,
  ): AsyncIterable<LLMStreamChunk> {
    if (this.streamQueue.length > 0) {
      const chunks = this.streamQueue.shift()!
      for (const chunk of chunks) {
        yield chunk
      }
      return
    }

    // 默认降级：使用 chat 的响应转换为流式 chunks
    const res = await this.chat(messages, tools, options)
    if (res.reasoning_content) {
      yield { reasoning_content: res.reasoning_content }
    }
    if (res.content) {
      yield { content: res.content }
    }
    if (res.tool_calls && res.tool_calls.length > 0) {
      yield { tool_calls: res.tool_calls }
    }
    yield { isDone: true }
  }

  setAvailableModels(models: string[]): this {
    this.availableModels = models
    return this
  }

  async fetchModels(): Promise<string[]> {
    return this.availableModels
  }
}
