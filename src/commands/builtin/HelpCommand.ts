import type { CommandRegistry } from '../CommandRegistry.js'
import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class HelpCommand implements SlashCommand {
  name = 'help'
  aliases = ['h', '?']
  description = '显示所有可用的 Slash 命令与内置工具清单'
  usage = '/help'

  constructor(private registry: CommandRegistry) {}

  async execute(_args: string, context: CommandContext): Promise<CommandResult> {
    const commands = this.registry.getAll()
    const tools = context.runtime.getToolRegistry().getAll()

    const cmdLines = commands.map((c) => {
      const aliasStr =
        c.aliases && c.aliases.length > 0 ? ` (${c.aliases.map((a) => `/${a}`).join(', ')})` : ''
      return `  /${c.name.padEnd(10)}${aliasStr.padEnd(12)} - ${c.description}`
    })

    const toolLines = tools.map((t) => {
      return `  ${t.name.padEnd(14)} - ${t.description}`
    })

    const text = [
      '【Slash 命令清单】',
      ...cmdLines,
      '',
      '【Agent 可用工具】',
      ...toolLines,
      '',
      '提示: 直接输入自然语言即可向 Agent 提问或派发任务；输入 "/" 可唤起命令。',
    ].join('\n')

    return {
      type: 'output',
      message: text,
    }
  }
}
