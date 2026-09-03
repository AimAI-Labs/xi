import type { CommandContext, CommandResult, SlashCommand } from '../types.js'

export class ModelCommand implements SlashCommand {
  name = 'model'
  aliases = ['m']
  description = '查看或切换当前接入的大模型'
  usage = '/model [model_name]'

  async execute(args: string, context: CommandContext): Promise<CommandResult> {
    const targetModel = args.trim()

    if (!targetModel) {
      const apiKey = process.env['OPENAI_API_KEY']
        ? '已配置 (已隐藏)'
        : '未配置 (将采用本地 Mock 响应)'
      const baseUrl = process.env['OPENAI_BASE_URL'] || 'https://api.openai.com/v1'

      return {
        type: 'output',
        message: [
          `当前模型: ${context.currentModel}`,
          `API 端点: ${baseUrl}`,
          `API Key:  ${apiKey}`,
          `提示: 可通过 "/model <model_name>" 快速切换，例如: /model deepseek-chat`,
        ].join('\n'),
      }
    }

    context.setCurrentModel(targetModel)
    return {
      type: 'output',
      message: `已切换模型为: ${targetModel}`,
    }
  }
}
