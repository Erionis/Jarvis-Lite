import { test, expect } from 'claude-code/testing'
import { loadText, safeWrite, type Base } from '../hooks/textfile'
import { MEM_ROOT, memFs } from './ports'

const P = `${MEM_ROOT}/a.md`
const baseOf = async (fs: ReturnType<typeof memFs>['fs']): Promise<Base> => {
  const l = await loadText(fs, P)
  return { text: l.text ?? '', mtimeMs: l.mtimeMs, size: l.size }
}

test('safeWrite: writes only when the modified date and size match the ones read', async () => {
  const m = memFs({ [P]: 'uno\n' })
  const old = await baseOf(m.fs)
  m.touch(P, 'uno\ndue\n')
  expect(await safeWrite(m.fs, P, 'tre\n', old)).toEqual({ kind: 'changed' })
  const cur = await baseOf(m.fs)
  // Same date but different size (another write at the same instant): still changed.
  expect(await safeWrite(m.fs, P, 'tre\n', { ...cur, size: (cur.size ?? 0) + 1 })).toEqual({ kind: 'changed' })
  expect(m.writes).toEqual([])
  expect((await safeWrite(m.fs, P, 'tre\n', cur)).kind).toBe('written')
  expect(m.text.get(P)).toBe('tre\n')
  // Unknown size (a draft from older versions): the date counts.
  expect((await safeWrite(m.fs, P, 'quattro\n', { ...(await baseOf(m.fs)), size: null })).kind).toBe('written')
  // Overwrite: no check.
  expect((await safeWrite(m.fs, P, 'cinque\n', old, true)).kind).toBe('written')
  expect(m.text.get(P)).toBe('cinque\n')
})

test('safeWrite: a text read with U+FFFD (a file that is not UTF-8) is never written back', async () => {
  const m = memFs({ [P]: 'caff\uFFFD\n' })
  expect(await safeWrite(m.fs, P, 'caff\uFFFD!\n', await baseOf(m.fs))).toEqual({ kind: 'not-utf8' })
  expect(await safeWrite(m.fs, P, 'caff\uFFFD!\n', await baseOf(m.fs), true)).toEqual({ kind: 'not-utf8' })
  expect(m.writes).toEqual([])
})

test('safeWrite: a BOM the file had is kept even though reading strips it; without a BOM it stays without', async () => {
  const m = memFs({ [P]: 'uno\n' }, { bom: [P] })
  const base = await baseOf(m.fs)
  expect(base.text).toBe('uno\n')
  expect((await safeWrite(m.fs, P, 'due\n', base)).kind).toBe('written')
  expect(m.writes[0]?.text).toBe('\uFEFFdue\n')
  expect(m.raw(P).startsWith('77u/')).toBe(true)
  const n = memFs({ [P]: 'uno\n' })
  await safeWrite(n.fs, P, 'due\n', await baseOf(n.fs))
  expect(n.writes[0]?.text).toBe('due\n')
})

// The file check sits right before the write: the byte read (BOM) comes before the stat, so a
// write by another chat during the byte read is still seen.
test('safeWrite: bytes are read before the stat, and the last thing before writing is a stat', async () => {
  const m = memFs({ [P]: 'uno\n' })
  const order: string[] = []
  const fs = {
    ...m.fs,
    readBytes: (p: string) => { order.push('readBytes'); return m.fs.readBytes(p) },
    stat: (p: string) => { order.push('stat'); return m.fs.stat(p) },
    write: (p: string, t: string) => { order.push('write'); return m.fs.write(p, t) },
  }
  const base = await baseOf(m.fs)
  expect((await safeWrite(fs, P, 'due\n', base)).kind).toBe('written')
  expect(order).toEqual(['readBytes', 'stat', 'write', 'stat'])
})

test('safeWrite: another chat writing while the bytes are read → changed, nothing written', async () => {
  const m = memFs({ [P]: 'uno\n' })
  const fs = { ...m.fs, readBytes: async (p: string) => { const b = await m.fs.readBytes(p); m.touch(p, 'uno\naltro\n'); return b } }
  expect(await safeWrite(fs, P, 'due\n', await baseOf(m.fs))).toEqual({ kind: 'changed' })
  expect(m.writes).toEqual([])
  expect(m.text.get(P)).toBe('uno\naltro\n')
})
