import { Box, Text } from 'ink'
import React from 'react'

import type { SessionSummary } from '../../agent/SessionStore.js'

export interface SessionMenuProps {
  sessions: SessionSummary[]
  filter: string
  selectedIndex: number
  currentSessionId?: string
}

export function fuzzyMatch(pattern: string, text: string): boolean {
  const p = pattern.trim().toLowerCase()
  const t = text.toLowerCase()
  if (!p) return true
  if (t.includes(p)) return true

  let pIdx = 0
  for (let i = 0; i < t.length && pIdx < p.length; i++) {
    if (t[i] === p[pIdx]) {
      pIdx++
    }
  }
  return pIdx === p.length
}

function formatTime(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return `${hours}:${minutes}`
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`
}

export function SessionMenu({
  sessions,
  filter,
  selectedIndex,
  currentSessionId,
}: SessionMenuProps) {
  const filtered = sessions.filter((session) => {
    if (fuzzyMatch(filter, session.id)) return true
    if (session.lastUserMessage && fuzzyMatch(filter, session.lastUserMessage)) return true
    return false
  })

  return (
    <Box
      borderColor="gray"
      borderStyle="single"
      flexDirection="column"
      marginBottom={0}
      paddingX={1}
    >
      <Box marginBottom={0}>
        <Text color="gray">会话列表 (↑/↓ 选择 · Enter 切换 · Esc 关闭)</Text>
      </Box>

      {filtered.length === 0 ? (
        <Box marginY={0}>
          <Text color="yellow">未找到匹配的会话 (回车将切换/开启该名称)</Text>
        </Box>
      ) : (
        filtered.map((session, index) => {
          const isSelected = index === selectedIndex
          const isCurrent = session.id === currentSessionId
          const timeStr = formatTime(session.updatedAt)
          const snippet = session.lastUserMessage
            ? session.lastUserMessage.length > 20
              ? `${session.lastUserMessage.slice(0, 20)}...`
              : session.lastUserMessage
            : ''

          return (
            <Box key={session.id} flexDirection="row" justifyContent="space-between">
              <Box flexDirection="row">
                <Text bold={isSelected} color={isSelected ? 'cyan' : 'white'}>
                  {isSelected ? '> ' : '  '}
                  {session.id}
                </Text>
                {snippet ? <Text color="gray"> · {snippet}</Text> : null}
                {isCurrent && <Text color="green"> (当前)</Text>}
              </Box>
              <Box marginLeft={2}>
                <Text color="gray">
                  {session.messageCount} 条消息{timeStr ? ` · ${timeStr}` : ''}
                </Text>
              </Box>
            </Box>
          )
        })
      )}
    </Box>
  )
}
