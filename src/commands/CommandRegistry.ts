import type { CommandContext, CommandResult, SlashCommand } from './types.js'

export class CommandRegistry {
  private commands: Map<string, SlashCommand> = new Map()
  private aliasMap: Map<string, string> = new Map()

  register(command: SlashCommand): this {
    const primaryName = command.name.toLowerCase().replace(/^\//, '')
    this.commands.set(primaryName, command)

    if (command.aliases) {
      for (const alias of command.aliases) {
        const cleanAlias = alias.toLowerCase().replace(/^\//, '')
        this.aliasMap.set(cleanAlias, primaryName)
      }
    }
    return this
  }

  get(nameOrAlias: string): SlashCommand | undefined {
    const clean = nameOrAlias.toLowerCase().replace(/^\//, '')
    const targetName = this.aliasMap.get(clean) || clean
    return this.commands.get(targetName)
  }

  getAll(): SlashCommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * 解析并执行以 / 开头的用户输入
   */
  async execute(rawInput: string, context: CommandContext): Promise<CommandResult> {
    const trimmed = rawInput.trim()
    if (!trimmed.startsWith('/')) {
      return { type: 'silent' }
    }

    const withoutSlash = trimmed.slice(1).trim()
    const firstSpaceIndex = withoutSlash.indexOf(' ')
    const commandName =
      firstSpaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, firstSpaceIndex)
    const args = firstSpaceIndex === -1 ? '' : withoutSlash.slice(firstSpaceIndex + 1).trim()

    const cmd = this.get(commandName)
    if (!cmd) {
      return {
        type: 'output',
        message: `未知命令 "/${commandName}"。输入 /help 查看所有可用命令。`,
      }
    }

    try {
      return await cmd.execute(args, context)
    } catch (err: any) {
      return {
        type: 'output',
        message: `执行命令 /${commandName} 失败: ${err?.message || String(err)}`,
      }
    }
  }
}
