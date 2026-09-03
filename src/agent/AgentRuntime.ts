import { ContextManager } from './ContextManager.js'
import type { LLMClient } from './LLMClient.js'
import { SessionStore } from './SessionStore.js'
import { ToolRegistry } from './ToolRegistry.js'
import { Tracer } from './Tracer.js'
import type {
  AgentOptions,
  AgentRunResult,
  AssistantMessage,
  ToolMessage,
  UserMessage,
} from './types.js'

export interface AgentRuntimeDependencies {
  llmClient: LLMClient
  toolRegistry?: ToolRegistry
  sessionStore?: SessionStore
  contextManager?: ContextManager
  tracer?: Tracer
  defaultOptions?: AgentOptions
}

export class AgentRuntime {
  private llmClient: LLMClient
  private toolRegistry: ToolRegistry
  private sessionStore: SessionStore
  private contextManager: ContextManager
  private tracer: Tracer
  private defaultOptions: AgentOptions

  constructor(deps: AgentRuntimeDependencies) {
    this.llmClient = deps.llmClient
    this.toolRegistry = deps.toolRegistry ?? new ToolRegistry()
    this.sessionStore = deps.sessionStore ?? new SessionStore()
    this.contextManager = deps.contextManager ?? new ContextManager()
    this.tracer = deps.tracer ?? new Tracer()
    this.defaultOptions = {
      maxTurns: 10,
      enableMicroCompact: true,
      ...deps.defaultOptions,
    }
  }

  /**
   * 运行 Agent 任务，驱动四步 Loop 状态机
   */
  async run(
    sessionId: string,
    userPrompt: string,
    options: AgentOptions = {},
  ): Promise<AgentRunResult> {
    const opts = { ...this.defaultOptions, ...options }
    const maxTurns = opts.maxTurns ?? 10

    // Step 1: 接收用户输入并存入 Session 上下文
    const userMessage: UserMessage = {
      role: 'user',
      content: userPrompt,
    }
    this.sessionStore.appendMessage(sessionId, userMessage)

    let turnCount = 0
    let finalResponse = ''

    // Loop 核心循环
    while (turnCount < maxTurns) {
      turnCount++

      this.tracer.record({
        type: 'turn_start',
        sessionId,
        turnIndex: turnCount,
        timestamp: Date.now(),
      })

      // 准备与压缩上下文
      const history = this.sessionStore.getMessages(sessionId)
      const contextMessages = this.contextManager.prepareContext(history)
      const toolsSchema = this.toolRegistry.getOpenAITools()

      this.tracer.record({
        type: 'llm_request',
        sessionId,
        turnIndex: turnCount,
        timestamp: Date.now(),
        data: { messageCount: contextMessages.length },
      })

      // Step 2: 调用模型进行推断与决策
      const response = await this.llmClient.chat(
        contextMessages,
        toolsSchema.length > 0 ? toolsSchema : undefined,
      )

      this.tracer.record({
        type: 'llm_response',
        sessionId,
        turnIndex: turnCount,
        timestamp: Date.now(),
        data: {
          reasoning: response.reasoning_content ?? undefined,
          hasToolCalls: Boolean(response.tool_calls && response.tool_calls.length > 0),
        },
      })

      const hasToolCalls = response.tool_calls && response.tool_calls.length > 0

      // 分支 A: 模型直接回复（无工具调用）-> 循环结束
      if (!hasToolCalls) {
        finalResponse = response.content || ''
        const assistantMsg: AssistantMessage = {
          role: 'assistant',
          content: response.content,
          reasoning_content: response.reasoning_content,
        }
        this.sessionStore.appendMessage(sessionId, assistantMsg)

        this.tracer.record({
          type: 'turn_end',
          sessionId,
          turnIndex: turnCount,
          timestamp: Date.now(),
          data: { finalResponse },
        })

        break
      }

      // 分支 B: 模型触发工具调用
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        content: response.content,
        reasoning_content: response.reasoning_content,
        tool_calls: response.tool_calls,
      }
      this.sessionStore.appendMessage(sessionId, assistantMsg)

      // Step 3: 执行工具并收集结果
      for (const call of response.tool_calls!) {
        const toolName = call.function.name
        let parsedArgs: Record<string, any> = {}

        // 参数容错解析
        try {
          parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {}
        } catch {
          const parseError = `Error: [JSON Parse Error] 工具参数不是合法 JSON: ${call.function.arguments}`
          const errToolMsg: ToolMessage = {
            role: 'tool',
            tool_call_id: call.id,
            name: toolName,
            content: parseError,
          }
          this.sessionStore.appendMessage(sessionId, errToolMsg)
          continue
        }

        this.tracer.record({
          type: 'tool_call',
          sessionId,
          turnIndex: turnCount,
          timestamp: Date.now(),
          data: { toolName, args: parsedArgs },
        })

        const startTime = Date.now()
        const execResult = await this.toolRegistry.executeSafely(toolName, parsedArgs, {
          sessionId,
          tracer: this.tracer,
        })
        const durationMs = Date.now() - startTime

        this.tracer.record({
          type: 'tool_result',
          sessionId,
          turnIndex: turnCount,
          timestamp: Date.now(),
          data: {
            toolName,
            isError: execResult.isError,
            result: execResult.content,
            durationMs,
          },
        })

        // 回填 Step 4: 将工具结果以 tool message 形式写入上下文
        const toolMsg: ToolMessage = {
          role: 'tool',
          tool_call_id: call.id,
          name: toolName,
          content: execResult.content,
        }
        this.sessionStore.appendMessage(sessionId, toolMsg)
      }

      // Step 4 判定：检查是否达到最大轮次熔断保护
      if (turnCount >= maxTurns) {
        finalResponse = `任务已停止：已达到最大轮次限制 (${maxTurns} turns)。`
        this.tracer.record({
          type: 'error',
          sessionId,
          turnIndex: turnCount,
          timestamp: Date.now(),
          data: { message: finalResponse },
        })
        break
      }
      // 未达到最大轮次，继续进入下一轮 while loop
    }

    return {
      sessionId,
      finalResponse,
      turnsCount: turnCount,
      traces: this.tracer.getEventsBySession(sessionId),
    }
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry
  }

  getSessionStore(): SessionStore {
    return this.sessionStore
  }

  getTracer(): Tracer {
    return this.tracer
  }
}
