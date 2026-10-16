import type { Lang } from '../types'
import type { Strings } from './strings'
import { EN } from './strings.en'
import { IT } from './strings.it'

export type { Strings }

// The first line of the Identity source that names a language decides: Italian gives `it`, any other
// language `en`. Without one (no Identity yet, or the template placeholder), the capability table's
// heading decides: the Italian heading gives `it`, anything else `en`. Never asked to the user.
const LANG_LINE = /^.*\b(?:lingua|language)\b.*$/im
const ITALIAN_HEADING = /^##\s+Capacit(?:a'|à)\s+Jarvis\s*$/m
export function detectLang(claudeMd: string, soulMd: string): Lang {
  const line = LANG_LINE.exec(soulMd)?.[0]
  if (line !== undefined && !line.includes('[LANGUAGE]')) return /itali/i.test(line) ? 'it' : 'en'
  return ITALIAN_HEADING.test(claudeMd) ? 'it' : 'en'
}

export const strings = (lang: Lang): Strings => (lang === 'it' ? IT : EN)
