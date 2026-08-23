import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ChatMessage,
  DiaryEntry,
  FeedbackItem,
  Lesson,
  LessonStatus,
  MoveRequest,
  Notice,
  PaymentStatus,
  Place,
  Role,
  Seen,
  Slot,
  Student,
} from '../types'
import type { Busy } from '../lib/slots'
import {
  fromDiary,
  fromFeedback,
  fromLesson,
  fromMessage,
  fromNotice,
  fromPlace,
  fromSlot,
  fromStudent,
  toDiary,
  toFeedback,
  toLesson,
  toMessage,
  toMove,
  toNotice,
  toPlace,
  toSlot,
  toStudent,
  type DiaryRow,
  type FeedbackRow,
  type LessonRow,
  type MessageRow,
  type MoveRow,
  type NoticeRow,
  type PlaceRow,
  type ProfileRow,
  type SeenRow,
  type SlotRow,
  type StudentRow,
} from './rows'

export type Profile = {
  id: string
  role: Role
  studentId: string | null
  email: string | null
}

export type Snapshot = {
  students: Student[]
  lessons: Lesson[]
  places: Place[]
  slots: Slot[]
  moves: MoveRequest[]
  diary: DiaryEntry[]
  notices: Notice[]
  messages: ChatMessage[]
  feedback: FeedbackItem[]
  seen: Seen
  /** Занятое время всей студии без имён: ученику нужно для выбора переноса. */
  busy: Busy[]
}

/** Любая ошибка запроса обрывает загрузку: половина данных хуже честного сообщения. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return (result.data ?? []) as T
}

export async function loadProfile(db: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await db
    .from('profiles')
    .select('id, role, student_id, email')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as ProfileRow
  return { id: row.id, role: row.role, studentId: row.student_id, email: row.email }
}

/**
 * Один заход за всеми данными. Объём небольшой — студия на десяток учеников, —
 * поэтому проще забрать всё сразу, чем городить загрузку по экранам. Лишнего
 * ученик не увидит: политики доступа отрежут чужие строки на стороне базы.
 */
