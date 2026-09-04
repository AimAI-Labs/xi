import { Box, useApp } from 'ink'
import React, { useEffect, useRef, useState } from 'react'

import { AgentRuntime, OpenAICompatibleClient } from '../agent/index.js'
import { MockLLMClient } from '../agent/LLMClient.js'
import type { Message } from '../agent/types.js'
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

function messagesToDisplayItems(messages: Message[]): DisplayItem[] {
  const displayItems: DisplayItem[] = []
  let counter = 0

  for (const msg of messages) {
    counter++
    const baseId = `${counter}-${Date.now()}`

    if (msg.role === 'user') {
      displayItems.push({
        id: `hist-user-${baseId}`,
        role: 'user',
        content: msg.content,
        timestamp: Date.now(),
        isHistorical: true,
      })
    } else if (msg.role === 'assistant') {
      if (msg.reasoning_content) {
        displayItems.push({
          id: `hist-think-${baseId}`,
          role: 'thinking',
          content: msg.reasoning_content,
          timestamp: Date.now(),
          isHistorical: true,
        })
      }
      if (msg.content) {
        displayItems.push({
          id: `hist-asst-${baseId}`,
          role: 'assistant',
          content: msg.content,
          timestamp: Date.now(),
          isHistorical: true,
        })
      }
    } else if (msg.role === 'tool') {
      displayItems.push({
        id: `hist-tool-${baseId}`,
        role: 'tool',
        content: `${msg.name}: completed`,
        timestamp: Date.now(),
        isHistorical: true,
        toolCall: {
          toolCallId: msg.tool_call_id,
          toolName: msg.name,
          status: 'completed',
          result: msg.content,
        },
      })
    }
  }

  return displayItems
}

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

  const [items, setItems] = useState<DisplayItem[]>(() => {
    const history = runtime.getSessionStore().getMessages(initialSessionId)
    return messagesToDisplayItems(history)
  })
  const [isBusy, setIsBusy] = useState(false)
  const [busyStatus, setBusyStatus] = useState('')
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const thinkingEnabledRef = useRef(thinkingEnabled)

  useEffect(() => {
    thinkingEnabledRef.current = thinkingEnabled
  }, [thinkingEnabled])

  const handleToggleThinking = () => {
    setThinkingEnabled((prev) => {
      const next = !prev
      thinkingEnabledRef.current = next
      return next
    })
  }
  const [isToolsExpanded, setIsToolsExpanded] = useState(false)

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
          '🎉 API Key 已成功保存至 ~/.xi/xi.toml，DeepSeek 服务已就绪！\n提示: 输入 /help 查看命令，按 Tab 可快速切换思考模式。',
        timestamp: Date.now(),
      },
    ])
  }

  const handleConfigChange = (newConfig: XiConfig) => {
    setConfig(newConfig)
    if (newConfig.llm?.api_key) {
      setApiKey(newConfig.llm.api_key)
    }
    if (newConfig.llm?.model) {
      setCurrentModel(newConfig.llm.model)
    }
  }

  const handleSessionChange = (newSessionId: string) => {
    setSessionId(newSessionId)
    const history = runtime.getSessionStore().getMessages(newSessionId)
    setItems(messagesToDisplayItems(history))
  }

  const commandContext: CommandContext = {
    sessionId,
    setSessionId: handleSessionChange,
    currentModel,
    setCurrentModel,
    runtime,
    clearScreen,
    exit: handleExit,
    onConfigChange: handleConfigChange,
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
    // 将已有所有消息标记为历史（以便界面以暗灰底色区隔当前轮次）
    setItems((prev) =>
      prev.map((item) => (item.isHistorical ? item : { ...item, isHistorical: true })),
    )

    const userItem: DisplayItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      isHistorical: false,
    }
    setItems((prev) => [...prev, userItem])

    setIsBusy(true)
    setBusyStatus(thinkingEnabledRef.current ? '思考中...' : '生成中...')

    try {
      let currentThinkingId: string | null = null
      let currentAssistantId: string | null = null
      let hasReceivedAnyContent = false

      for await (const event of runtime.runStream(sessionId, text, {
        thinking: thinkingEnabledRef.current,
      })) {
        if (event.type === 'thinking_delta') {
          if (!thinkingEnabledRef.current) continue

          if (!currentThinkingId) {
            currentThinkingId = `think-${Date.now()}`
            const newThinkingItem: DisplayItem = {
              id: currentThinkingId,
              role: 'thinking',
              content: event.delta,
              timestamp: Date.now(),
              isHistorical: false,
            }
            setItems((prev) => [...prev, newThinkingItem])
          } else {
            setItems((prev) =>
              prev.map((item) =>
                item.id === currentThinkingId
                  ? { ...item, content: item.content + event.delta }
                  : item,
              ),
            )
          }
        } else if (event.type === 'content_delta') {
          if (!hasReceivedAnyContent) {
            setBusyStatus('生成中...')
          }
          hasReceivedAnyContent = true
          // 思考流已转为正文流，关闭当前 thinking 的追加
          currentThinkingId = null

          if (!currentAssistantId) {
            currentAssistantId = `assistant-${Date.now()}`
            const newAssistantItem: DisplayItem = {
              id: currentAssistantId,
              role: 'assistant',
              content: event.delta,
              timestamp: Date.now(),
              isHistorical: false,
            }
            setItems((prev) => [...prev, newAssistantItem])
          } else {
            setItems((prev) =>
              prev.map((item) =>
                item.id === currentAssistantId
                  ? { ...item, content: item.content + event.delta }
                  : item,
              ),
            )
          }
        } else if (event.type === 'tool_start') {
          setBusyStatus(`执行工具 ${event.toolName}...`)
          // 工具调用发生：立即闭合之前的思考和回答项，保证后续内容排在工具之后，与大模型输出顺序严格一致
          currentThinkingId = null
          currentAssistantId = null

          const toolItemId = `tool-${event.toolCallId}`
          const newToolItem: DisplayItem = {
            id: toolItemId,
            role: 'tool',
            content: `${event.toolName}: running`,
            timestamp: Date.now(),
            isHistorical: false,
            toolCall: {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              args: event.args,
              status: 'running',
            },
          }
          setItems((prev) => [...prev, newToolItem])
        } else if (event.type === 'tool_end') {
          setBusyStatus('')
          const toolItemId = `tool-${event.toolCallId}`
          setItems((prev) =>
            prev.map((item) =>
              item.id === toolItemId
                ? {
                    ...item,
                    content: `${event.toolName}: ${event.isError ? 'error' : 'completed'}`,
                    toolCall: {
                      toolCallId: event.toolCallId,
                      toolName: event.toolName,
                      status: event.isError ? 'error' : 'completed',
                      result: event.result,
                      durationMs: event.durationMs,
                      args: item.toolCall?.args,
                    },
                  }
                : item,
            ),
          )
        } else if (event.type === 'turn_completed') {
          // 当前轮次结束，闭合项
          currentThinkingId = null
          currentAssistantId = null
        } else if (event.type === 'finished') {
          // 仅当没有流式接收到任何正文但有 finalResponse 时兜底展示
          if (!hasReceivedAnyContent && event.finalResponse) {
            const finalItem: DisplayItem = {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: event.finalResponse,
              timestamp: Date.now(),
              isHistorical: false,
            }
            setItems((prev) => [...prev, finalItem])
          }
        } else if (event.type === 'error') {
          const errItem: DisplayItem = {
            id: `err-${Date.now()}`,
            role: 'system',
            content: `Error: ${event.error}`,
            timestamp: Date.now(),
            isHistorical: false,
          }
          setItems((prev) => [...prev, errItem])
        }
      }
    } catch (err: any) {
      const errItem: DisplayItem = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error: ${err?.message || String(err)}`,
        timestamp: Date.now(),
        isHistorical: false,
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
      <Header model={currentModel} sessionId={sessionId} version={version} />
      <MessageList isToolsExpanded={isToolsExpanded} items={items} />
      {isBusy && <Spinner status={busyStatus} />}
      <InputPrompt
        commands={commandRegistry.getAll()}
        currentModel={currentModel}
        currentSessionId={sessionId}
        isDisabled={isBusy}
        isToolsExpanded={isToolsExpanded}
        onExit={handleExit}
        onFetchModels={() => runtime.getLLMClient().fetchModels?.() ?? Promise.resolve([])}
        onFetchSessions={() => runtime.getSessionStore().getAllSessions()}
        onSubmit={handleSubmit}
        onToggleExpandTools={() => setIsToolsExpanded((prev) => !prev)}
        onToggleThinking={handleToggleThinking}
        thinkingEnabled={thinkingEnabled}
      />
    </Box>
  )
}
