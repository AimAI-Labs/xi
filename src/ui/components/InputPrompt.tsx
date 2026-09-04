import { Box, Text, useInput, useStdin } from 'ink'
import React, { useEffect, useState } from 'react'

import type { SessionSummary } from '../../agent/SessionStore.js'
import type { SlashCommand } from '../../commands/types.js'
import { ModelMenu } from './ModelMenu.js'
import { fuzzyMatch, SessionMenu } from './SessionMenu.js'
import { SlashMenu } from './SlashMenu.js'

export interface InputPromptProps {
  isDisabled?: boolean
  onSubmit: (value: string) => void
  onExit: () => void
  placeholder?: string
  commands?: SlashCommand[]
  thinkingEnabled?: boolean
  onToggleThinking?: () => void
  isToolsExpanded?: boolean
  onToggleExpandTools?: () => void
  currentModel?: string
  onFetchModels?: () => Promise<string[]>
  currentSessionId?: string
  onFetchSessions?: () => SessionSummary[]
  initialValue?: string
}

interface RawInputHandlerProps {
  isDisabled: boolean
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  history: string[]
  setHistory: React.Dispatch<React.SetStateAction<string[]>>
  historyIndex: number
  setHistoryIndex: React.Dispatch<React.SetStateAction<number>>
  commands: SlashCommand[]
  menuIndex: number
  setMenuIndex: React.Dispatch<React.SetStateAction<number>>
  isModelActive: boolean
  filteredModels: string[]
  modelMenuIndex: number
  setModelMenuIndex: React.Dispatch<React.SetStateAction<number>>
  isSessionActive: boolean
  filteredSessions: SessionSummary[]
  sessionMenuIndex: number
  setSessionMenuIndex: React.Dispatch<React.SetStateAction<number>>
  isMenuDismissed: boolean
  setIsMenuDismissed: React.Dispatch<React.SetStateAction<boolean>>
  onToggleThinking?: () => void
  onToggleExpandTools?: () => void
  onSubmit: (value: string) => void
  onExit: () => void
}

/**
 * 仅在支持 TTY / Raw Mode 的真实终端环境下挂载此组件
 */
