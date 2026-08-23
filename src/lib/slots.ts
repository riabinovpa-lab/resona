import type { Lesson, Slot } from '../types'

/** Позже этого срока перенос уже не автоматический: занятие списывается. */
export const MOVE_DEADLINE_HOURS = 12

export const WEEKDAY_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

export type FreeSlot = { startsAt: string; locationId: string }

/**
 * Занятое время без имён. Ученик не видит чужих уроков, но обязан видеть, что
 * это время уже занято, — иначе он предложит перенос на занятый час.
 */
export type Busy = { startsAt: string; duration: number }

export const activeBusy = (lessons: Lesson[]): Busy[] => lessons.filter((l) => l.status !== 'cancelled')

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function hoursUntil(iso: string, now = Date.now()): number {
  return (new Date(iso).getTime() - now) / 3600000
}

function ranges(items: Busy[]): Array<readonly [number, number]> {
  return items.map((b) => {
    const start = new Date(b.startsAt).getTime()
    return [start, start + b.duration * 60000] as const
  })
}

export function overlaps(startsAt: string, duration: number, lessons: Lesson[], skipId?: string): boolean {
  const start = new Date(startsAt).getTime()
  const end = start + duration * 60000
  return ranges(activeBusy(lessons.filter((l) => l.id !== skipId))).some(([s, e]) => start < e && s < end)
}

/** Сетка педагога минус занятое время: что реально можно предложить ученику. */
export function freeSlots(
  slots: Slot[],
  taken: Busy[],
  duration: number,
  days: number,
  from = new Date(),
  step = 30,
): FreeSlot[] {
  const busy = ranges(taken)
  const out: FreeSlot[] = []

  for (let i = 0; i < days; i++) {
    const day = new Date(from)
    day.setDate(day.getDate() + i)
    const weekday = day.getDay() === 0 ? 7 : day.getDay()

    for (const slot of slots.filter((s) => s.weekday === weekday)) {
      const open = toMinutes(slot.from)
      const close = toMinutes(slot.to)
      for (let m = open; m + duration <= close; m += step) {
        const at = new Date(day)
        at.setHours(0, m, 0, 0)
        const start = at.getTime()
        if (start < from.getTime()) continue
        const end = start + duration * 60000
        if (busy.some(([s, e]) => start < e && s < end)) continue
        out.push({ startsAt: at.toISOString(), locationId: slot.locationId })
      }
    }
  }

  return out.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
}
