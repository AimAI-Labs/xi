import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parse, stringify } from 'smol-toml'

import type { XiConfig } from './types.js'

export * from './types.js'

export const DEFAULT_CONFIG: XiConfig = {
  llm: {
    provider: 'deepseek',
    api_key: '',
    base_url: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    temperature: 0.2,
  },
  agent: {
    max_turns: 10,
    verbose: true,
  },
  ui: {
    theme: 'dark',
  },
}

export function getConfigPath(): string {
  return path.join(os.homedir(), '.xi.toml')
}

export function loadConfig(customPath?: string): XiConfig {
  const filePath = customPath || getConfigPath()

  if (!fs.existsSync(filePath)) {
    return structuredClone(DEFAULT_CONFIG)
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = parse(content) as any

    return {
      llm: {
        provider: parsed.llm?.provider ?? DEFAULT_CONFIG.llm.provider,
        api_key: parsed.llm?.api_key ?? DEFAULT_CONFIG.llm.api_key,
        base_url: parsed.llm?.base_url ?? DEFAULT_CONFIG.llm.base_url,
        model: parsed.llm?.model ?? DEFAULT_CONFIG.llm.model,
        temperature: parsed.llm?.temperature ?? DEFAULT_CONFIG.llm.temperature,
      },
      agent: {
        max_turns: parsed.agent?.max_turns ?? DEFAULT_CONFIG.agent?.max_turns,
        verbose: parsed.agent?.verbose ?? DEFAULT_CONFIG.agent?.verbose,
      },
      ui: {
        theme: parsed.ui?.theme ?? DEFAULT_CONFIG.ui?.theme,
      },
    }
  } catch (error) {
    console.warn(`[xi] 读取配置文件失败 (${filePath}):`, error)
    return structuredClone(DEFAULT_CONFIG)
  }
}

export function saveConfig(config: XiConfig, customPath?: string): void {
  const filePath = customPath || getConfigPath()
  const dir = path.dirname(filePath)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const tomlString = stringify(config as any)
  fs.writeFileSync(filePath, tomlString, 'utf-8')
}

export function resolveApiKey(config: XiConfig): string {
  if (process.env['DEEPSEEK_API_KEY']) {
    return process.env['DEEPSEEK_API_KEY'].trim()
  }

  if (config.llm?.api_key && config.llm.api_key.trim()) {
    return config.llm.api_key.trim()
  }

  if (process.env['OPENAI_API_KEY']) {
    return process.env['OPENAI_API_KEY'].trim()
  }

  return ''
}
