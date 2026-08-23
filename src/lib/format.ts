const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'] as const
const WEEKDAYS_FULL = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
] as const

export function cx(...xs: Array<string | false | undefined | null>): string {
  return xs.filter(Boolean).join(' ')
}

export function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

export function atWeek(dayIndex: number, hours: number, minutes: number, weekOffset = 0): string {
  const monday = mondayOf(new Date())
  monday.setDate(monday.getDate() + dayIndex + weekOffset * 7)
  monday.setHours(hours, minutes, 0, 0)
  return monday.toISOString()
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function formatDayShort(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`
}

export function formatDayFull(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAYS_FULL[d.getDay()]}, ${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'long' })}`
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export function relativeLesson(iso: string): string {
  const start = new Date(iso).getTime()
  const diff = start - Date.now()
  if (diff < -60 * 60 * 1000) return 'уже прошло'
  if (diff < 0) return 'идёт сейчас'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `через ${mins} мин`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `через ${hours} ч`
  const days = Math.round(hours / 24)
  if (days === 1) return 'завтра'
  return `через ${days} дн`
}

export function paymentLabel(status: 'paid' | 'due' | 'overdue'): string {
  if (status === 'paid') return 'оплачено'
  if (status === 'due') return 'ждёт оплаты'
  return 'просрочено'
}

/**
 * Идентификатор новой записи. Это всегда uuid: те же объекты уходят в Postgres,
 * где колонки объявлены как uuid и понятный префикс вроде «l-» уже не принимается.
 * Префикс остаётся в подписи ради читаемости вызовов.
 */
export function uid(_prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  // randomUUID есть только в защищённом контексте: по http с телефона его нет.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)

  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function callName(name: string, explicit?: string): string {
  return explicit || name.split(' ')[0] || name
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function toDateInput(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toTimeInput(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fromDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0).toISOString()
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

export function formatSlot(iso: string): string {
  const d = new Date(iso)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('ru-RU', { month: 'short' })}, ${formatTime(iso)}`
}
