import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { DangerConfirmCard } from '../../src/ui/components/DangerConfirmCard.js'

test('DangerConfirmCard 渲染高危命令内容与操作指引', (t) => {
  const { lastFrame } = render(
    <DangerConfirmCard
      command="rm -rf /tmp/data"
      onConfirm={() => {}}
      reason="检测到递归强制删除指令 (rm -rf)"
    />,
  )
  const frame = lastFrame() || ''

  t.true(frame.includes('高危命令执行确认'))
  t.true(frame.includes('rm -rf /tmp/data'))
  t.true(frame.includes('检测到递归强制删除指令'))
  t.true(frame.includes('[y] 允许'))
  t.true(frame.includes('[n/Esc] 拒绝'))
})

test('DangerConfirmCard 按 y 键触发放行确认', async (t) => {
  let approved: boolean | null = null
  const { stdin } = render(
    <DangerConfirmCard
      command="git push origin main -f"
      onConfirm={(val) => {
        approved = val
      }}
      reason="检测到 Git 强制推流指令"
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('y')
  await new Promise((resolve) => setTimeout(resolve, 30))

  t.is(approved, true)
})

test('DangerConfirmCard 按 n 键触发拒绝取消', async (t) => {
  let approved: boolean | null = null
  const { stdin } = render(
    <DangerConfirmCard
      command="del /f /s C:\\"
      onConfirm={(val) => {
        approved = val
      }}
      reason="检测到 Windows 强制递归删除"
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('n')
  await new Promise((resolve) => setTimeout(resolve, 30))

  t.is(approved, false)
})

test('DangerConfirmCard 按 Esc 键触发安全取消', async (t) => {
  let approved: boolean | null = null
  const { stdin } = render(
    <DangerConfirmCard
      command="format D:"
      onConfirm={(val) => {
        approved = val
      }}
      reason="检测到磁盘格式化指令"
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('\u001B') // Escape 键
  await new Promise((resolve) => setTimeout(resolve, 30))

  t.is(approved, false)
})
