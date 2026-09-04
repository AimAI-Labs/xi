import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import type { Tool, ToolContext, ToolParametersSchema } from '../types.js'
import { checkDangerousCommand } from './dangerousCommands.js'

const execAsync = promisify(exec)

export interface BashToolOptions {
  timeoutMs?: number
  maxOutputLength?: number
  cwd?: string
}

export class BashTool implements Tool {
  name = 'bash'
  description = '在本地终端执行 Shell 命令行指令，并返回标准输出或错误输出'

  parameters: ToolParametersSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '需要执行的 Shell 命令，例如 "node -v" 或 "git status"',
      },
    },
    required: ['command'],
  }

  private timeoutMs: number
  private maxOutputLength: number
  private cwd: string

  constructor(options: BashToolOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 5000
    this.maxOutputLength = options.maxOutputLength ?? 2000
    this.cwd = options.cwd ?? process.cwd()
  }

  async execute(args: { command: string }, context: ToolContext): Promise<string> {
    const cmd = args.command?.trim()
    if (!cmd) {
      throw new Error('执行命令不能为空')
    }

    const check = checkDangerousCommand(cmd)
    if (check.isDangerous) {
      const reason = check.reason || '检测到潜在破坏性操作'
      if (!context.confirmDangerousCommand) {
        return `[安全拦截] 命令 "${cmd}" 被判定为高危指令（原因: ${reason}）。当前环境未启用交互式确认，已阻止执行。`
      }

      const approved = await context.confirmDangerousCommand(cmd, reason)
      if (!approved) {
        return `[用户取消] 用户已拒绝执行高危命令: "${cmd}"（原因: ${reason}）。`
      }
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024 * 2, // 2MB
        cwd: this.cwd,
        windowsHide: true,
      })

      let output = (stdout || stderr || '(命令执行完毕，无输出)').trim()

      if (output.length > this.maxOutputLength) {
        output = `${output.slice(0, this.maxOutputLength)}\n...[输出过长，已截断，总长度 ${output.length} 字符]`
      }

      return output
    } catch (err: any) {
      if (err.killed && err.signal === 'SIGTERM') {
        throw new Error(`命令执行超时（超过 ${this.timeoutMs}ms 限制），已安全中止。`)
      }
      const errMsg = err.stderr?.trim() || err.stdout?.trim() || err.message
      throw new Error(`命令执行出错 (exitCode ${err.code ?? 'unknown'}): ${errMsg}`)
    }
  }
}
