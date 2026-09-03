import { Box, Text } from 'ink'
import React from 'react'

export interface HeaderProps {
  version?: string
  model: string
  sessionId: string
}

export function Header({ version = '0.0.0', model, sessionId }: HeaderProps) {
  return (
    <Box marginBottom={1} flexDirection="row">
      <Text bold color="cyan">
        xi{' '}
      </Text>
      <Text color="gray">v{version} · </Text>
      <Text color="magenta">{model} </Text>
      <Text color="gray">· session: </Text>
      <Text color="yellow">{sessionId}</Text>
    </Box>
  )
}
