import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { InputPrompt } from '../../src/ui/components/InputPrompt.js'

test('InputPrompt renders ModelMenu when typing /model with a space', async (t) => {
  const models = ['deepseek-chat', 'deepseek-reasoner']
  const { lastFrame } = render(
    <InputPrompt
      currentModel="deepseek-chat"
      initialValue="/model "
      onExit={() => {}}
      onFetchModels={async () => models}
      onSubmit={() => {}}
    />,
  )

  // 等待异步 fetchModels 完成
  await new Promise((resolve) => setTimeout(resolve, 50))

  const frame = lastFrame() || ''
  t.true(frame.includes('可用模型'))
  t.true(frame.includes('deepseek-chat'))
  t.true(frame.includes('deepseek-reasoner'))
  t.true(frame.includes('(当前)'))
})

test('InputPrompt filters models when typing /model with prefix argument', async (t) => {
  const models = ['deepseek-chat', 'deepseek-reasoner']
  const { lastFrame } = render(
    <InputPrompt
      currentModel="deepseek-chat"
      initialValue="/model reason"
      onExit={() => {}}
      onFetchModels={async () => models}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 50))

  const frame = lastFrame() || ''
  t.true(frame.includes('deepseek-reasoner'))
  t.false(frame.includes('deepseek-chat'))
})

test('InputPrompt supports /m alias for model menu', async (t) => {
  const models = ['deepseek-chat', 'deepseek-reasoner']
  const { lastFrame } = render(
    <InputPrompt
      currentModel="deepseek-chat"
      initialValue="/m "
      onExit={() => {}}
      onFetchModels={async () => models}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 50))

  const frame = lastFrame() || ''
  t.true(frame.includes('可用模型'))
  t.true(frame.includes('deepseek-chat'))
})

test('InputPrompt emits submitted command on enter in non-TTY mode', async (t) => {
  let submittedText = ''
  const { stdin } = render(
    <InputPrompt
      onExit={() => {}}
      onSubmit={(val) => {
        submittedText = val
      }}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('/model deepseek-reasoner\r\n')
  await new Promise((resolve) => setTimeout(resolve, 50))

  t.is(submittedText, '/model deepseek-reasoner')
})

test('InputPrompt renders ModelMenu below the input dialog box', async (t) => {
  const models = ['deepseek-chat', 'deepseek-reasoner']
  const { lastFrame } = render(
    <InputPrompt
      currentModel="deepseek-chat"
      initialValue="/model "
      onExit={() => {}}
      onFetchModels={async () => models}
      onSubmit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 50))

  const frame = lastFrame() || ''
  const inputPos = frame.indexOf('ξ >')
  const menuPos = frame.indexOf('可用模型')
  t.true(inputPos !== -1)
  t.true(menuPos !== -1)
  t.true(inputPos < menuPos, '输入对话框应位于菜单浮层之上（菜单位于对话框下方）')
})
