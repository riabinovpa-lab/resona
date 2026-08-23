import type {
  ChatMessage,
  DiaryEntry,
  FeedbackItem,
  Lesson,
  LessonStatus,
  MoveRequest,
  MoveStatus,
  Notice,
  PaymentStatus,
  Place,
  Role,
  Skill,
  Slot,
  Song,
  Student,
} from '../types'

/** В базе имена в snake_case и время в timestamptz, в приложении — camelCase и ISO-строки. */

export type StudentRow = {
  id: string
  name: string
  call_name: string | null
  short: string
  voice: string
  city: string
  since: string
  plan_id: string
  remaining: number
  used: number
  payment: PaymentStatus
  next_goal: string
  range_low: number
  range_high: number
  start_low: number
  start_high: number
  skills: Skill[]
  repertoire: Song[]
  streak: number
  practice_week: number[]
  invite_code: string | null
}

export type LessonRow = {
  id: string
  student_id: string
  starts_at: string
  duration: number
  focus: string
  homework: string
  status: LessonStatus
  location_id: string | null
  homework_done_at: string | null
  series_id: string | null
}

export type PlaceRow = {
  id: string
  name: string
  address: string
  how_to: string
  online: boolean
}

export type SlotRow = {
  id: string
  weekday: number
  from_time: string
  to_time: string
  location_id: string | null
}

export type MoveRow = {
  id: string
  lesson_id: string
  student_id: string
  proposed_at: string
  comment: string
  status: MoveStatus
  created_at: string
  decided_at: string | null
}

export type DiaryRow = {
  id: string
  student_id: string
  stars: number
  comment: string
  created_at: string
}

export type NoticeRow = {
  id: string
  title: string
  body: string
  created_at: string
}

export type MessageRow = {
  id: string
  student_id: string
  from_role: Role
  body: string
  created_at: string
}

export type FeedbackRow = {
  id: string
  student_id: string
  rating: number
  energy: number
  clarity: string
  body: string
  created_at: string
}

export type ProfileRow = {
  id: string
  role: Role
  student_id: string | null
  email: string | null
}

export type SeenRow = {
  profile_id: string
  chat: string
  notices: string
}

export const toStudent = (r: StudentRow): Student => ({
  id: r.id,
  name: r.name,
  callName: r.call_name ?? undefined,
  short: r.short,
  voice: r.voice,
  city: r.city,
  since: r.since,
  planId: r.plan_id,
  remaining: r.remaining,
  used: r.used,
  payment: r.payment,
  nextGoal: r.next_goal,
  rangeLow: r.range_low,
  rangeHigh: r.range_high,
  startLow: r.start_low,
  startHigh: r.start_high,
  skills: r.skills ?? [],
  repertoire: r.repertoire ?? [],
  streak: r.streak,
  practiceWeek: r.practice_week ?? [0, 0, 0, 0, 0, 0, 0],
  inviteCode: r.invite_code,
})

/** Обратное преобразование для upsert: id ставит база, если его нет. */
export const fromStudent = (s: Partial<Student>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  if (s.id !== undefined) out.id = s.id
  if (s.name !== undefined) out.name = s.name
  if (s.callName !== undefined) out.call_name = s.callName
  if (s.short !== undefined) out.short = s.short
  if (s.voice !== undefined) out.voice = s.voice
  if (s.city !== undefined) out.city = s.city
  if (s.since !== undefined) out.since = s.since
  if (s.planId !== undefined) out.plan_id = s.planId
  if (s.remaining !== undefined) out.remaining = s.remaining
  if (s.used !== undefined) out.used = s.used
  if (s.payment !== undefined) out.payment = s.payment
  if (s.nextGoal !== undefined) out.next_goal = s.nextGoal
  if (s.rangeLow !== undefined) out.range_low = s.rangeLow
  if (s.rangeHigh !== undefined) out.range_high = s.rangeHigh
  if (s.startLow !== undefined) out.start_low = s.startLow
  if (s.startHigh !== undefined) out.start_high = s.startHigh
  if (s.skills !== undefined) out.skills = s.skills
  if (s.repertoire !== undefined) out.repertoire = s.repertoire
  if (s.streak !== undefined) out.streak = s.streak
  if (s.practiceWeek !== undefined) out.practice_week = s.practiceWeek
  return out
}

