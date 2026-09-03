import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class ClearCommand implements SlashCommand {
  name = 'clear'
  aliases = ['cls']
  description = '清空当前屏幕上的消息历史'
  usage = '/clear'

  async execute(_args: string, context: CommandContext): Promise<CommandResult> {
    context.clearScreen()
    return { type: 'silent' }
  }
}
