import type { Tool, ToolContext, ToolParametersSchema } from '../types.js'

export class TodoTool implements Tool {
  name = 'todo'
  description = '管理待办事项清单，支持添加(add)、查看列表(list)、移除(remove)和清空(clear)'

  parameters: ToolParametersSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'list', 'remove', 'clear'],
        description: '操作类型: add(添加), list(列出), remove(删除), clear(清空)',
      },
      item: {
        type: 'string',
        description: '待办事项内容（添加或删除时必填）',
      },
    },
    required: ['action'],
  }

  // 按 sessionId 存储各个 session 的待办列表
  private sessionTodos: Map<string, string[]> = new Map()

  private getTodos(sessionId: string): string[] {
    if (!this.sessionTodos.has(sessionId)) {
      this.sessionTodos.set(sessionId, [])
    }
    return this.sessionTodos.get(sessionId)!
  }

  async execute(
    args: { action: 'add' | 'list' | 'remove' | 'clear'; item?: string },
    context: ToolContext,
  ): Promise<string> {
    const list = this.getTodos(context.sessionId)

    switch (args.action) {
      case 'add': {
        const item = args.item?.trim()
        if (!item) {
          throw new Error('添加待办事项时 item 不能为空')
        }
        list.push(item)
        return `成功添加待办事项: "${item}"（当前共有 ${list.length} 条待办）`
      }

      case 'list': {
        if (list.length === 0) {
          return '当前待办事项清单为空。'
        }
        return `当前待办事项清单 (共 ${list.length} 条):\n${list.map((it, idx) => `${idx + 1}. ${it}`).join('\n')}`
      }

      case 'remove': {
        const item = args.item?.trim()
        if (!item) {
          throw new Error('删除待办事项时 item 不能为空')
        }
        const idx = list.indexOf(item)
        if (idx === -1) {
          return `未找到待办事项 "${item}"。`
        }
        list.splice(idx, 1)
        return `已移除待办事项: "${item}"（剩余 ${list.length} 条待办）`
      }

      case 'clear': {
        const count = list.length
        list.length = 0
        return `已清空所有待办事项（共清除 ${count} 条）。`
      }

      default:
        throw new Error(`不支持的待办操作: ${(args as any).action}`)
    }
  }
}
