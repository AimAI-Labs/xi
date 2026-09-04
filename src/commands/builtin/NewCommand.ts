import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class NewCommand implements SlashCommand {
  name = 'new'
  aliases = ['n']
  description = '开启一个全新的独立会话窗口'
  usage = '/new [session_id]'

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const rawId = args.trim()
    const targetSession = rawId || `session-${Date.now().toString(36)}`

    context.setSessionId(targetSession)
    context.clearScreen()

    return {
      type: 'output',
      message: `已开启并切换至新会话: ${targetSession}`,
    }
  }
}
