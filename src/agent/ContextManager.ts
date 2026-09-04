import type { AssistantMessage, Message, ToolMessage } from './types.js'

export interface ContextManagerOptions {
  systemPrompt?: string
  enableMicroCompact?: boolean
  maxToolResultLength?: number // 单条旧 tool 结果允许的最大字符数，超出则裁剪
  maxContextMessages?: number // 兜底最大保留消息条数
  maxTurnsInContext?: number // 滑动窗口最大保留对话轮数（默认 10）
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
    this.maxTurnsInContext = options.maxTurnsInContext ?? 10
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

    // 3. 执行基于 10 轮对话的滑动窗口压缩
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
   * 超出 10 轮对话后触发滑动窗口：
   * 保留首轮核心意图（System + First User Turn），完整保留最近 10 轮，
   * 裁剪中间过期轮次的思考过程（reasoning_content）与大体积工具输出。
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

    // 1. 保留头部系统提示与首轮意图
    const headMessages: Message[] = []
    let cursor = 0
    if (messages[0]?.role === 'system') {
      headMessages.push(messages[0])
      cursor = 1
    }

    // 首轮 User 及其回答
    const firstUserIndex = userIndices[0]!
    if (firstUserIndex >= cursor) {
      headMessages.push(messages[firstUserIndex]!)
      const nextMsg = messages[firstUserIndex + 1]
      if (nextMsg && nextMsg.role === 'assistant') {
        // 剥离首轮回答中冗长的思考链，保留核心答复
        headMessages.push({
          ...nextMsg,
          reasoning_content: undefined,
        } as AssistantMessage)
      }
    }

    // 2. 截取最近 N 轮（默认最近 10 轮）
    const recentTurnStartIndex = userIndices[turnCount - this.maxTurnsInContext]!
    const recentMessages = messages.slice(recentTurnStartIndex)

    // 3. 处理首轮与最近 10 轮之间的中间过期轮次
    const middleStartIndex = (firstUserIndex ?? 0) + 2
    const middleEndIndex = recentTurnStartIndex

    const middleMessages: Message[] = []
    if (middleEndIndex > middleStartIndex) {
      const candidateMiddle = messages.slice(middleStartIndex, middleEndIndex)
      for (const m of candidateMiddle) {
        if (m.role === 'assistant') {
          // 省略中间轮次不重要的思考过程
          middleMessages.push({
            ...m,
            reasoning_content: undefined,
          } as AssistantMessage)
        } else if (m.role === 'tool') {
          // 强化压缩中间轮次的工具输出
          const toolMsg = m as ToolMessage
          if (toolMsg.content && toolMsg.content.length > this.maxToolResultLength) {
            const head = toolMsg.content.slice(0, Math.floor(this.maxToolResultLength / 2))
            middleMessages.push({
              ...toolMsg,
              content: `${head}... [Tool result truncated]`,
            })
          } else {
            middleMessages.push(m)
          }
        } else {
          middleMessages.push(m)
        }
      }
    }

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
