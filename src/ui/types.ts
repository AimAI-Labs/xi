export type DisplayRole = 'user' | 'thinking' | 'tool' | 'assistant' | 'system'

export interface ToolCallDisplayData {
  toolCallId?: string
  toolName: string
  args?: Record<string, unknown>
  status: 'running' | 'completed' | 'error'
  result?: string
  durationMs?: number
}

export interface DisplayItem {
  id: string
  role: DisplayRole
  content: string
  timestamp: number
  isHistorical?: boolean
  toolCall?: ToolCallDisplayData
  metadata?: Record<string, unknown>
}