export const toLesson = (r: LessonRow): Lesson => ({
  id: r.id,
  studentId: r.student_id,
  startsAt: r.starts_at,
  duration: r.duration,
  focus: r.focus,
  homework: r.homework,
  status: r.status,
  locationId: r.location_id ?? '',
  homeworkDoneAt: r.homework_done_at,
  seriesId: r.series_id,
})

export const fromLesson = (l: Lesson): Record<string, unknown> => ({
  id: l.id,
  student_id: l.studentId,
  starts_at: l.startsAt,
  duration: l.duration,
  focus: l.focus,
  homework: l.homework,
  status: l.status,
  location_id: l.locationId || null,
  homework_done_at: l.homeworkDoneAt ?? null,
  series_id: l.seriesId ?? null,
})

export const toPlace = (r: PlaceRow): Place => ({
  id: r.id,
  name: r.name,
  address: r.address,
  howTo: r.how_to,
  online: r.online,
})

export const fromPlace = (p: Partial<Place>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  if (p.id !== undefined) out.id = p.id
  if (p.name !== undefined) out.name = p.name
  if (p.address !== undefined) out.address = p.address
  if (p.howTo !== undefined) out.how_to = p.howTo
  if (p.online !== undefined) out.online = p.online
  return out
}

/** Postgres отдаёт time как «17:00:00», интерфейсу нужно «17:00». */
export const toSlot = (r: SlotRow): Slot => ({
  id: r.id,
  weekday: r.weekday,
  from: r.from_time.slice(0, 5),
  to: r.to_time.slice(0, 5),
  locationId: r.location_id ?? '',
})

export const fromSlot = (s: Slot): Record<string, unknown> => ({
  id: s.id,
  weekday: s.weekday,
  from_time: s.from,
  to_time: s.to,
  location_id: s.locationId || null,
})

export const toMove = (r: MoveRow): MoveRequest => ({
  id: r.id,
  lessonId: r.lesson_id,
  studentId: r.student_id,
  proposedAt: r.proposed_at,
  comment: r.comment,
  status: r.status,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
})

export const toDiary = (r: DiaryRow): DiaryEntry => ({
  id: r.id,
  studentId: r.student_id,
  createdAt: r.created_at,
  stars: r.stars,
  comment: r.comment,
})

export const toNotice = (r: NoticeRow): Notice => ({
  id: r.id,
  title: r.title,
  body: r.body,
  createdAt: r.created_at,
})

export const toMessage = (r: MessageRow): ChatMessage => ({
  id: r.id,
  studentId: r.student_id,
  from: r.from_role,
  text: r.body,
  createdAt: r.created_at,
})

export const toFeedback = (r: FeedbackRow): FeedbackItem => ({
  id: r.id,
  studentId: r.student_id,
  createdAt: r.created_at,
  rating: r.rating,
  energy: r.energy,
  clarity: r.clarity,
  text: r.body,
})

export const fromDiary = (d: DiaryEntry): Record<string, unknown> => ({
  id: d.id,
  student_id: d.studentId,
  stars: d.stars,
  comment: d.comment,
  created_at: d.createdAt,
})

export const fromNotice = (n: Notice): Record<string, unknown> => ({
  id: n.id,
  title: n.title,
  body: n.body,
  created_at: n.createdAt,
})

export const fromMessage = (m: ChatMessage): Record<string, unknown> => ({
  id: m.id,
  student_id: m.studentId,
  from_role: m.from,
  body: m.text,
  created_at: m.createdAt,
})

export const fromFeedback = (f: FeedbackItem): Record<string, unknown> => ({
  id: f.id,
  student_id: f.studentId,
  rating: f.rating,
  energy: f.energy,
  clarity: f.clarity,
  body: f.text,
  created_at: f.createdAt,
})
