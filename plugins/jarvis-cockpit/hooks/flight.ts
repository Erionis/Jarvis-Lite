import type { ClockPort } from './ports'

// One reload at a time: the run in flight and the one asked for during it (just one, with the work of the last
// request). So a slow reload does not end after a newer one and leave a stale view.
export type Flight = { running: Promise<void> | null; again: { work: () => Promise<void>; run: Promise<void> } | null }

export const flight = (): Flight => ({ running: null, again: null })

// Starts at once if there is no run; otherwise one more run starts when the current one ends, and whoever asks
// waits for that one. Never throws.
export function oneAtATime(f: Flight, work: () => Promise<void>): Promise<void> {
  if (f.again !== null) {
    f.again.work = work
    return f.again.run
  }
  if (f.running === null) return takeOff(f, work)
  const again: { work: () => Promise<void>; run: Promise<void> } = { work, run: f.running.then(() => { f.again = null; return takeOff(f, again.work) }) }
  f.again = again
  return again.run
}

function takeOff(f: Flight, work: () => Promise<void>): Promise<void> {
  const run: Promise<void> = work().catch(() => {}).finally(() => { if (f.running === run) f.running = null })
  f.running = run
  return run
}

// Settling: many requests close together start the work once, SETTLE_MS after the last one and at most
// SETTLE_MAX_MS after the first of the series.
export const SETTLE_MS = 250
export const SETTLE_MAX_MS = 2000

export type Settle = { seq: number; series: number; isOpen: boolean }

export const settle = (): Settle => ({ seq: 0, series: 0, isOpen: false })

// Each request postpones the work by SETTLE_MS; the first of a series also sets the deadline. The first of the
// two to arrive fires, once: then the series is closed and the next request opens another.
export function settleThen(s: Settle, clock: ClockPort, work: () => void): void {
  const seq = ++s.seq
  const fire = (): void => {
    s.isOpen = false
    work()
  }
  if (!s.isOpen) {
    s.isOpen = true
    const series = ++s.series
    clock.after(SETTLE_MAX_MS, () => { if (s.isOpen && s.series === series) fire() })
  }
  clock.after(SETTLE_MS, () => { if (s.isOpen && s.seq === seq) fire() })
}
