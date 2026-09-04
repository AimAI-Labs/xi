import { Box, Text } from 'ink'
import React from 'react'

export interface ModelMenuProps {
  models: string[]
  filter: string
  selectedIndex: number
  currentModel?: string
  isLoading?: boolean
}

export function ModelMenu({
  models,
  filter,
  selectedIndex,
  currentModel,
  isLoading = false,
}: ModelMenuProps) {
  const search = filter.trim().toLowerCase()

  const filtered = models.filter((model) => {
    if (!search) return true
    return model.toLowerCase().includes(search)
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
        <Text color="gray">可用模型 (↑/↓ 选择 · Enter 切换 · Esc 关闭)</Text>
      </Box>

      {isLoading && models.length === 0 ? (
        <Box marginY={0}>
          <Text color="gray">正在从 API 获取可用模型...</Text>
        </Box>
      ) : filtered.length === 0 ? (
        <Box marginY={0}>
          <Text color="yellow">未找到匹配的模型 (可直接输入并按 Enter)</Text>
        </Box>
      ) : (
        filtered.map((model, index) => {
          const isSelected = index === selectedIndex
          const isCurrent = model === currentModel

          return (
            <Box key={model} flexDirection="row">
              <Text bold={isSelected} color={isSelected ? 'cyan' : 'white'}>
                {isSelected ? '> ' : '  '}
                {model}
              </Text>
              {isCurrent && <Text color="green"> (当前)</Text>}
            </Box>
          )
        })
      )}
    </Box>
  )
}
