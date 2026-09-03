import chalk from 'chalk'

import type { TraceEvent, TraceEventType } from './types.js'

export interface TracerOptions {
  verbose?: boolean
}

export class Tracer {
  private events: TraceEvent[] = []
  private verbose: boolean

  constructor(options: TracerOptions = {}) {
    this.verbose = options.verbose ?? false
  }

  record(event: TraceEvent): void {
    this.events.push(event)

    if (this.verbose) {
      this.printEvent(event)
    }
  }

  getEvents(): TraceEvent[] {
    return [...this.events]
  }

  getEventsBySession(sessionId: string): TraceEvent[] {
    return this.events.filter((e) => e.sessionId === sessionId)
  }

  getEventsByType(type: TraceEventType): TraceEvent[] {
    return this.events.filter((e) => e.type === type)
  }

  clear(): void {
    this.events = []
  }

  private printEvent(event: TraceEvent): void {
    const time = new Date(event.timestamp).toLocaleTimeString()
    const prefix = `[${chalk.gray(time)}][Turn ${event.turnIndex}]`

    switch (event.type) {
      case 'turn_start':
        console.log(`${prefix} ${chalk.blue('▶ Turn Start')} (${event.sessionId})`)
        break
      case 'llm_request':
        console.log(
          `${prefix} ${chalk.cyan('➜ LLM Request')} (${event.data?.messageCount ?? 0} messages)`,
        )
        break
      case 'llm_response':
        if (event.data?.reasoning) {
          console.log(`${prefix} ${chalk.magenta('💭 Thinking:')} ${event.data.reasoning}`)
        }
        if (event.data?.hasToolCalls) {
          console.log(`${prefix} ${chalk.yellow('🛠 Model decided to call tools')}`)
        } else {
          console.log(`${prefix} ${chalk.green('💬 Model direct response')}`)
        }
        break
      case 'tool_call':
        console.log(
          `${prefix} ${chalk.yellow('⚙ Tool Executing:')} ${chalk.bold(String(event.data?.toolName))} args=${JSON.stringify(event.data?.args)}`,
        )
        break
      case 'tool_result':
        if (event.data?.isError) {
          console.log(`${prefix} ${chalk.red('✖ Tool Error:')} ${event.data?.result}`)
        } else {
          console.log(`${prefix} ${chalk.green('✔ Tool Completed')} (${event.data?.durationMs}ms)`)
        }
        break
      case 'error':
        console.log(`${prefix} ${chalk.red.bold('🚨 Error:')} ${event.data?.message}`)
        break
      case 'turn_end':
        console.log(`${prefix} ${chalk.blue('■ Turn End')}`)
        break
    }
  }
}
