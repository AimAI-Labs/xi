export type DisplayRole = 'user' | 'thinking' | 'tool' | 'assistant' | 'system'

export interface DisplayItem {
  id: string
  role: DisplayRole
  content: string
  timestamp: number
  metadata?: Record<string, unknown>
}
