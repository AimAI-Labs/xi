import { Box, useApp } from 'ink'
import React, { useState } from 'react'

import { AgentRuntime } from '../agent/index.js'
import { CommandRegistry } from '../commands/CommandRegistry.js'
import { createDefaultCommandRegistry } from '../commands/index.js'
import type { CommandContext } from '../commands/types.js'
import { Header } from './components/Header.js'
import { InputPrompt } from './components/InputPrompt.js'
import { MessageList } from './components/MessageList.js'
import { Spinner } from './components/Spinner.js'
import type { DisplayItem } from './types.js'

export interface AppProps {
  runtime?: AgentRuntime
  commandRegistry?: CommandRegistry
  initialSessionId?: string
  initialModel?: string
  version?: string
}

export default function App({
  runtime: propRuntime,
  commandRegistry: propRegistry,
  initialSessionId = 'default',
  initialModel = process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
  version = '0.0.0',
}: AppProps) {
  const { exit } = useApp()

  const [sessionId, setSessionId] = useState(initialSessionId)
  const [currentModel, setCurrentModel] = useState(initialModel)
  const [items, setItems] = useState<DisplayItem[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [busyStatus, setBusyStatus] = useState('')

  const [runtime] = useState(() => propRuntime ?? new AgentRuntime({ llmClient: null as any }))
  const [commandRegistry] = useState(() => propRegistry ?? createDefaultCommandRegistry())

  const clearScreen = () => {
    setItems([])
  }

  const handleExit = () => {
    exit()
  }

  const commandContext: CommandContext = {
    sessionId,
    setSessionId,
    currentModel,
    setCurrentModel,
    runtime,
    clearScreen,
    exit: handleExit,
  }

  const handleSubmit = async (text: string) => {
    // 1. 处理 Slash 命令
    if (text.startsWith('/')) {
      const cmdItem: DisplayItem = {
        id: `cmd-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }
      setItems((prev) => [...prev, cmdItem])

      const result = await commandRegistry.execute(text, commandContext)
      if (result.type === 'output' && result.message) {
        const sysItem: DisplayItem = {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: result.message,
          timestamp: Date.now(),
        }
        setItems((prev) => [...prev, sysItem])
      } else if (result.type === 'exit') {
        handleExit()
      }
      return
    }

    // 2. 处理常规自然语言任务/提问
    const userItem: DisplayItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setItems((prev) => [...prev, userItem])

    setIsBusy(true)
    setBusyStatus('思考中...')

    try {
      const runResult = await runtime.run(sessionId, text)

      // 解析本次运行中的思考与工具调用 trace，以极简形式呈现
      const traces = runResult.traces || []
      const thinkingEvent = traces.find((t) => t.type === 'llm_response' && t.data?.reasoning)
      if (thinkingEvent?.data?.reasoning) {
        setItems((prev) => [
          ...prev,
          {
            id: `think-${Date.now()}`,
            role: 'thinking',
            content: thinkingEvent.data!.reasoning!,
            timestamp: Date.now(),
          },
        ])
      }

      const toolEvents = traces.filter((t) => t.type === 'tool_result')
      for (const t of toolEvents) {
        setItems((prev) => [
          ...prev,
          {
            id: `tool-${Date.now()}-${t.timestamp}`,
            role: 'tool',
            content: `${t.data?.toolName || 'tool'}: ${t.data?.result || 'completed'}`,
            timestamp: Date.now(),
          },
        ])
      }

      // 添加 Assistant 最终回答
      const assistantItem: DisplayItem = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: runResult.finalResponse || '(无输出)',
        timestamp: Date.now(),
      }
      setItems((prev) => [...prev, assistantItem])
    } catch (err: any) {
      const errItem: DisplayItem = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error: ${err?.message || String(err)}`,
        timestamp: Date.now(),
      }
      setItems((prev) => [...prev, errItem])
    } finally {
      setIsBusy(false)
      setBusyStatus('')
    }
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Header version={version} model={currentModel} sessionId={sessionId} />
      <MessageList items={items} />
      {isBusy && <Spinner status={busyStatus} />}
      <InputPrompt isDisabled={isBusy} onSubmit={handleSubmit} onExit={handleExit} />
    </Box>
  )
}
