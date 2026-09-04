import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class SessionCommand implements SlashCommand {
  name = 'session'
  aliases = ['s']
  description = '查看当前会话或切换至指定窗口'
  usage = '/session [session_id]'

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const targetSession = args.trim()

    if (!targetSession) {
      const store = context.runtime.getSessionStore()
      const messages = store.getMessages(context.sessionId)
      const allSessions = store.getAllSessionIds()
      return {
        type: 'output',
        message: [
          `当前会话: ${context.sessionId}`,
          `历史消息: ${messages.length} 条`,
          `已有会话: ${allSessions.length > 0 ? allSessions.join(', ') : '无'}`,
          `提示: 可通过 "/session <id>" 切换会话，或 "/new" 开启新会话`,
        ].join('\n'),
      }
    }

    context.setSessionId(targetSession)
    return {
      type: 'output',
      message: `已切换到会话: ${targetSession}（独立隔离上下文）`,
    }
  }
}
