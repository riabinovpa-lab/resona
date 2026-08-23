import { createContext, useContext } from 'react'
import type { ARTICLES, EXERCISES, PLANS, STUDIO } from './data'
import type { FreeSlot } from './lib/slots'
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
  Screen,
  Seen,
  Slot,
  Student,
  Toast,
} from './types'

export type Store = {
  /** true, когда данные живут на сервере: роль задана аккаунтом, демо-кнопки не нужны. */
  cloud: boolean
  accountEmail: string | null
  signOut: () => void
  role: Role
  setRole: (role: Role) => void
  screen: Screen
  selectedStudentId: string | null
  articleId: string | null
  canGoBack: boolean
  setScreen: (screen: Screen) => void
  openArticle: (id: string) => void
  openStudent: (id: string) => void
  openThread: (studentId: string) => void
  goBack: () => void
  students: Student[]
  lessons: Lesson[]
  places: Place[]
  slots: Slot[]
  moves: MoveRequest[]
  diary: DiaryEntry[]
  notices: Notice[]
  messages: ChatMessage[]
  feedback: FeedbackItem[]
  toasts: Toast[]
  me: Student
  studio: typeof STUDIO
  plans: typeof PLANS
  articles: typeof ARTICLES
  exercises: typeof EXERCISES
  unreadChat: number
  unreadNotices: number
  pendingMoves: number
  seenChatAt: string
  seenNoticesAt: string
  placeOf: (id: string) => Place | undefined
  studentOf: (id: string) => Student | undefined
  planOf: (id: string) => (typeof PLANS)[number] | undefined
  toast: (text: string) => void
  markSeen: (key: keyof Seen) => void
  setPayment: (studentId: string, payment: PaymentStatus) => void
  setLessonStatus: (lessonId: string, status: LessonStatus) => void
  upsertLesson: (lesson: Lesson) => void
  removeLesson: (lessonId: string) => void
  conflictFor: (lesson: Lesson) => Lesson | undefined
  toggleHomework: (lessonId: string) => void
  /** Ставит еженедельную серию и возвращает, сколько уроков реально поместилось. */
  addSeries: (base: Omit<Lesson, 'id'>, weeks: number) => number
  removeSeries: (seriesId: string) => void
  addSlot: (slot: Omit<Slot, 'id'>) => void
  removeSlot: (id: string) => void
  freeSlots: (duration: number, days: number) => FreeSlot[]
  canMove: (lesson: Lesson) => boolean
  moveFor: (lessonId: string) => MoveRequest | undefined
  requestMove: (lessonId: string, proposedAt: string, comment: string) => void
  resolveMove: (id: string, accept: boolean) => void
  addStudent: (input: { name: string; voice: string; city: string; planId: string; nextGoal: string }) => void
  updateStudent: (studentId: string, patch: Partial<Student>) => void
  renewPlan: (studentId: string, planId: string) => void
  addPlace: (place: Omit<Place, 'id'>) => void
  updatePlace: (id: string, patch: Partial<Place>) => void
  removePlace: (id: string) => void
  addDiary: (studentId: string, stars: number, comment: string) => void
  sendNotice: (title: string, body: string) => void
  addMessage: (studentId: string, text: string) => void
  addFeedback: (item: Omit<FeedbackItem, 'id' | 'createdAt' | 'studentId'>) => void
  addPractice: (minutes: number) => void
  resetDemo: () => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore вызван вне StoreProvider')
  return ctx
}
