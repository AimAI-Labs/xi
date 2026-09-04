import test from 'ava'
import { render } from 'ink-testing-library'
import React from 'react'

import { ApiKeySetup } from '../../src/ui/components/ApiKeySetup.js'

async function waitForCondition(check: () => boolean, timeoutMs = 1000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (check()) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return check()
}

test('ApiKeySetup renders banner and prompt', (t) => {
  const { lastFrame } = render(<ApiKeySetup onSave={() => {}} onExit={() => {}} />)
  const frame = lastFrame() || ''

  t.true(frame.includes('DeepSeek'))
  t.true(frame.includes('API Key'))
  t.true(frame.includes('~/.xi/xi.toml'))
})

test('ApiKeySetup triggers onExit when submitted empty', async (t) => {
  let exited = false
  const { stdin } = render(
    <ApiKeySetup
      onSave={() => {}}
      onExit={() => {
        exited = true
      }}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('\r\n')

  const matched = await waitForCondition(() => exited)
  t.true(matched)
})

test('ApiKeySetup triggers onSave when non-empty key is provided', async (t) => {
  let savedKey = ''
  const { stdin } = render(
    <ApiKeySetup
      onSave={(key) => {
        savedKey = key
      }}
      onExit={() => {}}
    />,
  )

  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.write('sk-my-deepseek-key\r\n')

  const matched = await waitForCondition(() => savedKey === 'sk-my-deepseek-key')
  t.true(matched)
})
