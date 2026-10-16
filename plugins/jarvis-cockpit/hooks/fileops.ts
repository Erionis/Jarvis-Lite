// The pure parts of trash, move and duplicate in the Files tab: where a moved file goes and what its copy is
// called. The real operations (trash, mv, cp) are done by register.tsx with $.process.
import type { Strings } from './strings'

export type Target = { rel: string } | { error: string }

// The text typed in the Move field becomes a path relative to the vault. With a trailing `/` it is a folder
// and the file keeps its name; absolute paths, `~`, `.` and `..` stay out.
export function moveTarget(input: string, from: string, t: Strings): Target {
  const outside = t.toasts.onlyInVault
  let text = input.trim()
  if (text.startsWith('./')) text = text.slice(2)
  if (text === '') return { error: t.toasts.moveWhere }
  if (text.startsWith('/') || text.startsWith('~')) return { error: outside }
  const isDir = text.endsWith('/')
  const parts = text.split('/').filter(p => p !== '')
  if (parts.some(p => p === '.' || p === '..')) return { error: outside }
  if (isDir) parts.push(from.slice(from.lastIndexOf('/') + 1))
  const rel = parts.join('/')
  return rel === from ? { error: t.toasts.alreadyThere } : { rel }
}

// `name copy.ext` in the same folder, then `name copy 2.ext` and on until the name is free (the suffix comes
// from the catalog). `siblings` are the names already in that folder. A hidden file or one with no extension
// gets the suffix at the end.
export function copyName(rel: string, siblings: ReadonlySet<string>, t: Strings): string {
  const slash = rel.lastIndexOf('/')
  const dir = slash < 0 ? '' : rel.slice(0, slash + 1)
  const name = rel.slice(slash + 1)
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let n = 1; ; n++) {
    const candidate = `${stem}${t.files.copySuffix(n)}${ext}`
    if (!siblings.has(candidate)) return `${dir}${candidate}`
  }
}
