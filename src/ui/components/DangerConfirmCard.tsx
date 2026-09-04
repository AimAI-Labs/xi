import { Box, Text, useInput, useStdin } from 'ink'
import React, { useEffect } from 'react'

export interface DangerConfirmCardProps {
  command: string
  reason: string
  onConfirm: (approved: boolean) => void
}

function RawConfirmHandler({ onConfirm }: { onConfirm: (approved: boolean) => void }) {
  useInput((input, key) => {
    const lower = input.toLowerCase()
    if (lower === 'y') {
      onConfirm(true)
    } else if (lower === 'n' || key.escape || key.return) {
      onConfirm(false)
    }
  })
  return null
}

export function DangerConfirmCard({ command, reason, onConfirm }: DangerConfirmCardProps) {
  const { isRawModeSupported, stdin } = useStdin()
  const isRealTTY = Boolean(isRawModeSupported && typeof (stdin as any).ref === 'function')

  useEffect(() => {
    if (isRealTTY) return

    const handleData = (chunk: Buffer | string) => {
      const raw = chunk.toString()
      if (raw === '\u001B') {
        onConfirm(false)
        return
      }
      const char = raw.trim().toLowerCase()
      if (char === 'y') {
        onConfirm(true)
      } else if (char === 'n' || raw.includes('\r') || raw.includes('\n')) {
        onConfirm(false)
      }
    }

    stdin.on('data', handleData)
    return () => {
      stdin.off('data', handleData)
    }
  }, [isRealTTY, onConfirm, stdin])

  return (
    <Box borderColor="red" borderStyle="round" flexDirection="column" marginBottom={1} paddingX={1}>
      {isRealTTY && <RawConfirmHandler onConfirm={onConfirm} />}
      <Box marginBottom={1}>
        <Text bold color="red">
          ⚠️ 高危命令执行确认 (Dangerous Command Confirmation)
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="yellow">原因: {reason}</Text>
      </Box>
      <Box marginBottom={1}>
        <Text bold color="white">
          命令: {command}
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          按{' '}
          <Text bold color="green">
            [y] 允许
          </Text>{' '}
          执行 | 按{' '}
          <Text bold color="red">
            [n/Esc] 拒绝
          </Text>{' '}
          取消
        </Text>
      </Box>
    </Box>
  )
}
