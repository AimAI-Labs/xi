import test from 'ava'

import { BashTool } from '../../../src/agent/tools/BashTool.js'
import type { ToolContext } from '../../../src/agent/types.js'

test('安全命令直接执行，不调用 confirmDangerousCommand', async (t) => {
  let confirmCalled = false
  const tool = new BashTool()
  const context: ToolContext = {
    sessionId: 'test-session',
    confirmDangerousCommand: async () => {
      confirmCalled = true
      return true
    },
  }

  const result = await tool.execute({ command: 'node -e "console.log(123)"' }, context)
  t.false(confirmCalled, '安全命令不应调用确认回调')
  t.is(result, '123')
})

test('危险命令在无 confirmDangerousCommand 回调时被安全拦截', async (t) => {
  const tool = new BashTool()
  const context: ToolContext = {
    sessionId: 'test-session',
    // 未提供 confirmDangerousCommand
  }

  const result = await tool.execute({ command: 'rm -rf /tmp/test-dir' }, context)
  t.true(result.startsWith('[安全拦截]'), '应该返回安全拦截提示')
  t.true(result.includes('未启用交互式确认'), '应该包含未启用交互确认原因')
})

test('危险命令且用户拒绝执行时返回取消提示且不执行', async (t) => {
  let receivedCmd = ''
  let receivedReason = ''
  const tool = new BashTool()
  const context: ToolContext = {
    sessionId: 'test-session',
    confirmDangerousCommand: async (cmd, reason) => {
      receivedCmd = cmd
      receivedReason = reason
      return false // 用户拒绝
    },
  }

  const result = await tool.execute({ command: 'git push origin main --force' }, context)
  t.is(receivedCmd, 'git push origin main --force')
  t.true(receivedReason.includes('Git 强制推流'), '应该传递高危原因')
  t.true(result.startsWith('[用户取消]'), '应该返回用户取消提示')
  t.true(result.includes('用户已拒绝执行高危命令'))
})

test('普通单文件 del 命令同样触发危险拦截与确认', async (t) => {
  let interceptedCmd = ''
  let interceptedReason = ''
  const tool = new BashTool()
  const context: ToolContext = {
    sessionId: 'test-session',
    confirmDangerousCommand: async (cmd, reason) => {
      interceptedCmd = cmd
      interceptedReason = reason
      return false // 用户拒绝
    },
  }

  const result = await tool.execute(
    { command: 'del "C:\\Users\\Aimony\\Desktop\\test.txt" && echo "删除成功"' },
    context,
  )
  t.is(interceptedCmd, 'del "C:\\Users\\Aimony\\Desktop\\test.txt" && echo "删除成功"')
  t.true(interceptedReason.includes('文件删除指令'))
  t.true(result.startsWith('[用户取消]'))
})

test('危险命令且用户确认执行时正常放行命令', async (t) => {
  let confirmCalled = false
  const tool = new BashTool()
  const context: ToolContext = {
    sessionId: 'test-session',
    confirmDangerousCommand: async () => {
      confirmCalled = true
      return true // 用户允许
    },
  }

  // 使用被判定为危险的 git reset --hard 命令（带不存在的 ref，必定报错且无害）
  const err = await t.throwsAsync(async () => {
    await tool.execute({ command: 'git reset --hard __invalid_test_ref__' }, context)
  })
  t.true(confirmCalled, '应该已调用用户确认回调')
  t.truthy(err, '命令已被放行并尝试调用底层的 git 指令')
})
