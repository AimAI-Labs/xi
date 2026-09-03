import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import test from 'ava'

import {
  getConfigPath,
  loadConfig,
  saveConfig,
  resolveApiKey,
  DEFAULT_CONFIG,
} from '../src/config/index.js'
import type { XiConfig } from '../src/config/types.js'

test('getConfigPath returns correct path in user home directory', (t) => {
  const p = getConfigPath()
  t.is(p, path.join(os.homedir(), '.xi.toml'))
})

test('loadConfig returns default config when file does not exist', (t) => {
  const tmpFile = path.join(os.tmpdir(), `xi-test-${Date.now()}-${Math.random()}.toml`)
  const config = loadConfig(tmpFile)

  t.is(config.llm.provider, 'deepseek')
  t.is(config.llm.model, 'deepseek-v4-flash')
  t.is(config.llm.base_url, 'https://api.deepseek.com')
})

test('saveConfig and loadConfig handle serialization roundtrip properly', (t) => {
  const tmpFile = path.join(os.tmpdir(), `xi-roundtrip-${Date.now()}-${Math.random()}.toml`)

  const customConfig: XiConfig = {
    llm: {
      provider: 'deepseek',
      api_key: 'sk-test-secret',
      base_url: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      temperature: 0.5,
    },
    agent: {
      max_turns: 15,
      verbose: false,
    },
    ui: {
      theme: 'dark',
    },
  }

  saveConfig(customConfig, tmpFile)
  t.true(fs.existsSync(tmpFile))

  const loaded = loadConfig(tmpFile)
  t.is(loaded.llm.api_key, 'sk-test-secret')
  t.is(loaded.llm.temperature, 0.5)
  t.is(loaded.agent?.max_turns, 15)

  // 清理临时文件
  fs.unlinkSync(tmpFile)
})

test('resolveApiKey prioritizes DEEPSEEK_API_KEY over config and OPENAI_API_KEY', (t) => {
  const originalDeepSeek = process.env['DEEPSEEK_API_KEY']
  const originalOpenAI = process.env['OPENAI_API_KEY']

  try {
    delete process.env['DEEPSEEK_API_KEY']
    delete process.env['OPENAI_API_KEY']

    // 1. 无任何 key
    t.is(resolveApiKey(DEFAULT_CONFIG), '')

    // 2. 仅 config 有 key
    const configWithKey: XiConfig = {
      ...DEFAULT_CONFIG,
      llm: { ...DEFAULT_CONFIG.llm, api_key: 'sk-from-config' },
    }
    t.is(resolveApiKey(configWithKey), 'sk-from-config')

    // 3. OPENAI_API_KEY 作为 fallback
    process.env['OPENAI_API_KEY'] = 'sk-from-openai'
    t.is(resolveApiKey(DEFAULT_CONFIG), 'sk-from-openai')
    // config 优先于 OPENAI_API_KEY
    t.is(resolveApiKey(configWithKey), 'sk-from-config')

    // 4. DEEPSEEK_API_KEY 最高优先级
    process.env['DEEPSEEK_API_KEY'] = 'sk-from-deepseek-env'
    t.is(resolveApiKey(configWithKey), 'sk-from-deepseek-env')
  } finally {
    if (originalDeepSeek !== undefined) {
      process.env['DEEPSEEK_API_KEY'] = originalDeepSeek
    } else {
      delete process.env['DEEPSEEK_API_KEY']
    }
    if (originalOpenAI !== undefined) {
      process.env['OPENAI_API_KEY'] = originalOpenAI
    } else {
      delete process.env['OPENAI_API_KEY']
    }
  }
})