function RawInputHandler({
  isDisabled,
  value,
  setValue,
  history,
  setHistory,
  historyIndex,
  setHistoryIndex,
  commands,
  menuIndex,
  setMenuIndex,
  isModelActive,
  filteredModels,
  modelMenuIndex,
  setModelMenuIndex,
  isSessionActive,
  filteredSessions,
  sessionMenuIndex,
  setSessionMenuIndex,
  isMenuDismissed,
  setIsMenuDismissed,
  onToggleThinking,
  onToggleExpandTools,
  onSubmit,
  onExit,
}: RawInputHandlerProps) {
  const isSlashActive =
    value.startsWith('/') && !value.includes(' ') && !isMenuDismissed && commands.length > 0

  const search = value.replace(/^\//, '').toLowerCase()
  const filtered = commands.filter((cmd) => {
    if (!search) return true
    const matchName = cmd.name.toLowerCase().startsWith(search)
    const matchAlias = cmd.aliases?.some((alias) =>
      alias.toLowerCase().replace(/^\//, '').startsWith(search),
    )
    return matchName || matchAlias
  })

  useInput((input, key) => {
    // Ctrl+C 退出
    if (key.ctrl && input === 'c') {
      onExit()
      return
    }

    // Ctrl+O 切换展开/折叠工具输出
    if (key.ctrl && input === 'o') {
      onToggleExpandTools?.()
      return
    }

    if (isDisabled) return

    // Tab 键: 循环切换思考模式
    if (key.tab) {
      onToggleThinking?.()
      return
    }

    // Escape 键: 关闭 Slash、Model 或 Session 菜单浮层
    if (key.escape) {
      if (isSlashActive || isModelActive || isSessionActive) {
        setIsMenuDismissed(true)
        return
      }
    }

    // 回车处理
    if (key.return || input === '\r' || input === '\n') {
      // 若处于 Session 候选菜单，回车直接切换并提交选中会话
      if (isSessionActive && filteredSessions.length > 0) {
        const selected = filteredSessions[sessionMenuIndex] || filteredSessions[0]
        if (selected) {
          const cmd = `/session ${selected.id}`
          setHistory((prev) => [cmd, ...prev])
          setHistoryIndex(-1)
          setValue('')
          setIsMenuDismissed(false)
          setSessionMenuIndex(0)
          onSubmit(cmd)
          return
        }
      }

      // 若处于 Model 候选菜单，回车直接切换并提交选中模型
      if (isModelActive && filteredModels.length > 0) {
        const selected = filteredModels[modelMenuIndex] || filteredModels[0]
        if (selected) {
          const cmd = `/model ${selected}`
          setHistory((prev) => [cmd, ...prev])
          setHistoryIndex(-1)
          setValue('')
          setIsMenuDismissed(false)
          setModelMenuIndex(0)
          onSubmit(cmd)
          return
        }
      }

      // 若处于 Slash 候选菜单，回车将当前选中项补全到输入框
      if (isSlashActive && filtered.length > 0) {
        const selected = filtered[menuIndex] || filtered[0]
        if (selected) {
          setValue(`/${selected.name} `)
          setIsMenuDismissed(true)
          return
        }
      }

      const trimmed = value.trim()
      if (trimmed) {
        setHistory((prev) => [trimmed, ...prev])
        setHistoryIndex(-1)
        setValue('')
        setIsMenuDismissed(false)
        setMenuIndex(0)
        setModelMenuIndex(0)
        setSessionMenuIndex(0)
        onSubmit(trimmed)
      }
      return
    }

    // 方向键 Up
    if (key.upArrow) {
      if (isSessionActive && filteredSessions.length > 0) {
        setSessionMenuIndex((prev) => (prev > 0 ? prev - 1 : filteredSessions.length - 1))
        return
      }

      if (isModelActive && filteredModels.length > 0) {
        setModelMenuIndex((prev) => (prev > 0 ? prev - 1 : filteredModels.length - 1))
        return
      }

      if (isSlashActive && filtered.length > 0) {
        setMenuIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1))
        return
      }

      if (history.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(nextIndex)
        setValue(history[nextIndex] ?? '')
      }
      return
    }

    // 方向键 Down
    if (key.downArrow) {
      if (isSessionActive && filteredSessions.length > 0) {
        setSessionMenuIndex((prev) => (prev < filteredSessions.length - 1 ? prev + 1 : 0))
        return
      }

      if (isModelActive && filteredModels.length > 0) {
        setModelMenuIndex((prev) => (prev < filteredModels.length - 1 ? prev + 1 : 0))
        return
      }

      if (isSlashActive && filtered.length > 0) {
        setMenuIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0))
        return
      }

      if (historyIndex > 0) {
        const prevIndex = historyIndex - 1
        setHistoryIndex(prevIndex)
        setValue(history[prevIndex] ?? '')
      } else if (historyIndex === 0) {
        setHistoryIndex(-1)
        setValue('')
      }
      return
    }

    // 退格键 Backspace / Delete
    if (key.backspace || key.delete) {
      setIsMenuDismissed(false)
      setValue((prev) => prev.slice(0, -1))
      return
    }

    // 常规文本输入
    if (!key.ctrl && !key.meta && input) {
      setIsMenuDismissed(false)
      setMenuIndex(0)
      setModelMenuIndex(0)
      setSessionMenuIndex(0)

      if (input.includes('\r') || input.includes('\n')) {
        const clean = (value + input).replace(/[\r\n]+/g, '').trim()
        if (clean) {
          setHistory((prev) => [clean, ...prev])
          setHistoryIndex(-1)
          setValue('')
          onSubmit(clean)
        }
        return
      }
      setValue((prev) => prev + input)
    }
  })

  return null
}

