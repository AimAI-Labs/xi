/**
 * 最小可用 Agent 核心类型契约定义
 */

// 1. OpenAI 规范的 Function Call / Tool Call
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string // JSON 字符串
  }
}

// 2. 对话消息规范
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface SystemMessage {
  role: 'system'
  content: string
}

export interface UserMessage {
  role: 'user'
  content: string
}

export interface AssistantMessage {
  role: 'assistant'
  content: string | null
  reasoning_content?: string | null
  tool_calls?: ToolCall[]
}

export interface ToolMessage {
  role: 'tool'
  tool_call_id: string
  name: string
  content: string
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage

// 3. 工具上下文与接口定义
export interface ToolContext {
  sessionId: string
  [key: string]: unknown
}

export interface ToolParametersSchema {
  type: 'object'
  properties: Record<
    string,
    {
      type: string
      description?: string
      enum?: string[]
      [key: string]: unknown
    }
  >
  required?: string[]
}

export interface Tool {
  name: string
  description: string
  parameters: ToolParametersSchema
  execute(args: Record<string, any>, context: ToolContext): Promise<string>
}

// 4. LLM 响应结构
export interface LLMResponse {
  content: string | null
  reasoning_content?: string | null
  tool_calls?: ToolCall[]
}

// 5. Tracer 链路跟踪事件
export type TraceEventType =
  | 'turn_start'
  | 'llm_request'
  | 'llm_response'
  | 'tool_call'
  | 'tool_result'
  | 'turn_end'
  | 'error'

export interface TraceData {
  messageCount?: number
  reasoning?: string
  hasToolCalls?: boolean
  toolName?: string
  args?: Record<string, unknown>
  isError?: boolean
  result?: string
  durationMs?: number
  message?: string
  finalResponse?: string
  [key: string]: unknown
}

export interface TraceEvent {
  type: TraceEventType
  sessionId: string
  turnIndex: number
  timestamp: number
  data?: TraceData
}

// 6. Agent 运行配置与结果
export interface AgentOptions {
  maxTurns?: number
  systemPrompt?: string
  enableMicroCompact?: boolean
  verbose?: boolean
}

export interface AgentRunResult {
  sessionId: string
  finalResponse: string
  turnsCount: number
  traces: TraceEvent[]
}
