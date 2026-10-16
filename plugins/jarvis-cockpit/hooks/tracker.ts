import type { Activity, Sources, Verb } from '../types'
import { classify, resolve } from './classify'
import { commandLabel, parseShell } from './shell'
import type { Strings } from './strings'

export type ToolEvent = { tool: string; agentId?: string } & Record<string, unknown>
// `t`: the catalog of the cockpit's language, for the role names written into each activity.
export type TrackCtx = { sources: Sources; t: Strings; cwd: string; turn: number; at: number; existed?: boolean; agent?: string }

// In a command's text, the paths inside the vault become relative: `<root>/99 - Jarvis` → `99 - Jarvis`,
// the vault alone → `.`. Only at a path boundary (`/v` does not touch `/var`).
const reEsc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export function relCommand(command: string, root: string): string {
  if (root === '' || root === '/') return command
  const r = reEsc(root.replace(/\/+$/, ''))
  return command.replace(new RegExp(`${r}/`, 'g'), '').replace(new RegExp(`${r}(?=$|["'\\s;|&)])`, 'g'), '.')
}

const str = (e: ToolEvent, k: string): string | undefined => (typeof e[k] === 'string' ? (e[k] as string) : undefined)

export function toActivities(e: ToolEvent, ctx: TrackCtx): Activity[] {
  const out: Activity[] = []
  const add = (verb: Verb, abs: string, detail?: string, isApprox = false): void => {
    const c = classify(abs, ctx.sources, ctx.t)
    if (!c) return
    const a: Activity = { at: ctx.at, turn: ctx.turn, count: 1, isApprox, verb, path: c.rel, isProtected: c.isProtected }
    if (c.role !== undefined) a.role = c.role
    if (detail !== undefined) a.detail = detail
    // For a move the role comes from the destination; the source (in detail, as written) is classified separately.
    if (verb === 'move' && detail !== undefined) {
      const src = classify(resolve(ctx.cwd, detail), ctx.sources, ctx.t)
      if (src) a.from = src.rel
      if (src?.role !== undefined) a.fromRole = src.role
    }
    if (ctx.agent !== undefined) a.agent = ctx.agent
    out.push(a)
  }
  const file = (k: string): string | undefined => { const v = str(e, k); return v === undefined ? undefined : resolve(ctx.cwd, v) }

  switch (e.tool) {
    case 'Read': { const p = file('file_path'); if (p) add('read', p); break }
    case 'Edit':
    case 'MultiEdit': { const p = file('file_path'); if (p) add('edit', p); break }
    case 'NotebookEdit': { const p = file('notebook_path'); if (p) add('edit', p); break }
    case 'Write': { const p = file('file_path'); if (p) add(ctx.existed ? 'edit' : 'create', p); break }
    case 'Grep':
    case 'Glob': add('search', file('path') ?? ctx.cwd, str(e, 'pattern')); break
    case 'Bash': {
      const command = str(e, 'command')
      if (command === undefined) break
      const r = parseShell(command, ctx.cwd)
      for (const t of r.touches) add(t.verb, t.path, t.detail, true)
      if (r.isUnparsed && out.length === 0) {
        // The program launched; without a recognizable name, the first line, with the vault paths made relative.
        const label = commandLabel(command)
        add('shell', ctx.cwd, label !== '' ? label : relCommand(command.split('\n')[0] ?? '', ctx.sources.root).slice(0, 60), true)
      }
      break
    }
  }
  return out
}
