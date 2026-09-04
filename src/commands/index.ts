import { ClearCommand } from './builtin/ClearCommand.js'
import { ExitCommand } from './builtin/ExitCommand.js'
import { HelpCommand } from './builtin/HelpCommand.js'
import { KeyCommand } from './builtin/KeyCommand.js'
import { ModelCommand } from './builtin/ModelCommand.js'
import { NewCommand } from './builtin/NewCommand.js'
import { SessionCommand } from './builtin/SessionCommand.js'
import { CommandRegistry } from './CommandRegistry.js'

export * from './types.js'
export * from './CommandRegistry.js'
export * from './builtin/ModelCommand.js'
export * from './builtin/NewCommand.js'
export * from './builtin/SessionCommand.js'
export * from './builtin/ClearCommand.js'
export * from './builtin/HelpCommand.js'
export * from './builtin/ExitCommand.js'
export * from './builtin/KeyCommand.js'

export function createDefaultCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry()
  const helpCmd = new HelpCommand(registry)

  registry
    .register(helpCmd)
    .register(new ModelCommand())
    .register(new KeyCommand())
    .register(new SessionCommand())
    .register(new NewCommand())
    .register(new ClearCommand())
    .register(new ExitCommand())

  return registry
}
