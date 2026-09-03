import { Box, Text } from 'ink'
import React, { useEffect, useState } from 'react'

export interface SpinnerProps {
  status: string
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function Spinner({ status }: SpinnerProps) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Box marginBottom={1} flexDirection="row">
      <Text color="cyan">{SPINNER_FRAMES[frameIndex]} </Text>
      <Text color="gray">{status}</Text>
    </Box>
  )
}
