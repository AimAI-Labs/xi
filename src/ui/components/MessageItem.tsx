import { Box, Text } from 'ink'
import React from 'react'

import type { DisplayItem } from '../types.js'

export interface MessageItemProps {
  item: DisplayItem
}

export function MessageItem({ item }: MessageItemProps) {
  switch (item.role) {
    case 'user':
      return (
        <Box marginBottom={1}>
          <Text bold color="cyan">
            ❯{' '}
          </Text>
          <Text bold color="white">
            {item.content}
          </Text>
        </Box>
      )

    case 'thinking':
      return (
        <Box marginBottom={1} paddingLeft={2}>
          <Text color="gray">💭 {item.content}</Text>
        </Box>
      )

    case 'tool':
      return (
        <Box marginBottom={1} paddingLeft={2}>
          <Text color="yellow">⚙ {item.content}</Text>
        </Box>
      )

    case 'assistant':
      return (
        <Box marginBottom={1}>
          <Text bold color="green">
            ●{' '}
          </Text>
          <Text color="white">{item.content}</Text>
        </Box>
      )

    case 'system':
      return (
        <Box marginBottom={1}>
          <Text color="magenta">ℹ {item.content}</Text>
        </Box>
      )

    default:
      return (
        <Box marginBottom={1}>
          <Text>{item.content}</Text>
        </Box>
      )
  }
}
