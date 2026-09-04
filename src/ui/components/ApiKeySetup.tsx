import { Box, Text, useInput, useStdin } from 'ink'
import React, { useEffect, useState } from 'react'

export interface ApiKeySetupProps {
  onSave: (apiKey: string) => void
  onExit: () => void
}

interface RawKeyInputProps {
  value: string
  setValue: React.Dispatch<React.SetStateAction<string>>
  onSave: (apiKey: string) => void
  onExit: () => void
}

function RawKeyInput({ value, setValue, onSave, onExit }: RawKeyInputProps) {
  useInput((input, key) => {
    // Ctrl+C 或 Esc: 退出
    if ((key.ctrl && input === 'c') || key.escape) {
      onExit()
      return
    }

    // 回车处理
    if (key.return || input === '\r' || input === '\n') {
      const trimmed = value.trim()
      if (!trimmed) {
        onExit()
      } else {
        onSave(trimmed)
      }
      return
    }

    // 退格
    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1))
      return
    }

    // 字符输入
    if (!key.ctrl && !key.meta && input) {
      if (input.includes('\r') || input.includes('\n')) {
        const clean = (value + input).replace(/[\r\n]+/g, '').trim()
        if (!clean) {
          onExit()
        } else {
          onSave(clean)
        }
        return
      }
      setValue((prev) => prev + input)
    }
  })

  return null
}

export function ApiKeySetup({ onSave, onExit }: ApiKeySetupProps) {
  const { isRawModeSupported, stdin } = useStdin()
  const isRealTTY = Boolean(isRawModeSupported && typeof (stdin as any).ref === 'function')
  const [value, setValue] = useState('')

  // 兼顾自动化测试及非 TTY 管道输入
  useEffect(() => {
    if (isRealTTY) return

    const handleData = (chunk: Buffer | string) => {
      const text = chunk
        .toString()
        .replace(/[\r\n]+/g, '')
        .trim()
      if (!text) {
        onExit()
      } else {
        onSave(text)
      }
    }

    stdin.on('data', handleData)
    return () => {
      stdin.off('data', handleData)
    }
  }, [isRealTTY, onSave, onExit, stdin])

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Text bold color="cyan">
          🚀 欢迎使用 xi 智能终端助手
        </Text>
        <Text color="white">系统默认集成 DeepSeek 大模型服务（deepseek-v4-flash）。</Text>
        <Text color="yellow">检测到您尚未配置 API Key。请输入您的 DeepSeek API Key：</Text>
        <Text color="gray">
          (可前往 https://platform.deepseek.com 注册获取，配置将保存至 ~/.xi/xi.toml)
        </Text>
      </Box>

      {isRealTTY && (
        <RawKeyInput value={value} setValue={setValue} onSave={onSave} onExit={onExit} />
      )}

      <Box marginTop={1} flexDirection="row" borderStyle="round" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          Key &gt;{' '}
        </Text>
        {value ? (
          <Text color="white">
            {value.length > 8 ? `${value.slice(0, 4)}••••••••${value.slice(-4)}` : value}
          </Text>
        ) : (
          <Text color="gray">请输入 sk- 开头的 API Key (空输入回车则退出)...</Text>
        )}
        <Text color="cyan">█</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">
          (按 Enter 保存至 ~/.xi/xi.toml · 若无 Key 直接按回车或 Ctrl+C 退出程序)
        </Text>
      </Box>
    </Box>
  )
}
