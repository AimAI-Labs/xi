import { Box, Text } from 'ink'
import React from 'react'

import type { DisplayItem } from '../types.js'
import { ToolCallCard } from './ToolCallCard.js'

export interface MessageItemProps {
  item: DisplayItem
  isExpanded?: boolean
}

export function MessageItem({ item, isExpanded = false }: MessageItemProps) {
  const isHist = Boolean(item.isHistorical)

  switch (item.role) {
    case 'user':
      // 需求: 用户输入这一行的背景显示为灰色，以便与 AI 回答区分
      return (
        <Box marginBottom={1}>
          <Text backgroundColor="#303030" bold color="cyan">
            {' '}
            ❯{' '}
          </Text>
          <Text backgroundColor="#303030" bold color="white">
            {item.content}{' '}
          </Text>
        </Box>
      )

    case 'thinking':
      return (
        <Box marginBottom={1} paddingLeft={2}>
          <Text color="gray" dimColor={isHist}>
            💭 {item.content}
          </Text>
        </Box>
      )

    case 'tool':
      if (item.toolCall) {
        return (
          <Box marginBottom={1}>
            <ToolCallCard {...item.toolCall} isExpanded={isExpanded} isHistorical={isHist} />
          </Box>
        )
      }
      return (
        <Box marginBottom={1} paddingLeft={2}>
          <Text color="yellow">⚙ {item.content}</Text>
        </Box>
      )

    case 'assistant':
      // 需求: AI 的回答不要变灰，保持透明底色与正常文本
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
