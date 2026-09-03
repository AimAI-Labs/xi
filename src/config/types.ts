export interface LLMConfig {
  provider?: string
  api_key?: string
  base_url?: string
  model?: string
  temperature?: number
}

export interface AgentConfig {
  max_turns?: number
  verbose?: boolean
}

export interface UIConfig {
  theme?: string
}

export interface XiConfig {
  llm: LLMConfig
  agent?: AgentConfig
  ui?: UIConfig
}
