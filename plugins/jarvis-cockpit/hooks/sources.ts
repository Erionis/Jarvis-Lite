import type { Sources } from '../types'
import { detectLang } from './i18n'
import type { Strings } from './strings'

// The short name of a source in the activity log, in the language of the catalog; a role without a name
// there (a source the user declared with a name of their own) is shown lowercase.
const ROLE_KEYS: Readonly<Record<string, keyof Strings['roles']>> = {
  Identity: 'identity',
  'Durable memory': 'memory',
  'Future work': 'futureWork',
  'Daily history': 'diary',
  Handoff: 'handoff',
  Inbox: 'inbox',
}
export function roleLabel(role: string, t: Strings): string {
  const key = ROLE_KEYS[role]
  return key === undefined ? role.toLowerCase() : t.roles[key]
}

export const PROTECTED_ROLES: readonly string[] = ['Identity', 'Durable memory', 'Future work', 'Daily history']

// Protected sources that the cockpit writes anyway: the Future work file (check, add, Reading editor). For the Activity
// log they stay protected: only what the cockpit can write changes.
export const EDITABLE_ROLES: readonly string[] = ['Future work']

// The memories folder: the "Durable memory" source if it is a folder, its folder if it is a file
// (`99 - Jarvis/memory/MEMORY.md` → `99 - Jarvis/memory`). null if it is not declared or the file sits in the root.
export function memoryDir(roles: Readonly<Record<string, string>>): string | null {
  const src = roles['Durable memory']
  if (src === undefined) return null
  if (!/\.md$/i.test(src)) return src
  const i = src.lastIndexOf('/')
  return i > 0 ? src.slice(0, i) : null
}

// The Italian table (`## Capacita' Jarvis`) or the one from Jarvis Lite (`## Capabilities`, English roles):
// the Italian roles become the Lite ones, which are the cockpit's keys; the Soul template is only a seed, not
// a source.
const HEADING = /^##\s+(?:Capacit(?:a'|à)\s+Jarvis|Capabilities)\s*$/m
const ROLE_ALIASES: Record<string, string> = {
  "Identita'": 'Identity',
  'Identità': 'Identity',
  'Memoria durevole': 'Durable memory',
  'Futuro operativo': 'Future work',
  Diario: 'Daily history',
  Diary: 'Daily history',
}
const SKIPPED_ROLES = new Set(['Role', 'Ruolo', "Capacita'", 'Soul template'])
const ROW = /^\|\s*([^|]+?)\s*\|\s*`([^`]+)`\s*\|/

export function parseCapabilities(md: string, root: string): Sources {
  const start = md.search(HEADING)
  const isOnboarding = md.includes('<!-- jarvis:onboarding-required -->')
  const flag = isOnboarding ? { isOnboarding } : {}
  const lang = detectLang(md, '')
  if (start < 0) return { root, roles: {}, hasTable: false, lang, ...flag }
  const roles: Record<string, string> = {}
  for (const line of md.slice(start).split('\n').slice(1)) {
    if (/^##\s/.test(line)) break
    const [, role, src] = line.match(ROW) ?? []
    if (role && src && !SKIPPED_ROLES.has(role)) roles[ROLE_ALIASES[role] ?? role] = src.replace(/\/+$/, '')
  }
  return { root, roles, hasTable: Object.keys(roles).length > 0, lang, ...flag }
}

// The user's name as given to Jarvis: first `Nome:` / `Name:` in CLAUDE.md, then the identity
// (soul.md: "I am Jane's AI collaborator", "Sono il collaboratore di Jane", or the frontmatter
// description). The `[NAME]` placeholder of the Jarvis Lite template does not count. Null if there is none.
const NAME_LINE = /^\s*(?:[-*]\s+)?(?:\*\*)?(?:Nome|Name)(?:\*\*)?\s*:\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?\s*$/im
const SOUL_NAME = [
  /\bI am (?:\*\*)?([^*\n'’]{1,40}?)(?:\*\*)?['’]s (?:AI )?collaborator/i,
  /\bcollaboratore (?:AI )?di (?:\*\*)?([^*\n:.,;]{1,40}?)(?:\*\*)?\s*[:.,;]/i,
  /\bcollaborating with (?:\*\*)?([^*\n.]{1,40}?)(?:\*\*)?\s*\./i,
  /\blavora con (?:\*\*)?([^*\n.]{1,40}?)(?:\*\*)?\s*\./i,
]
export function userName(claudeMd: string, soulMd: string): string | null {
  const ok = (s: string | undefined): string | null => {
    const v = (s ?? '').trim()
    return v === '' || v.includes('[') ? null : v
  }
  const line = ok(NAME_LINE.exec(claudeMd)?.[1])
  if (line !== null) return line
  for (const re of SOUL_NAME) {
    const v = ok(re.exec(soulMd)?.[1])
    if (v !== null) return v
  }
  return null
}
