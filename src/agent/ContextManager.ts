import type { Message, ToolMessage } from './types.js'

export interface ContextManagerOptions {
  systemPrompt?: string
  enableMicroCompact?: boolean
  maxToolResultLength?: number // 单条旧 tool 结果允许的最大字符数，超出则裁剪
  maxContextMessages?: number // 滑动窗口最大保留消息条数
}

export class ContextManager {
  private systemPrompt?: string
  private enableMicroCompact: boolean
  private maxToolResultLength: number
  private maxContextMessages: number

  constructor(options: ContextManagerOptions = {}) {
    this.systemPrompt = options.systemPrompt
    this.enableMicroCompact = options.enableMicroCompact ?? true
    this.maxToolResultLength = options.maxToolResultLength ?? 300
    this.maxContextMessages = options.maxContextMessages ?? 30
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

    // 2. 执行 MicroCompact 压缩：修剪陈旧的大体积工具输出
    if (this.enableMicroCompact) {
      messages = this.applyMicroCompact(messages)
    }

    // 3. 执行滑动窗口：控制最大消息数
    if (messages.length > this.maxContextMessages) {
      messages = this.applySlidingWindow(messages)
    }

    return messages
  }

  /**
   * 类似 Claude Code 的 MicroCompact 策略：
   * 对历史中已完成的陈旧 tool 结果进行截断瘦身，而保留最近一轮 tool 结果的完整性
   */
  private applyMicroCompact(messages: Message[]): Message[] {
    // 寻找最近一条 tool 消息的索引
    let lastToolIndex = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'tool') {
        lastToolIndex = i
        break
      }
    }

    return messages.map((msg, idx) => {
      if (msg.role !== 'tool') {
        return msg
      }

      // 如果是最近一条 tool 消息，暂不压缩，保留给当轮推理
      if (idx === lastToolIndex) {
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
   * 滑动窗口策略：保留首条引导消息（System 或 First User Goal），保留最近 N 条，裁剪中间消息
   */
  private applySlidingWindow(messages: Message[]): Message[] {
    const keepHead = messages[0]!
    const remainingCount = this.maxContextMessages - 1
    const tail = messages.slice(-remainingCount)

    // 避免如果 tail 第一个是孤立的 'tool' 消息而没有对应的 assistant tool_calls
    // 如果 tail[0] 是 tool，向前顺延或者略过以保证合规的 OpenAI 上下文结构
    let safeTail = tail
    if (safeTail[0]?.role === 'tool') {
      safeTail = safeTail.slice(1)
    }

    return [keepHead, ...safeTail]
  }
}
