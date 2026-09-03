import { Box } from 'ink'
import React from 'react'

import type { DisplayItem } from '../types.js'
import { MessageItem } from './MessageItem.js'

export interface MessageListProps {
  items: DisplayItem[]
}

export function MessageList({ items }: MessageListProps) {
  return (
    <Box flexDirection="column">
      {items.map((item) => (
        <MessageItem key={item.id} item={item} />
      ))}
    </Box>
  )
}
