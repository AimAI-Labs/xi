import { Box, Text } from 'ink'
import React from 'react'

import type { SlashCommand } from '../../commands/types.js'

export interface SlashMenuProps {
  commands: SlashCommand[]
  filter: string
  selectedIndex: number
}

export function SlashMenu({ commands, filter, selectedIndex }: SlashMenuProps) {
  const search = filter.replace(/^\//, '').toLowerCase()

  const filtered = commands.filter((cmd) => {
    if (!search) return true
    const matchName = cmd.name.toLowerCase().startsWith(search)
    const matchAlias = cmd.aliases?.some((alias) =>
      alias.toLowerCase().replace(/^\//, '').startsWith(search),
    )
    return matchName || matchAlias
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginBottom={0}
    >
      <Box marginBottom={0}>
        <Text color="gray">可用命令 (↑/↓ 选择 · Enter 补全 · Esc 关闭)</Text>
      </Box>

      {filtered.length === 0 ? (
        <Box marginY={0}>
          <Text color="yellow">未找到匹配的命令</Text>
        </Box>
      ) : (
        filtered.map((cmd, index) => {
          const isSelected = index === selectedIndex
          return (
            <Box key={cmd.name} flexDirection="row">
              <Box width={14}>
                <Text bold={isSelected} color={isSelected ? 'cyan' : 'white'}>
                  {isSelected ? '> ' : '  '}/{cmd.name}
                </Text>
              </Box>
              <Text color={isSelected ? 'white' : 'gray'}>{cmd.description || ''}</Text>
            </Box>
          )
        })
      )}
    </Box>
  )
}
