import { Box } from 'ink'
import React from 'react'

import type { DisplayItem } from '../types.js'
import { MessageItem } from './MessageItem.js'

export interface MessageListProps {
  items: DisplayItem[]
  isToolsExpanded?: boolean
}

export function MessageList({ items, isToolsExpanded = false }: MessageListProps) {
  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <MessageItem key={item.id} isExpanded={isToolsExpanded} item={item} />
      ))}
    </Box>
  )
}
