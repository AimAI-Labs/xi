import { loadConfig, resolveApiKey, saveConfig } from '../../config/index.js'
import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class ModelCommand implements SlashCommand {
  name = 'model'
  aliases = ['m']
  description = '查看或切换当前接入的大模型'
  usage = '/model [model_name]'

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const targetModel = args.trim()
    const config = loadConfig()
    const activeKey = resolveApiKey(config)
    const baseUrl = config.llm?.base_url || 'https://api.deepseek.com'

    if (!targetModel) {
      const keyStatus = activeKey
        ? `已配置 (${activeKey.length > 8 ? `${activeKey.slice(0, 4)}••••${activeKey.slice(-4)}` : '••••'})`
        : '未配置 (可通过 /key <api_key> 命令配置)'

      return {
        type: 'output',
        message: [
          `当前模型: ${context.currentModel}`,
          `API 端点: ${baseUrl}`,
          `API Key:  ${keyStatus}`,
          `配置文件: ~/.xi.toml`,
          `提示: 可通过 "/model <model_name>" 切换模型，通过 "/key <api_key>" 配置密钥`,
        ].join('\n'),
      }
    }

    context.setCurrentModel(targetModel)

    // 持久化到 ~/.xi.toml
    config.llm = {
      ...config.llm,
      model: targetModel,
    }
    saveConfig(config)

    return {
      type: 'output',
      message: `已切换模型为: ${targetModel} (已同步保存至 ~/.xi.toml)`,
    }
  }
}