export function InputPrompt({
  isDisabled = false,
  onSubmit,
  onExit,
  placeholder = '有什么我可以帮忙的？输入 / 查看命令...',
  commands = [],
  thinkingEnabled = true,
  onToggleThinking,
  isToolsExpanded = false,
  onToggleExpandTools,
  currentModel,
  onFetchModels,
  currentSessionId,
  onFetchSessions,
  initialValue = '',
}: InputPromptProps) {
  const { isRawModeSupported, stdin } = useStdin()
  const isRealTTY = Boolean(isRawModeSupported && typeof (stdin as any).ref === 'function')
  const [value, setValue] = useState(initialValue)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [menuIndex, setMenuIndex] = useState<number>(0)
  const [modelMenuIndex, setModelMenuIndex] = useState<number>(0)
  const [sessionMenuIndex, setSessionMenuIndex] = useState<number>(0)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [availableSessions, setAvailableSessions] = useState<SessionSummary[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false)
  const [hasFetchedModels, setHasFetchedModels] = useState<boolean>(false)
  const [isMenuDismissed, setIsMenuDismissed] = useState<boolean>(false)

  const isSlashActive =
    value.startsWith('/') && !value.includes(' ') && !isMenuDismissed && commands.length > 0

  const isModelActive =
    !isMenuDismissed && Boolean(/^\/(model|m)(\s.*)?$/.test(value)) && value.includes(' ')

  const isSessionActive =
    !isMenuDismissed && Boolean(/^\/(session|s)(\s.*)?$/.test(value)) && value.includes(' ')

  const modelFilter = value.replace(/^\/(model|m)\s*/, '')
  const filteredModels = availableModels.filter((model) => {
    const search = modelFilter.trim().toLowerCase()
    if (!search) return true
    return model.toLowerCase().includes(search)
  })

  const sessionFilter = value.replace(/^\/(session|s)\s*/, '')
  const filteredSessions = availableSessions.filter((session) => {
    if (fuzzyMatch(sessionFilter, session.id)) return true
    if (session.lastUserMessage && fuzzyMatch(sessionFilter, session.lastUserMessage)) return true
    return false
  })

  useEffect(() => {
    if (isSessionActive && onFetchSessions) {
      const sessions = onFetchSessions()
      if (Array.isArray(sessions)) {
        setAvailableSessions(sessions)
      }
    }
  }, [isSessionActive, onFetchSessions])

  useEffect(() => {
    if (isModelActive && !hasFetchedModels && onFetchModels) {
      setIsLoadingModels(true)
      setHasFetchedModels(true)
      onFetchModels()
        .then((models) => {
          if (Array.isArray(models) && models.length > 0) {
            setAvailableModels(models)
          }
        })
        .catch(() => {})
        .finally(() => {
          setIsLoadingModels(false)
        })
    }
  }, [isModelActive, hasFetchedModels, onFetchModels])

  // 在非 TTY / 单元测试环境中，直接监听 data 流并响应回车换行
  useEffect(() => {
    if (isRealTTY || isDisabled) return

    const handleData = (chunk: Buffer | string) => {
      const text = chunk
        .toString()
        .replace(/[\r\n]+/g, '')
        .trim()
      if (text) {
        setHistory((prev) => [text, ...prev])
        setValue('')
        onSubmit(text)
      }
    }

    stdin.on('data', handleData)
    return () => {
      stdin.off('data', handleData)
    }
  }, [isRealTTY, isDisabled, onSubmit, stdin])

  return (
    <Box flexDirection="column">
      {isRealTTY && (
        <RawInputHandler
          commands={commands}
          filteredModels={filteredModels}
          filteredSessions={filteredSessions}
          history={history}
          historyIndex={historyIndex}
          isDisabled={isDisabled}
          isMenuDismissed={isMenuDismissed}
          isModelActive={isModelActive}
          isSessionActive={isSessionActive}
          menuIndex={menuIndex}
          modelMenuIndex={modelMenuIndex}
          onExit={onExit}
          onSubmit={onSubmit}
          onToggleExpandTools={onToggleExpandTools}
          onToggleThinking={onToggleThinking}
          sessionMenuIndex={sessionMenuIndex}
          setHistory={setHistory}
          setHistoryIndex={setHistoryIndex}
          setIsMenuDismissed={setIsMenuDismissed}
          setMenuIndex={setMenuIndex}
          setModelMenuIndex={setModelMenuIndex}
          setSessionMenuIndex={setSessionMenuIndex}
          setValue={setValue}
          value={value}
        />
      )}

      {/* 输入条卡片：保留灰色圆角外边框，取消内部文本底色 */}
      <Box borderColor="gray" borderStyle="round" flexDirection="row" paddingX={1}>
        <Text bold color="cyan">
          ξ &gt;{' '}
        </Text>
        {value ? <Text color="white">{value}</Text> : <Text color="gray">{placeholder}</Text>}
        {!isDisabled && <Text color="cyan">█</Text>}
      </Box>

      {/* Slash 命令选择浮层 */}
      {isSlashActive && <SlashMenu commands={commands} filter={value} selectedIndex={menuIndex} />}

      {/* Model 模型选择浮层 */}
      {isModelActive && (
        <ModelMenu
          currentModel={currentModel}
          filter={modelFilter}
          isLoading={isLoadingModels}
          models={availableModels}
          selectedIndex={modelMenuIndex}
        />
      )}

      {/* Session 会话选择浮层 */}
      {isSessionActive && (
        <SessionMenu
          currentSessionId={currentSessionId}
          filter={sessionFilter}
          selectedIndex={sessionMenuIndex}
          sessions={availableSessions}
        />
      )}

      {/* 底部按键提示与右下方思考模式指示 */}
      <Box flexDirection="row" justifyContent="space-between" marginTop={0}>
        <Text color="gray">
          (Tab 思考 · Ctrl+O {isToolsExpanded ? '折叠输出' : '展开输出'} · / 命令 · ↑/↓ 历史)
        </Text>
        <Box marginLeft={1}>
          {thinkingEnabled ? (
            <Text bold color="green">
              [🧠 思考: 开]
            </Text>
          ) : (
            <Text color="gray">[思考: 关]</Text>
          )}
        </Box>
      </Box>
    </Box>
  )
}
