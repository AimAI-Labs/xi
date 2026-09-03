import chalk from 'chalk'
import { render } from 'ink'
import meow from 'meow'
import React from 'react'

import {
  AgentRuntime,
  CalculatorTool,
  SearchTool,
  BashTool,
  TodoTool,
  ToolRegistry,
  Tracer,
  MockLLMClient,
  OpenAICompatibleClient,
} from './agent/index.js'
import App from './app.js'

const cli = meow(
  `
	Usage
	  $ xi [command]

	Commands
	  agent <prompt>   运行 Agent 处理任务
	  demo             运行内置全功能 Agent 多轮对话与工具调用演示

	Options
	  --name           Your name (默认欢迎模式)
	  --session        指定会话 ID (默认: "default")
	  --verbose        输出详细的 Agent 思考与工具调用链路 (默认: true)

	Examples
	  $ xi --name=Jane
	  $ xi demo
	  $ xi agent "帮我计算 (100 + 20) * 3"
`,
  {
    importMeta: import.meta,
    flags: {
      name: {
        type: 'string',
      },
      session: {
        type: 'string',
        default: 'default',
      },
      verbose: {
        type: 'boolean',
        default: true,
      },
    },
  },
)

async function runCli() {
  const [command, ...args] = cli.input

  if (command === 'demo') {
    console.log(chalk.bold.cyan('\n🚀 启动 xi Agent 多轮执行与工具调用演示...\n'))

    const registry = new ToolRegistry()
      .register(new CalculatorTool())
      .register(new SearchTool())
      .register(new BashTool())
      .register(new TodoTool())

    const tracer = new Tracer({ verbose: true })
    const mockClient = new MockLLMClient()

    // 预设演示回复流：先查天气，再加待办，最后总结
    mockClient.queueResponse({
      content: null,
      reasoning_content: '用户需要了解北京天气，首先调用 search 工具检索天气数据。',
      tool_calls: [
        {
          id: 'demo_call_1',
          type: 'function',
          function: {
            name: 'search',
            arguments: JSON.stringify({ query: '北京天气' }),
          },
        },
      ],
    })

    mockClient.queueResponse({
      content: null,
      reasoning_content: '搜索返回晴朗且气温适宜，根据用户要求调用 todo 工具记录一条待办事项。',
      tool_calls: [
        {
          id: 'demo_call_2',
          type: 'function',
          function: {
            name: 'todo',
            arguments: JSON.stringify({ action: 'add', item: '周末去香山徒步' }),
          },
        },
      ],
    })

    mockClient.queueResponse({
      content:
        '已为您完成两项任务：\n1. 查询到北京今日晴朗（22°C，微风）。\n2. 已为您在待办清单中添加“周末去香山徒步”！',
      reasoning_content: '两步工具执行完毕，输出整合后的友好回复。',
    })

    const runtime = new AgentRuntime({
      llmClient: mockClient,
      toolRegistry: registry,
      tracer,
    })

    console.log(
      chalk.yellow('▶ 用户输入: "帮我查下北京天气，并在待办里添加一个适合这天气的计划"\n'),
    )
    const result = await runtime.run(
      'demo-session',
      '帮我查下北京天气，并在待办里添加一个适合这天气的计划',
    )

    console.log(chalk.green('\n🎉 Agent 最终交付结果:'))
    console.log(chalk.white(result.finalResponse))
    console.log(
      chalk.gray(
        `\n(共经历 ${result.turnsCount} 轮 Loop 迭代，捕获 ${result.traces.length} 个 Trace 事件)\n`,
      ),
    )
    return
  }

  if (command === 'agent') {
    const prompt = args.join(' ').trim()
    if (!prompt) {
      console.log(chalk.red('请提供需要 Agent 处理的问题或任务，例如: xi agent "计算 12 * 8"'))
      return
    }

    const registry = new ToolRegistry()
      .register(new CalculatorTool())
      .register(new SearchTool())
      .register(new BashTool())
      .register(new TodoTool())

    const tracer = new Tracer({ verbose: cli.flags.verbose })
    // 如果有 API Key 则使用 OpenAIClient，否则使用演示 client
    const apiKey = process.env['OPENAI_API_KEY']
    const client = apiKey
      ? new OpenAICompatibleClient({ apiKey })
      : new MockLLMClient({
          handler: async () => ({
            content: `[未检测到 OPENAI_API_KEY，已启动本地模拟回复] 收到指令: "${prompt}"。若要连通真实大模型，请配置 OPENAI_API_KEY 与 OPENAI_BASE_URL。`,
          }),
        })

    const runtime = new AgentRuntime({
      llmClient: client,
      toolRegistry: registry,
      tracer,
    })

    const result = await runtime.run(cli.flags.session, prompt)
    console.log(chalk.green('\nAgent 回复:'))
    console.log(result.finalResponse)
    return
  }

  // 默认模式：保持原 Ink 渲染
  render(<App name={cli.flags.name} />)
}

void runCli()
