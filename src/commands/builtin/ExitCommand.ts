import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class ExitCommand implements SlashCommand {
  name = 'exit'
  aliases = ['quit', 'q']
  description = '退出当前 xi 会话'
  usage = '/exit'

  async execute(_args: string, context: CommandContext): Promise<CommandResult> {
    context.exit()
    return { type: 'exit' }
  }
}
