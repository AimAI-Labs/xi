import { OpenAICompatibleClient } from '../../agent/index.js'
import { loadConfig, resolveApiKey, saveConfig } from '../../config/index.js'
import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class KeyCommand implements SlashCommand {
  name = 'key'
  aliases = ['apikey', 'set-key']
  description = '查看或配置 DeepSeek API Key'
  usage = '/key [api_key]'

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const inputKey = args.trim()
    const config = loadConfig()

    if (!inputKey) {
      const activeKey = resolveApiKey(config)
      if (activeKey) {
        const masked =
          activeKey.length > 8
            ? `${activeKey.slice(0, 4)}••••••••${activeKey.slice(-4)}`
            : '••••••••'
        return {
          type: 'output',
          message: [
            `当前 API Key: ${masked}`,
            `存储位置: ~/.xi/xi.toml`,
            `如需更新，请输入: /key <your_new_key>`,
          ].join('\n'),
        }
      }

      return {
        type: 'output',
        message:
          '当前未配置 API Key。\n请输入: /key <your_deepseek_api_key> 进行配置并保存至 ~/.xi/xi.toml',
      }
    }

    // 更新并保存至 ~/.xi/xi.toml
    config.llm = {
      ...config.llm,
      api_key: inputKey,
    }
    saveConfig(config)

    // 动态激活运行时 LLM 客户端
    const newClient = new OpenAICompatibleClient({
      apiKey: inputKey,
      baseURL: config.llm?.base_url,
      model: context.currentModel,
    })
    context.runtime.setLLMClient(newClient)

    // 通知外层上下文状态同步
    context.onConfigChange?.(config)

    const masked =
      inputKey.length > 8 ? `${inputKey.slice(0, 4)}••••••••${inputKey.slice(-4)}` : '••••••••'

    return {
      type: 'output',
      message: `🎉 API Key 已成功更新并保存至 ~/.xi/xi.toml (${masked})，已即刻生效！`,
    }
  }
}
