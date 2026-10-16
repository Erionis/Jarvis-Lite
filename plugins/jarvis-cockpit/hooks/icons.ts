// Svg icons 16x16 of the mod, a single family: a sheet or shape with a faint fill and a medium stroke, tones
// that hold up in light and dark. Known file types have a color and a mark on the sheet; the folder
// comes in a closed and an open form.

export type IconName =
  | 'dir' | 'dirOpen' | 'md' | 'pdf' | 'word' | 'excel' | 'ppt' | 'image' | 'code' | 'data' | 'html' | 'link' | 'file'

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>`
const PAGE = 'M3.5 1.5h6l3 3v9.6c0 .2-.2.4-.4.4H3.9c-.2 0-.4-.2-.4-.4z'
const stroke = (d: string, color: string): string =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`
const page = (fill: string, color: string, mark: string): string => svg(`<path d="${PAGE}" fill="${fill}" stroke="${color}"/>${mark}`)

export const ICON: Record<IconName, string> = {
  dir: svg('<path d="M1.5 4.2c0-.8.6-1.4 1.4-1.4h3.2l1.5 1.5h5.5c.8 0 1.4.6 1.4 1.4v6.2c0 .8-.6 1.4-1.4 1.4H2.9c-.8 0-1.4-.6-1.4-1.4z" fill="#9fd6d2"/><path d="M1.5 6h13v5.9c0 .8-.6 1.4-1.4 1.4H2.9c-.8 0-1.4-.6-1.4-1.4z" fill="#13918b"/>'),
  dirOpen: svg('<path d="M1.5 4.2c0-.8.6-1.4 1.4-1.4h3.2l1.5 1.5h5.5c.8 0 1.4.6 1.4 1.4V6H1.5z" fill="#9fd6d2"/><path d="M2.6 6.5h12.2l-1.6 6.2c-.2.5-.6.8-1.1.8H2.4c-.6 0-1-.5-.9-1z" fill="#13918b"/>'),
  md: page('#E6F1FB', '#378ADD', stroke('M5.2 11.5V8l1.4 1.7L8 8v3.5M10.4 8v3.2m-1.1-1.1 1.1 1.1 1.1-1.1', '#185FA5')),
  pdf: page('#FCEBEB', '#E24B4A', '<rect x="4.5" y="8.5" width="7" height="3.5" rx="1" fill="#E24B4A"/>'),
  word: page('#E6F1FB', '#185FA5', stroke('M5.3 7.8l.9 3.7.9-2.6.9 2.6.9-3.7', '#185FA5')),
  excel: page('#EAF3DE', '#3B6D11', stroke('M5 8h6M5 10.5h6M8 7v5', '#3B6D11')),
  ppt: page('#FDEEE6', '#D85A30', `${stroke('M10.3 9.8A2.3 2.3 0 1 1 8 7.5', '#D85A30')}<path d="M8 9.8V7.5a2.3 2.3 0 0 1 2.3 2.3z" fill="#D85A30"/>`),
  image: svg(`<rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="#EAF3DE" stroke="#639922"/><circle cx="5.5" cy="6" r="1.3" fill="#639922"/>${stroke('M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3', '#3B6D11')}`),
  code: page('#F1EFE8', '#5F5E5A', stroke('M6.5 8 5 9.7l1.5 1.7M9.5 8l1.5 1.7-1.5 1.7', '#5F5E5A')),
  data: page('#FAEEDA', '#BA7517', stroke('M6.6 7.6c-.8 0-.8.5-.8 1v.4c0 .4-.3.7-.7.7.4 0 .7.3.7.7v.4c0 .5 0 1 .8 1M9.4 7.6c.8 0 .8.5.8 1v.4c0 .4.3.7.7.7-.4 0-.7.3-.7.7v.4c0 .5 0 1-.8 1', '#BA7517')),
  html: page('#FBEAF0', '#D4537E', stroke('M6.2 8.2 4.8 9.7l1.4 1.5M9.8 8.2l1.4 1.5-1.4 1.5M8.6 7.8l-1.2 3.8', '#D4537E')),
  link: svg('<g fill="none" stroke="#378ADD" stroke-width="1.4" stroke-linecap="round"><path d="M6.8 9.2a2.4 2.4 0 0 0 3.4 0l2-2a2.4 2.4 0 0 0-3.4-3.4l-.6.6"/><path d="M9.2 6.8a2.4 2.4 0 0 0-3.4 0l-2 2a2.4 2.4 0 0 0 3.4 3.4l.6-.6"/></g>'),
  file: page('#F1EFE8', '#888780', stroke('M9.5 1.5v3h3', '#888780')),
}

const BY_EXT: Record<string, IconName> = {}
const add = (icon: IconName, exts: string): void => { for (const x of exts.split(' ')) BY_EXT[x] = icon }
add('md', 'md markdown')
add('pdf', 'pdf')
add('word', 'doc docx odt rtf')
add('excel', 'xls xlsx csv ods numbers')
add('ppt', 'ppt pptx key odp')
add('image', 'png jpg jpeg gif webp svg heic bmp ico')
add('data', 'json jsonl yaml yml toml')
add('html', 'html htm')
add('code', 'ts tsx js jsx mjs cjs py sh zsh go rs java c h cpp rb php css scss sql swift kt lua')

// The icon of a row of the Files tab: a symbolic link always gets the link icon.
export function fileIcon(name: string, kind: 'dir' | 'file', isOpen: boolean, isLink: boolean): IconName {
  if (isLink) return 'link'
  if (kind === 'dir') return isOpen ? 'dirOpen' : 'dir'
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'file'
  return BY_EXT[name.slice(dot + 1).toLowerCase()] ?? 'file'
}
