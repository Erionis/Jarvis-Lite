import { test, expect } from 'claude-code/testing'
import { dayLabel, dayMs, longDay, relDay, shortDay, span, weekday } from '../hooks/format'
import { strings } from '../hooks/i18n'

const IT = strings('it').dates
const EN = strings('en').dates

test('span: seconds, minutes with seconds, hours with minutes', () => {
  expect(span(45_000)).toBe('45s')
  expect(span(-5)).toBe('0s')
  expect(span(190_000)).toBe('3m10')
  expect(span(62_000)).toBe('1m02')
  expect(span((4 * 60 + 48) * 60_000 + 30_000)).toBe('4h48')
})

test('relDay in Italian: today, yesterday, the weekday within six days, then the short date', () => {
  const now = new Date(2026, 9, 15, 10).getTime()
  expect(relDay(new Date(2026, 9, 15, 8).getTime(), now, IT)).toBe('oggi')
  expect(relDay(new Date(2026, 9, 14, 23).getTime(), now, IT)).toBe('ieri')
  expect(relDay(new Date(2026, 9, 12, 9).getTime(), now, IT)).toBe('lun 12')
  expect(relDay(new Date(2026, 9, 9, 9).getTime(), now, IT)).toBe('ven 9')
  expect(relDay(new Date(2026, 9, 8, 9).getTime(), now, IT)).toBe('8 ott')
})

test('relDay in English: today, yesterday, the weekday within six days, then the short date', () => {
  const now = new Date(2026, 9, 15, 10).getTime()
  expect(relDay(new Date(2026, 9, 15, 8).getTime(), now, EN)).toBe('today')
  expect(relDay(new Date(2026, 9, 14, 23).getTime(), now, EN)).toBe('yesterday')
  expect(relDay(new Date(2026, 9, 12, 9).getTime(), now, EN)).toBe('Mon 12')
  expect(relDay(new Date(2026, 9, 9, 9).getTime(), now, EN)).toBe('Fri 9')
  expect(relDay(new Date(2026, 9, 8, 9).getTime(), now, EN)).toBe('8 Oct')
})

test('day labels: dayLabel, longDay, shortDay and weekday take the words of the language they are given', () => {
  const sun = new Date(2026, 9, 11, 8).getTime()
  const dec = new Date(2026, 11, 1, 8).getTime()
  expect(dayLabel(sun, IT)).toBe('dom 11 ott')
  expect(dayLabel(sun, EN)).toBe('Sun 11 Oct')
  expect(longDay(sun, IT)).toBe('Domenica 11 ottobre')
  expect(longDay(sun, EN)).toBe('Sunday 11 October')
  expect(longDay(dec, IT)).toBe('Martedì 1 dicembre')
  expect(longDay(dec, EN)).toBe('Tuesday 1 December')
  expect(shortDay('2026-12-01', IT)).toBe('1 dic')
  expect(shortDay('2026-12-01', EN)).toBe('1 Dec')
  expect(weekday('2026-10-09', IT)).toBe('ven')
  expect(weekday('2026-10-09', EN)).toBe('Fri')
})

test('dayMs: the local midnight of an ISO day', () => {
  expect(dayMs('2026-10-15')).toBe(new Date(2026, 9, 15).getTime())
})
