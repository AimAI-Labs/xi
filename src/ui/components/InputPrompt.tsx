import { Box, Text, useInput, useStdin } from 'ink'
import React, { useEffect, useState } from 'react'

export interface InputPromptProps {
  isDisabled?: boolean
  onSubmit: (value: string) => void
  onExit: () => void
  placeholder?: string
}

interface RawInputHandlerProps {
  isDisabled: boolean
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  history: string[]
  setHistory: React.Dispatch<React.SetStateAction<string[]>>
  historyIndex: number
  setHistoryIndex: React.Dispatch<React.SetStateAction<number>>
  onSubmit: (value: string) => void
  onExit: () => void
}

/**
 * 仅在支持 TTY / Raw Mode 的真实终端环境下挂载此组件，防止在测试环境中触发 setRawMode 异常
 */
function RawInputHandler({
  isDisabled,
  value,
  setValue,
  history,
  setHistory,
  historyIndex,
  setHistoryIndex,
  onSubmit,
  onExit,
}: RawInputHandlerProps) {
  useInput((input, key) => {
    if (isDisabled) return

    // Ctrl+C 退出
    if (key.ctrl && input === 'c') {
      onExit()
      return
    }

    // 回车提交
    if (key.return || input === '\r' || input === '\n') {
      const trimmed = value.trim()
      if (trimmed) {
        setHistory((prev) => [trimmed, ...prev])
        setHistoryIndex(-1)
        setValue('')
        onSubmit(trimmed)
      }
      return
    }

    // 方向键 Up: 翻找上一条历史
    if (key.upArrow) {
      if (history.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(nextIndex)
        setValue(history[nextIndex] ?? '')
      }
      return
    }

    // 方向键 Down: 返回较新历史
    if (key.downArrow) {
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
      setValue((prev) => prev.slice(0, -1))
      return
    }

    // 常规文本输入
    if (!key.ctrl && !key.meta && input) {
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
  placeholder = '输入消息或 /help...',
}: InputPromptProps) {
  const { isRawModeSupported, stdin } = useStdin()
  const isRealTTY = Boolean(isRawModeSupported && typeof (stdin as any).ref === 'function')
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)

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
          onSubmit={onSubmit}
          onExit={onExit}
        />
      )}
      <Box flexDirection="row">
        <Text bold color="cyan">
          xi &gt;{' '}
        </Text>
        {value ? <Text color="white">{value}</Text> : <Text color="gray">{placeholder}</Text>}
        {!isDisabled && <Text color="cyan">█</Text>}
      </Box>
      <Box marginTop={0}>
        <Text color="gray">(输入 / 唤出命令 · /help 查看帮助 · ↑/↓ 历史记录 · Ctrl+C 退出)</Text>
      </Box>
    </Box>
  )
}
