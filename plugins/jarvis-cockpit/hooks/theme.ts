import type { Color } from 'claude-code'
import type { Verb } from '../types'

// Palette: teal = Jarvis (the heart and the A and I of the logo), everything else the theme's grey,
// red and yellow only to signal. Text, greys and states are theme keys (they follow light and dark);
// teal has no theme key: for Text it is a single tint that reads on both themes,
// inside the Svg the logo's pair with the media query (TEAL_STYLE of mascot.ts).
export const TEXT: Color = 'text'
export const DIM: Color = 'inactive'
export const FADED: Color = 'subtle'
// Teal: Jarvis (tabs, Markdown headings in the editor, files written by Jarvis). Contrast about
// 3.9:1 on both white and the dark background (the logo's #007373 does not read on the dark background).
export const ACCENT: Color = '#13918b'
// Files written by Jarvis: the same teal (older versions used orange, then terracotta).
export const ORANGE: Color = ACCENT
// Selection, hover and active switches: neutral grey with transparency (the tabs have no background).
export const HOVER_BG: Color = '#8080801a'
export const SELECTED_BG: Color = '#8080802e'
// The lit switch of the Files bar.
export const SEG_ACTIVE: Color = '#80808033'
// Pills and counters: neutral grey with transparency.
export const PILL_BG: Color = '#8080801f'


// Age dot: green up to 3 days, yellow up to 10, red beyond; grey if unknown.
export function ageColor(days: number | null): Color {
  if (days === null) return DIM
  return days <= 3 ? 'success' : days <= 10 ? 'warning' : 'error'
}

export const GLYPH: Record<Verb, string> = {
  read: '◦', search: '⌕', edit: '✎', create: '+', move: '→', delete: '✕', shell: '$',
}

export const WRITES: ReadonlySet<Verb> = new Set<Verb>(['edit', 'create', 'move', 'delete'])
