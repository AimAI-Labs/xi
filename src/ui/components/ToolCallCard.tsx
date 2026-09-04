import { Box, Text } from 'ink'
import React from 'react'

export interface ToolCallCardProps {
  toolName: string
  status: 'running' | 'completed' | 'error'
  args?: Record<string, unknown>
  result?: string
  durationMs?: number
  isHistorical?: boolean
  isExpanded?: boolean
}

export function ToolCallCard({
  toolName,
  status,
  args = {},
  result,
  durationMs,
  isHistorical = false,
  isExpanded = false,
}: ToolCallCardProps) {
  // 提取各工具的具体命令或主要参数
  const getToolActionSummary = () => {
    if (toolName === 'bash' && args['command']) {
      return `$ ${String(args['command'])}`
    }
    if (toolName === 'calculator' && args['expression']) {
      return `计算: ${String(args['expression'])}`
    }
    if (toolName === 'search' && args['query']) {
      return `检索: "${String(args['query'])}"`
    }
    if (toolName === 'todo') {
      const action = args['action'] ? String(args['action']) : 'list'
      const content = args['content'] ? ` "${String(args['content'])}"` : ''
      return `待办: ${action}${content}`
    }

    const argKeys = Object.keys(args)
    if (argKeys.length === 0) return ''
    return Object.entries(args)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ')
  }

  const actionSummary = getToolActionSummary()

  // 1. 执行中 (running)
  if (status === 'running') {
    return (
      <Box flexDirection="column" marginY={0} paddingLeft={2}>
        <Box>
          <Text color="cyan">⚙ [{toolName}] </Text>
          <Text color="yellow">执行中... </Text>
          {actionSummary && <Text dimColor>{actionSummary}</Text>}
        </Box>
      </Box>
    )
  }

  // 2. 执行失败 (error)
  if (status === 'error') {
    return (
      <Box flexDirection="column" marginY={0} paddingLeft={2}>
        <Box>
          <Text color="red">✖ [{toolName}] </Text>
          {durationMs !== undefined && <Text dimColor>({durationMs}ms) </Text>}
          {actionSummary && <Text dimColor>{actionSummary}</Text>}
          {toolName === 'bash' && !isExpanded && <Text dimColor> (Ctrl+O 展开报错)</Text>}
        </Box>
        {(toolName !== 'bash' || isExpanded) && result && (
          <Box paddingLeft={2}>
            <Text color="red">{result}</Text>
          </Box>
        )}
      </Box>
    )
  }

  // 3. 执行成功 (completed)
  // bash 工具默认不显示内容，只显示执行的命令，按 Ctrl+O 展开全部内容
  const shouldShowContent = toolName === 'bash' ? isExpanded : true

  return (
    <Box flexDirection="column" marginY={0} paddingLeft={2}>
      <Box>
        <Text color={isHistorical ? 'gray' : 'green'}>✔ [{toolName}] </Text>
        {durationMs !== undefined && <Text dimColor>({durationMs}ms) </Text>}
        {actionSummary && <Text color={isHistorical ? 'gray' : 'cyan'}>{actionSummary}</Text>}
        {toolName === 'bash' && (
          <Text dimColor> {isExpanded ? '(Ctrl+O 折叠)' : '(Ctrl+O 展开)'}</Text>
        )}
      </Box>
      {shouldShowContent && result && (
        <Box paddingLeft={2}>
          <Text dimColor>
            {result.length > 500 && !isExpanded ? `${result.slice(0, 500)}... (已截断)` : result}
          </Text>
        </Box>
      )}
    </Box>
  )
}
