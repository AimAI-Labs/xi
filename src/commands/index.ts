import { ClearCommand } from './builtin/ClearCommand.js'
import { ExitCommand } from './builtin/ExitCommand.js'
import { HelpCommand } from './builtin/HelpCommand.js'
import { ModelCommand } from './builtin/ModelCommand.js'
import { SessionCommand } from './builtin/SessionCommand.js'
import { CommandRegistry } from './CommandRegistry.js'

export * from './types.js'
export * from './CommandRegistry.js'
export * from './builtin/ModelCommand.js'
export * from './builtin/SessionCommand.js'
export * from './builtin/ClearCommand.js'
export * from './builtin/HelpCommand.js'
export * from './builtin/ExitCommand.js'

export function createDefaultCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry()
  const helpCmd = new HelpCommand(registry)

  registry
    .register(helpCmd)
    .register(new ModelCommand())
    .register(new SessionCommand())
    .register(new ClearCommand())
    .register(new ExitCommand())

  return registry
}
