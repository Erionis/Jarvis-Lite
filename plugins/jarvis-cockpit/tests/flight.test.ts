import { test, expect } from 'claude-code/testing'
import { SETTLE_MAX_MS, SETTLE_MS, flight, oneAtATime, settle, settleThen } from '../hooks/flight'
import { memClock } from './ports'

test('oneAtATime: one run in flight and at most one after it, doing the work of the latest request', async () => {
  const f = flight()
  const ran: string[] = []
  let open = (): void => {}
  const first = oneAtATime(f, () => new Promise<void>(done => { ran.push('a'); open = done }))
  const second = oneAtATime(f, async () => { ran.push('b') })
  const third = oneAtATime(f, async () => { ran.push('c') })
  // The second and the third wait for the same run, which does the work of the third.
  expect(second).toBe(third)
  open()
  await Promise.all([first, second, third])
  expect(ran).toEqual(['a', 'c'])
})

test('oneAtATime: a job that throws does not stop the queue', async () => {
  const f = flight()
  const ran: string[] = []
  await oneAtATime(f, async () => { throw new Error('no') })
  await oneAtATime(f, async () => { ran.push('ok') })
  expect(ran).toEqual(['ok'])
})

test('settleThen: five requests close together, the work starts once, SETTLE_MS after the last one', () => {
  const clock = memClock()
  const s = settle()
  let runs = 0
  for (let i = 0; i < 5; i++) {
    settleThen(s, clock, () => { runs++ })
    clock.advance(100)
  }
  // The last request was 100 ms ago.
  clock.advance(SETTLE_MS - 101)
  expect(runs).toBe(0)
  clock.advance(1)
  expect(runs).toBe(1)
  clock.advance(SETTLE_MAX_MS)
  expect(runs).toBe(1)
})

test('settleThen: continuous requests, the work still starts SETTLE_MAX_MS after the first, then a new series begins', () => {
  const clock = memClock()
  const s = settle()
  const at: number[] = []
  let now = 0
  // One request every 200 ms, from 0 to 4800.
  for (let i = 0; i < 25; i++) {
    settleThen(s, clock, () => { at.push(now) })
    now += 200
    clock.advance(200)
  }
  // At the end of the first series (2000) and of the second, opened by the request at 2000.
  expect(at).toEqual([SETTLE_MAX_MS, 2 * SETTLE_MAX_MS])
  // The third series starts SETTLE_MS after the last request (4800).
  now += SETTLE_MS - 200
  clock.advance(SETTLE_MS - 200)
  expect(at).toEqual([SETTLE_MAX_MS, 2 * SETTLE_MAX_MS, 4800 + SETTLE_MS])
})
