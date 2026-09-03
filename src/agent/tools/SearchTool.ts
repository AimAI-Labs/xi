import type { Tool, ToolContext, ToolParametersSchema } from '../types.js'

export interface SearchToolOptions {
  mockData?: Record<string, string>
}

export class SearchTool implements Tool {
  name = 'search'
  description = '根据关键词或问题检索相关信息或知识条目'

  parameters: ToolParametersSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '检索关键词或搜索语句，例如 "北京天气" 或 "xi cli"',
      },
    },
    required: ['query'],
  }

  private mockData: Record<string, string>

  constructor(options: SearchToolOptions = {}) {
    this.mockData = {
      天气: '今日天气多云转晴，气温 18~25°C，空气质量优。',
      北京天气: '北京今日晴，气温 22°C，南风 2 级，适宜出行。',
      xi: 'xi 是一个极简现代的 CLI 工具框架，基于 React 与 Ink 构建。',
      ...options.mockData,
    }
  }

  setMockData(key: string, value: string): void {
    this.mockData[key] = value
  }

  async execute(args: { query: string }, _context: ToolContext): Promise<string> {
    const q = args.query?.trim()
    if (!q) {
      return '搜索关键词为空，请输入有效查询。'
    }

    // 优先匹配更长、更精准的关键词
    const entries = Object.entries(this.mockData).sort((a, b) => b[0].length - a[0].length)
    for (const [key, val] of entries) {
      if (q === key || q.includes(key) || key.includes(q)) {
        return `[搜索命中] ${key}: ${val}`
      }
    }

    return `[Mock 搜索结果] 未找到与 "${q}" 完全匹配的信息。建议尝试搜索 "天气"、"北京天气" 或 "xi"。`
  }
}
