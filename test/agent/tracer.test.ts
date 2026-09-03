import test from 'ava'

import { Tracer } from '../../src/agent/Tracer.js'

test('Tracer can record and retrieve events in memory', (t) => {
  const tracer = new Tracer({ verbose: false })

  tracer.record({
    type: 'turn_start',
    sessionId: 'session-1',
    turnIndex: 1,
    timestamp: Date.now(),
    data: { messageCount: 2 },
  })

  tracer.record({
    type: 'tool_call',
    sessionId: 'session-1',
    turnIndex: 1,
    timestamp: Date.now(),
    data: { toolName: 'calculator', args: { expression: '1 + 1' } },
  })

  const events = tracer.getEvents()
  t.is(events.length, 2)
  t.is(events[0]?.type, 'turn_start')
  t.is(events[1]?.type, 'tool_call')
})

test('Tracer can filter events by session or type', (t) => {
  const tracer = new Tracer({ verbose: false })

  tracer.record({
    type: 'turn_start',
    sessionId: 'session-1',
    turnIndex: 1,
    timestamp: Date.now(),
  })
  tracer.record({
    type: 'turn_start',
    sessionId: 'session-2',
    turnIndex: 1,
    timestamp: Date.now(),
  })
  tracer.record({
    type: 'error',
    sessionId: 'session-1',
    turnIndex: 1,
    timestamp: Date.now(),
    data: { message: 'something went wrong' },
  })

  t.is(tracer.getEventsBySession('session-1').length, 2)
  t.is(tracer.getEventsBySession('session-2').length, 1)
  t.is(tracer.getEventsByType('error').length, 1)
})

test('Tracer can clear recorded events', (t) => {
  const tracer = new Tracer({ verbose: false })
  tracer.record({
    type: 'turn_start',
    sessionId: 'session-1',
    turnIndex: 1,
    timestamp: Date.now(),
  })
  t.is(tracer.getEvents().length, 1)
  tracer.clear()
  t.is(tracer.getEvents().length, 0)
})
