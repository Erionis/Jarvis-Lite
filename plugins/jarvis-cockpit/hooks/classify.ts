import type { Sources } from '../types'
import type { Strings } from './strings'
import { EDITABLE_ROLES, PROTECTED_ROLES, memoryDir, roleLabel } from './sources'

// Kept out of the cockpit: git's folder, a workspace's shared core folder and repositories cloned into the workspace.
export const EXCLUDED: readonly string[] = ['.git/', '.jarvis-core/', '99 - Jarvis/lab/repos/']

// Jarvis Lite's managed core: protected and read-only, whatever role a source inside it declares.
const CORE = '99 - Jarvis/system/'

export type Classified = { rel: string; role?: string; isProtected: boolean }

// The cockpit can write this file: it is in the vault and not protected, or its role is among the editable
// ones. `c.role` is the label in the catalog's language, so the editable roles are named in the same language.
export function isEditable(c: Classified | null | undefined, t: Strings): boolean {
  if (c === null || c === undefined) return false
  return !c.isProtected || (c.role !== undefined && EDITABLE_ROLES.some(r => roleLabel(r, t) === c.role))
}

export function normalize(path: string): string {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return '/' + out.join('/')
}

export function resolve(base: string, p: string): string {
  return normalize(p.startsWith('/') ? p : `${base}/${p}`)
}

export function classify(abs: string, s: Sources, t: Strings): Classified | null {
  const root = normalize(s.root)
  const path = normalize(abs)
  if (path !== root && !path.startsWith(root + '/')) return null
  const rel = path === root ? '.' : path.slice(root.length + 1)
  if (EXCLUDED.some(x => rel === x.slice(0, -1) || rel.startsWith(x))) return null
  // The profile, for Claude Code and for the other runtimes.
  if (rel === 'CLAUDE.md' || rel === 'AGENTS.md') return { rel, role: t.log.profile, isProtected: true }
  if (rel === CORE.slice(0, -1) || rel.startsWith(CORE)) return { rel, role: t.log.core, isProtected: true }
  for (const [role, src] of Object.entries(s.roles)) {
    if (rel === src || rel.startsWith(src + '/')) {
      return {
        rel,
        role: roleLabel(role, t),
        isProtected: PROTECTED_ROLES.includes(role),
      }
    }
  }
  // The memories next to the index: if Durable memory is a file, the rest of its folder is memory too
  // (protected). A source declared in the same folder (the Identity) keeps its own role.
  const mem = memoryDir(s.roles)
  if (mem !== null && rel.startsWith(mem + '/')) return { rel, role: roleLabel('Durable memory', t), isProtected: true }
  return { rel, isProtected: false }
}
