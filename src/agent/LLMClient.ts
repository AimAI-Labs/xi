import type { LLMResponse, Message, ToolCall } from './types.js'

export interface LLMClient {
  chat(messages: Message[], tools?: any[]): Promise<LLMResponse>
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

  async chat(messages: Message[], tools?: any[]): Promise<LLMResponse> {
    const url = `${this.baseURL.replace(/\/+$/, '')}/chat/completions`

    const body: Record<string, any> = {
      model: this.model,
      messages,
      temperature: this.temperature,
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
}

export type DynamicMockHandler = (messages: Message[], tools?: any[]) => Promise<LLMResponse>

export interface MockLLMClientOptions {
  handler?: DynamicMockHandler
}

export class MockLLMClient implements LLMClient {
  private responseQueue: LLMResponse[] = []
  private handler?: DynamicMockHandler

  constructor(options: MockLLMClientOptions = {}) {
    this.handler = options.handler
  }

  queueResponse(response: LLMResponse): this {
    this.responseQueue.push(response)
    return this
  }

  setHandler(handler: DynamicMockHandler): this {
    this.handler = handler
    return this
  }

  async chat(messages: Message[], tools?: any[]): Promise<LLMResponse> {
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!
    }

    if (this.handler) {
      return this.handler(messages, tools)
    }

    // 兜底返回默认问候
    return {
      content: 'Hello! I am your AI assistant.',
    }
  }
}
