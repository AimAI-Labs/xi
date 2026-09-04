import type { AssistantMessage, Message, ToolMessage } from './types.js'

export interface ContextManagerOptions {
  systemPrompt?: string
  enableMicroCompact?: boolean
  maxToolResultLength?: number // 单条旧 tool 结果允许的最大字符数，超出则裁剪
  maxContextMessages?: number // 兜底最大保留消息条数
  maxTurnsInContext?: number // 滑动窗口最大保留对话轮数（默认 5）
}

export class ContextManager {
  private systemPrompt?: string
  private enableMicroCompact: boolean
  private maxToolResultLength: number
  private maxContextMessages: number
  private maxTurnsInContext: number

  constructor(options: ContextManagerOptions = {}) {
    this.systemPrompt = options.systemPrompt
    this.enableMicroCompact = options.enableMicroCompact ?? true
    this.maxToolResultLength = options.maxToolResultLength ?? 300
    this.maxContextMessages = options.maxContextMessages ?? 40
    this.maxTurnsInContext = options.maxTurnsInContext ?? 5
  }

  /**
   * 准备并压缩上下文，供调用 LLM 使用
   */
  prepareContext(historyMessages: Message[]): Message[] {
    let messages = [...historyMessages]

    // 1. 如果配置了 systemPrompt 且历史未提供 system 消息，则在头部插入
    if (this.systemPrompt && messages[0]?.role !== 'system') {
      messages = [{ role: 'system', content: this.systemPrompt }, ...messages]
    }

    // 2. 执行 MicroCompact 压缩：修剪历史轮次大体积工具输出
    if (this.enableMicroCompact) {
      messages = this.applyMicroCompact(messages)
    }

    // 3. 执行基于 5 轮对话的滑动窗口压缩与信息精炼
    messages = this.applyTurnBasedSlidingWindow(messages)

    // 4. 兜底执行最大消息数控制
    if (messages.length > this.maxContextMessages) {
      messages = this.applySlidingWindow(messages)
    }

    return messages
  }

  /**
   * 紧凑裁剪策略：
   * 判定最后一个 User 消息之前的工具调用为历史已完成工具，超过字符限制则截断瘦身；
   * 保证当前活跃轮次的工具结果完整。
   */
  private applyMicroCompact(messages: Message[]): Message[] {
    // 寻找最后一个 User 消息的索引
    let lastUserIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        lastUserIndex = i
        break
      }
    }

    return messages.map((msg, idx) => {
      if (msg.role !== 'tool') {
        return msg
      }

      // 如果位于最后一个 User 消息之后，属于当前轮次工具结果，暂不截断
      if (lastUserIndex !== -1 && idx > lastUserIndex) {
        return msg
      }

      const toolMsg = msg as ToolMessage
      if (toolMsg.content && toolMsg.content.length > this.maxToolResultLength) {
        const head = toolMsg.content.slice(0, Math.floor(this.maxToolResultLength / 2))
        return {
          ...toolMsg,
          content: `${head}... [Tool result truncated, original length: ${toolMsg.content.length} bytes]`,
        }
      }

      return msg
    })
  }

  /**
   * 超出 5 轮对话后触发滑动窗口：
   * 1. 保留首轮核心意图（System + First User Turn），剥离思考链与临时工具调用
   * 2. 保留最近 5 轮完整上下文（包括工具链、执行结果与当前思考）
   * 3. 裁剪中间过期超期轮次：省略不重要的工具执行日志、过渡 tool_calls 与思考链，保留核心提问与最终回答
   */
  private applyTurnBasedSlidingWindow(messages: Message[]): Message[] {
    const userIndices: number[] = []
    for (let i = 0; i < messages.length; i++) {
      if (messages[i]?.role === 'user') {
        userIndices.push(i)
      }
    }

    const turnCount = userIndices.length
    if (turnCount <= this.maxTurnsInContext) {
      return messages
    }

    // 1. 保留头部系统提示与首轮核心意图
    const headMessages: Message[] = []
    let cursor = 0
    if (messages[0]?.role === 'system') {
      headMessages.push(messages[0])
      cursor = 1
    }

    // 提取首轮 User 及其最终回答正文
    const firstUserIndex = userIndices[0]!
    if (firstUserIndex >= cursor) {
      headMessages.push(messages[firstUserIndex]!)

      // 寻找下一个 user 之前的最后一个具有非空 content 的 assistant 消息
      const nextUserIdx = userIndices.length > 1 ? userIndices[1]! : messages.length
      let finalAssistantMsg: AssistantMessage | null = null
      for (let i = firstUserIndex + 1; i < nextUserIdx; i++) {
        const m = messages[i]
        if (m?.role === 'assistant' && m.content) {
          finalAssistantMsg = m as AssistantMessage
        }
      }

      if (finalAssistantMsg) {
        // 剥离首轮回答中冗长的思考链与工具调用，保留核心答复
        headMessages.push({
          role: 'assistant',
          content: finalAssistantMsg.content,
        } as AssistantMessage)
      }
    }

    // 2. 处理首轮与最近 5 轮之间的中间过期轮次（Middle Turns）
    const middleTurnLimit = turnCount - this.maxTurnsInContext
    const middleMessages: Message[] = []

    for (let turn = 1; turn < middleTurnLimit; turn++) {
      const currentTurnUserIdx = userIndices[turn]!
      const nextTurnLimitIdx = userIndices[turn + 1]!

      // 保留该轮 User 提问
      middleMessages.push(messages[currentTurnUserIdx]!)

      // 寻找该轮 Assistant 的最终有效文本回答，丢弃中间 tool 和 tool_calls
      let turnFinalAssistant: AssistantMessage | null = null
      for (let i = currentTurnUserIdx + 1; i < nextTurnLimitIdx; i++) {
        const m = messages[i]
        if (m?.role === 'assistant' && m.content) {
          turnFinalAssistant = m as AssistantMessage
        }
      }

      if (turnFinalAssistant) {
        middleMessages.push({
          role: 'assistant',
          content: turnFinalAssistant.content,
        } as AssistantMessage)
      }
    }

    // 3. 截取最近 N 轮（默认最近 5 轮），完整保留
    const recentTurnStartIndex = userIndices[middleTurnLimit]!
    const recentMessages = messages.slice(recentTurnStartIndex)

    return [...headMessages, ...middleMessages, ...recentMessages]
  }

  /**
   * 兜底滑动窗口策略：保留首条引导消息，保留最近 N 条
   */
  private applySlidingWindow(messages: Message[]): Message[] {
    const keepHead = messages[0]!
    const remainingCount = this.maxContextMessages - 1
    const tail = messages.slice(-remainingCount)

    let safeTail = tail
    if (safeTail[0]?.role === 'tool') {
      safeTail = safeTail.slice(1)
    }

    return [keepHead, ...safeTail]
  }
}
