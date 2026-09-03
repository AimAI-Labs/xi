import type { Tool, ToolContext } from './types.js'

export interface ToolExecutionResult {
  content: string
  isError: boolean
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  register(tool: Tool): this {
    this.tools.set(tool.name, tool)
    return this
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * 转换为 OpenAI 标准 Function Calling Tools 声明格式
   */
  getOpenAITools(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, any>
    }
  }> {
    return this.getAll().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }))
  }

  /**
   * 安全执行工具调用，自动捕获一切抛错转化为结构化错误输出，防进程崩溃并支持 LLM 自愈
   */
  async executeSafely(
    name: string,
    args: Record<string, any>,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return {
        content: `Error: [Tool Not Found] 未注册的工具 "${name}"。当前可用工具有: ${Array.from(this.tools.keys()).join(', ')}`,
        isError: true,
      }
    }

    try {
      const content = await tool.execute(args, context)
      return {
        content: typeof content === 'string' ? content : JSON.stringify(content),
        isError: false,
      }
    } catch (err: any) {
      return {
        content: `Error: [Tool Error in "${name}"] ${err?.message || String(err)}`,
        isError: true,
      }
    }
  }
}
