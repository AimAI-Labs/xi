import { Box, Text } from 'ink'
import React from 'react'

export interface HeaderProps {
  version?: string
  model: string
  sessionId: string
}

export function Header({ version = '0.0.0', model, sessionId }: HeaderProps) {
  return (
    <Box flexDirection="row" marginBottom={1}>
      {/* 左侧 3 行 ξ ASCII 图标 */}
      <Box flexDirection="column" marginRight={2}>
        <Text bold color="cyan">
          ╭─╮
        </Text>
        <Text bold color="cyan">
          ╰─╮
        </Text>
        <Text bold color="cyan">
          ╰─╯
        </Text>
      </Box>

      {/* 右侧 3 行状态层次矩阵 */}
      <Box flexDirection="column" justifyContent="center">
        <Box flexDirection="row">
          <Text bold color="cyan">
            ξ{' '}
          </Text>
          <Text color="gray">v{version}</Text>
        </Box>
        <Box flexDirection="row">
          <Text color="gray">model: </Text>
          <Text bold color="magenta">
            {model}
          </Text>
        </Box>
        <Box flexDirection="row">
          <Text color="gray">session: </Text>
          <Text color="yellow">{sessionId}</Text>
        </Box>
      </Box>
    </Box>
  )
}
