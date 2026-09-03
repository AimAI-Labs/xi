import type { Tool, ToolContext, ToolParametersSchema } from '../types.js'

export class CalculatorTool implements Tool {
  name = 'calculator'
  description = '执行数学计算表达式，支持 +, -, *, /, %, ^ 及括号'

  parameters: ToolParametersSchema = {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '需要计算的数学表达式，例如 "(12 + 8) * 5"',
      },
    },
    required: ['expression'],
  }

  async execute(args: { expression: string }, _context: ToolContext): Promise<string> {
    const expr = args.expression?.trim()
    if (!expr) {
      throw new Error('表达式不能为空')
    }

    // 安全检查：仅允许包含合法数学字符与运算符
    const safeMathRegex = /^[\d\s+\-*/%^().,]+$/
    if (!safeMathRegex.test(expr)) {
      throw new Error(`非法数学表达式: 包含非数字或不安全的字符 "${expr}"`)
    }

    // 将 ^ 转换为 **
    const sanitizedExpr = expr.replace(/\^/g, '**')

    try {
      // 在受限作用域求值
      const fn = new Function(`"use strict"; return (${sanitizedExpr});`)
      const result = fn()

      if (typeof result !== 'number' || Number.isNaN(result)) {
        throw new Error(`计算结果异常: ${result}`)
      }

      if (!Number.isFinite(result)) {
        throw new Error('计算结果除以零或无穷大')
      }

      return String(result)
    } catch (err: any) {
      throw new Error(`计算失败: ${err.message}`)
    }
  }
}
