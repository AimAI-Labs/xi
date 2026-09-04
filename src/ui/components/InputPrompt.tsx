import { Box, Text, useInput, useStdin } from 'ink'
import React, { useEffect, useState } from 'react'

import type { SlashCommand } from '../../commands/types.js'
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

    // Escape 键: 关闭 Slash 菜单浮层
    if (key.escape) {
      if (isSlashActive) {
        setIsMenuDismissed(true)
        return
      }
    }

    // 回车处理
    if (key.return || input === '\r' || input === '\n') {
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
        onSubmit(trimmed)
      }
      return
    }

    // 方向键 Up
    if (key.upArrow) {
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
}: InputPromptProps) {
  const { isRawModeSupported, stdin } = useStdin()
  const isRealTTY = Boolean(isRawModeSupported && typeof (stdin as any).ref === 'function')
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const [menuIndex, setMenuIndex] = useState<number>(0)
  const [isMenuDismissed, setIsMenuDismissed] = useState<boolean>(false)

  const isSlashActive =
    value.startsWith('/') && !value.includes(' ') && !isMenuDismissed && commands.length > 0

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
          isDisabled={isDisabled}
          value={value}
          setValue={setValue}
          history={history}
          setHistory={setHistory}
          historyIndex={historyIndex}
          setHistoryIndex={setHistoryIndex}
          commands={commands}
          menuIndex={menuIndex}
          setMenuIndex={setMenuIndex}
          isMenuDismissed={isMenuDismissed}
          setIsMenuDismissed={setIsMenuDismissed}
          onToggleThinking={onToggleThinking}
          onToggleExpandTools={onToggleExpandTools}
          onSubmit={onSubmit}
          onExit={onExit}
        />
      )}

      {/* Slash 命令选择浮层 */}
      {isSlashActive && <SlashMenu commands={commands} filter={value} selectedIndex={menuIndex} />}

      {/* 输入条卡片：保留灰色圆角外边框，取消内部文本底色 */}
      <Box flexDirection="row" borderStyle="round" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          ξ &gt;{' '}
        </Text>
        {value ? <Text color="white">{value}</Text> : <Text color="gray">{placeholder}</Text>}
        {!isDisabled && <Text color="cyan">█</Text>}
      </Box>

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
