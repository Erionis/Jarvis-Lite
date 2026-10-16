import type { Reading } from '../types'
import { errText } from './format'
import type { FsPort } from './ports'
import { MAX_RENDER_CHARS, isNotUtf8 } from './reader'

// Safe reading and writing of a text file: the To Do tab and the Reading editor write only
// from here.

export type Loaded = Pick<Reading, 'text' | 'mtimeMs' | 'size' | 'isTooBig' | 'error'>

// Text to draw, or why there is none. The size in bytes filters before reading:
// a character is at most 4 bytes, so a bigger file cannot fit the limit.
export async function loadText(fs: FsPort, p: string): Promise<Loaded> {
  try {
    const st = await fs.stat(p)
    if (st.size > MAX_RENDER_CHARS * 4) return { text: null, mtimeMs: st.mtimeMs, size: st.size, isTooBig: true, error: null }
    const text = await fs.read(p)
    return text.length > MAX_RENDER_CHARS
      ? { text: null, mtimeMs: st.mtimeMs, size: st.size, isTooBig: true, error: null }
      : { text, mtimeMs: st.mtimeMs, size: st.size, isTooBig: false, error: null }
  } catch (err) {
    return { text: null, mtimeMs: 0, size: null, isTooBig: false, error: errText(err) }
  }
}

// The file as it was read before the edit: text, date and bytes (null: unknown, the date counts).
export type Base = { text: string; mtimeMs: number; size: number | null }
export type Written =
  | { kind: 'written'; mtimeMs: number | null; size: number | null }
  | { kind: 'changed' }
  | { kind: 'not-utf8' }
  | { kind: 'failed'; error: string }

const BOM = '\uFEFF'
// The first three bytes of a file with the UTF-8 BOM (EF BB BF), in base64.
const BOM_BASE64 = '77u/'

// Writes `text` in place of the file read as `base`. It does not write if the read was not UTF-8, or (without `force`,
// i.e. overwrite) if the file no longer has the date and bytes of the read. A BOM the file had stays, whether the
// engine strips it on read or not. No temporary file with `mv`: on a symbolic link it would replace the link, and
// the file's permissions would be lost. The stat comes last, after the bytes are read: as little as possible
// passes between the check and the write.
export async function safeWrite(fs: FsPort, p: string, text: string, base: Base, force = false): Promise<Written> {
  if (isNotUtf8(base.text)) return { kind: 'not-utf8' }
  const hasBom = await fs.readBytes(p).then(b => b.startsWith(BOM_BASE64), () => false)
  if (!force) {
    const st = await fs.stat(p).catch(() => null)
    if (st === null || st.mtimeMs !== base.mtimeMs || (base.size !== null && st.size !== base.size)) return { kind: 'changed' }
  }
  try {
    await fs.write(p, hasBom && !text.startsWith(BOM) ? BOM + text : text)
  } catch (err) {
    return { kind: 'failed', error: errText(err) }
  }
  const after = await fs.stat(p).catch(() => null)
  return { kind: 'written', mtimeMs: after?.mtimeMs ?? null, size: after?.size ?? null }
}
