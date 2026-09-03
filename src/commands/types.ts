import type { AgentRuntime } from '../agent/index.js'

export interface CommandContext {
  sessionId: string
  setSessionId: (id: string) => void
  currentModel: string
  setCurrentModel: (model: string) => void
  runtime: AgentRuntime
  clearScreen: () => void
  exit: () => void
}

export type CommandResult =
  | { type: 'output'; message: string }
  | { type: 'silent' }
  | { type: 'exit' }

export interface SlashCommand {
  name: string
  aliases?: string[]
  description: string
  usage?: string
  execute(args: string, context: CommandContext): Promise<CommandResult>
}
