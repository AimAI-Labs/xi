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

      const lines = [
        `当前模型: ${context.currentModel}`,
        `API 端点: ${baseUrl}`,
        `API Key:  ${keyStatus}`,
        `配置文件: ~/.xi/xi.toml`,
      ]

      try {
        const client = context.runtime?.getLLMClient()
        if (client && typeof client.fetchModels === 'function') {
          const models = await client.fetchModels()
          if (models.length > 0) {
            lines.push(`可用模型: ${models.join(', ')}`)
          }
        }
      } catch {
        // 静默捕获模型获取异常
      }

      lines.push('提示: 可通过 "/model <model_name>" 切换模型，通过 "/key <api_key>" 配置密钥')

      return {
        type: 'output',
        message: lines.join('\n'),
      }
    }

    context.setCurrentModel(targetModel)

    // 持久化到 ~/.xi/xi.toml
    config.llm = {
      ...config.llm,
      model: targetModel,
    }
    saveConfig(config)

    // 通知外层上下文状态同步
    context.onConfigChange?.(config)

    return {
      type: 'output',
      message: `已切换模型为: ${targetModel} (已同步保存至 ~/.xi/xi.toml)`,
    }
  }
}