export async function loadSnapshot(db: SupabaseClient, profileId: string): Promise<Snapshot> {
  const [students, lessons, places, slots, moves, diary, notices, messages, feedback, seen, busy] = await Promise.all([
    db.from('students').select('*').order('name'),
    db.from('lessons').select('*').order('starts_at'),
    db.from('places').select('*').order('name'),
    db.from('slots').select('*').order('weekday').order('from_time'),
    db.from('moves').select('*').order('created_at', { ascending: false }),
    db.from('diary').select('*').order('created_at', { ascending: false }),
    db.from('notices').select('*').order('created_at', { ascending: false }),
    db.from('messages').select('*').order('created_at'),
    db.from('feedback').select('*').order('created_at', { ascending: false }),
    db.from('seen').select('*').eq('profile_id', profileId).maybeSingle(),
    db.from('busy').select('starts_at, duration'),
  ])

  if (seen.error) throw new Error(seen.error.message)
  const seenRow = seen.data as SeenRow | null
  const epoch = new Date(0).toISOString()

  return {
    students: unwrap<StudentRow[]>(students).map(toStudent),
    lessons: unwrap<LessonRow[]>(lessons).map(toLesson),
    places: unwrap<PlaceRow[]>(places).map(toPlace),
    slots: unwrap<SlotRow[]>(slots).map(toSlot),
    moves: unwrap<MoveRow[]>(moves).map(toMove),
    diary: unwrap<DiaryRow[]>(diary).map(toDiary),
    notices: unwrap<NoticeRow[]>(notices).map(toNotice),
    messages: unwrap<MessageRow[]>(messages).map(toMessage),
    feedback: unwrap<FeedbackRow[]>(feedback).map(toFeedback),
    seen: { chat: seenRow?.chat ?? epoch, notices: seenRow?.notices ?? epoch },
    busy: unwrap<Array<{ starts_at: string; duration: number }>>(busy).map((b) => ({
      startsAt: b.starts_at,
      duration: b.duration,
    })),
  }
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

/** Действия педагога идут прямо в таблицы, действия ученика — только через функции базы. */
export function makeApi(db: SupabaseClient) {
  return {
    setPayment: async (studentId: string, payment: PaymentStatus) => {
      fail((await db.from('students').update({ payment }).eq('id', studentId)).error)
    },

    setLessonStatus: async (lessonId: string, status: LessonStatus) => {
      fail((await db.from('lessons').update({ status }).eq('id', lessonId)).error)
    },

    upsertLesson: async (lesson: Lesson) => {
      fail((await db.from('lessons').upsert(fromLesson(lesson))).error)
    },

    insertLessons: async (lessons: Lesson[]) => {
      if (!lessons.length) return
      fail((await db.from('lessons').insert(lessons.map(fromLesson))).error)
    },

    removeLesson: async (lessonId: string) => {
      fail((await db.from('lessons').delete().eq('id', lessonId)).error)
    },

    removeLessons: async (ids: string[]) => {
      if (!ids.length) return
      fail((await db.from('lessons').delete().in('id', ids)).error)
    },

    toggleHomework: async (lessonId: string) => {
      fail((await db.rpc('toggle_homework', { p_lesson: lessonId })).error)
    },

    addSlot: async (slot: Slot) => {
      fail((await db.from('slots').insert(fromSlot(slot))).error)
    },

    removeSlot: async (id: string) => {
      fail((await db.from('slots').delete().eq('id', id)).error)
    },

    requestMove: async (lessonId: string, proposedAt: string, comment: string) => {
      fail((await db.rpc('request_move', { p_lesson: lessonId, p_at: proposedAt, p_comment: comment })).error)
    },

    resolveMove: async (id: string, accept: boolean) => {
      fail((await db.rpc('resolve_move', { p_move: id, p_accept: accept })).error)
    },

    /** Возвращает строку из базы: код-приглашение придумывает она сама. */
    addStudent: async (student: Student): Promise<Student> => {
      const { data, error } = await db.from('students').insert(fromStudent(student)).select().single()
      if (error) throw new Error(error.message)
      return toStudent(data as StudentRow)
    },

    updateStudent: async (studentId: string, patch: Partial<Student>) => {
      const body = fromStudent(patch)
      if (!Object.keys(body).length) return
      fail((await db.from('students').update(body).eq('id', studentId)).error)
    },

    addPlace: async (place: Place) => {
      fail((await db.from('places').insert(fromPlace(place))).error)
    },

    updatePlace: async (id: string, patch: Partial<Place>) => {
      const body = fromPlace(patch)
      if (!Object.keys(body).length) return
      fail((await db.from('places').update(body).eq('id', id)).error)
    },

    removePlace: async (id: string) => {
      fail((await db.from('places').delete().eq('id', id)).error)
    },

    addDiary: async (entry: DiaryEntry) => {
      fail((await db.from('diary').insert(fromDiary(entry))).error)
    },

    sendNotice: async (notice: Notice) => {
      fail((await db.from('notices').insert(fromNotice(notice))).error)
    },

    addMessage: async (message: ChatMessage) => {
      fail((await db.from('messages').insert(fromMessage(message))).error)
    },

    addFeedback: async (item: FeedbackItem) => {
      fail((await db.from('feedback').insert(fromFeedback(item))).error)
    },

    logPractice: async (minutes: number) => {
      fail((await db.rpc('log_practice', { p_minutes: minutes })).error)
    },

    markSeen: async (key: keyof Seen) => {
      fail((await db.rpc('mark_seen', { p_key: key })).error)
    },

    claimInvite: async (code: string): Promise<string> => {
      const { data, error } = await db.rpc('claim_invite', { p_code: code })
      if (error) throw new Error(error.message)
      return data as string
    },
  }
}

export type Api = ReturnType<typeof makeApi>
