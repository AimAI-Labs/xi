import { Box, useApp } from 'ink'
import React, { useState } from 'react'

import { AgentRuntime, OpenAICompatibleClient } from '../agent/index.js'
import { MockLLMClient } from '../agent/LLMClient.js'
import { CommandRegistry } from '../commands/CommandRegistry.js'
import { createDefaultCommandRegistry } from '../commands/index.js'
import type { CommandContext } from '../commands/types.js'
import { loadConfig, resolveApiKey, saveConfig, type XiConfig } from '../config/index.js'
import { ApiKeySetup } from './components/ApiKeySetup.js'
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
  apiKey?: string
  requireApiKey?: boolean
}

export default function App({
  runtime: propRuntime,
  commandRegistry: propRegistry,
  initialSessionId = 'default',
  initialModel,
  version = '0.0.0',
  apiKey: propApiKey,
  requireApiKey: propRequireApiKey,
}: AppProps) {
  const { exit } = useApp()

  const [config, setConfig] = useState<XiConfig>(() => loadConfig())
  const resolvedKey = propApiKey || resolveApiKey(config)
  const [apiKey, setApiKey] = useState(resolvedKey)

  const [isSetupMode, setIsSetupMode] = useState(() => {
    if (propRequireApiKey !== undefined) return propRequireApiKey
    return !resolvedKey
  })

  const [sessionId, setSessionId] = useState(initialSessionId)
  const [currentModel, setCurrentModel] = useState(
    () => initialModel || config.llm?.model || 'deepseek-v4-flash',
  )
  const [items, setItems] = useState<DisplayItem[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [busyStatus, setBusyStatus] = useState('')
  const [thinkingEnabled, setThinkingEnabled] = useState(true)

  const [runtime] = useState(() => {
    if (propRuntime) return propRuntime
    const client = apiKey
      ? new OpenAICompatibleClient({
          apiKey,
          baseURL: config.llm?.base_url,
          model: currentModel,
        })
      : new MockLLMClient()
    return new AgentRuntime({ llmClient: client })
  })

  const [commandRegistry] = useState(() => propRegistry ?? createDefaultCommandRegistry())

  const clearScreen = () => {
    setItems([])
  }

  const handleExit = () => {
    exit()
  }

  const handleSaveApiKey = (newKey: string) => {
    const updatedConfig: XiConfig = {
      ...config,
      llm: {
        ...config.llm,
        api_key: newKey,
      },
    }
    saveConfig(updatedConfig)
    setConfig(updatedConfig)
    setApiKey(newKey)

    // 动态初始化并装载 DeepSeek 客户端
    const newClient = new OpenAICompatibleClient({
      apiKey: newKey,
      baseURL: updatedConfig.llm.base_url,
      model: currentModel,
    })
    runtime.setLLMClient(newClient)

    setIsSetupMode(false)
    setItems((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'system',
        content:
          '🎉 API Key 已成功保存至 ~/.xi.toml，DeepSeek 服务已就绪！\n提示: 输入 /help 查看命令，按 Tab 可快速切换思考模式。',
        timestamp: Date.now(),
      },
    ])
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

      // 解析本次运行中的思考与工具调用 trace
      const traces = runResult.traces || []
      const thinkingEvent = traces.find((t) => t.type === 'llm_response' && t.data?.reasoning)

      // 仅当开启思考模式时展示思考内容
      if (thinkingEnabled && thinkingEvent?.data?.reasoning) {
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

  // 初次进入未配置 API Key 时挂载引导视图
  if (isSetupMode) {
    return <ApiKeySetup onSave={handleSaveApiKey} onExit={handleExit} />
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Header version={version} model={currentModel} sessionId={sessionId} />
      <MessageList items={items} />
      {isBusy && <Spinner status={busyStatus} />}
      <InputPrompt
        isDisabled={isBusy}
        commands={commandRegistry.getAll()}
        thinkingEnabled={thinkingEnabled}
        onToggleThinking={() => setThinkingEnabled((prev) => !prev)}
        onSubmit={handleSubmit}
        onExit={handleExit}
      />
    </Box>
  )
}
