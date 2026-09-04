import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { ModelMenu } from '../../src/ui/components/ModelMenu.js'

const sampleModels = ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder']

test('ModelMenu renders all models and highlights selected item', (t) => {
  const { lastFrame } = render(
    <ModelMenu currentModel="deepseek-chat" filter="" models={sampleModels} selectedIndex={1} />,
  )
  const frame = lastFrame() || ''

  t.true(frame.includes('deepseek-chat'))
  t.true(frame.includes('deepseek-reasoner'))
  t.true(frame.includes('deepseek-coder'))
  t.true(frame.includes('> deepseek-reasoner') || frame.includes('>  deepseek-reasoner'))
  t.true(frame.includes('(当前)'))
})

test('ModelMenu filters models by keyword', (t) => {
  const { lastFrame } = render(
    <ModelMenu
      currentModel="deepseek-chat"
      filter="reason"
      models={sampleModels}
      selectedIndex={0}
    />,
  )
  const frame = lastFrame() || ''

  t.true(frame.includes('deepseek-reasoner'))
  t.false(frame.includes('deepseek-coder'))
})

test('ModelMenu renders loading message when isLoading is true and models are empty', (t) => {
  const { lastFrame } = render(
    <ModelMenu filter="" isLoading={true} models={[]} selectedIndex={0} />,
  )
  const frame = lastFrame() || ''

  t.true(frame.includes('获取可用模型') || frame.includes('加载'))
})

test('ModelMenu renders empty message when no model matches', (t) => {
  const { lastFrame } = render(
    <ModelMenu filter="not-exist-model" models={sampleModels} selectedIndex={0} />,
  )
  const frame = lastFrame() || ''

  t.true(frame.includes('未找到匹配'))
})

test('ModelMenu renders long model names without wrapping', (t) => {
  const longModel = 'deepseek-v4-flash-vision-exp'
  const { lastFrame } = render(
    <ModelMenu currentModel="deepseek-chat" filter="" models={[longModel]} selectedIndex={0} />,
  )
  const frame = lastFrame() || ''
  t.true(frame.includes('deepseek-v4-flash-vision-exp'))
  t.false(frame.includes('-exp\n'))
})
