export type Role = 'teacher' | 'student'

export type Screen =
  | 'home'
  | 'schedule'
  | 'practice'
  | 'progress'
  | 'memberships'
  | 'theory'
  | 'article'
  | 'feedback'
  | 'more'
  | 'student'
  | 'places'
  | 'diary'
  | 'notices'
  | 'chat'
  | 'thread'

export type PaymentStatus = 'paid' | 'due' | 'overdue'
export type LessonStatus = 'upcoming' | 'done' | 'cancelled' | 'missed'

export type Skill = {
  id: string
  label: string
  value: number
}

export type Song = {
  title: string
  artist: string
  status: string
}

export type Student = {
  id: string
  name: string
  /** Как обращаться: в списках имена пишутся «Фамилия Имя», в приветствии это неуместно. */
  callName?: string
  short: string
  voice: string
  city: string
  since: string
  planId: string
  remaining: number
  used: number
  payment: PaymentStatus
  nextGoal: string
  rangeLow: number
  rangeHigh: number
  startLow: number
  startHigh: number
  skills: Skill[]
  repertoire: Song[]
  streak: number
  practiceWeek: number[]
  /** Код первого входа. Есть только на сервере и пропадает, когда ученик им воспользовался. */
  inviteCode?: string | null
}

export type Lesson = {
  id: string
  studentId: string
  startsAt: string
  duration: number
  focus: string
  homework: string
  status: LessonStatus
  locationId: string
  homeworkDoneAt?: string | null
  /** Уроки одной еженедельной серии делят этот идентификатор. */
  seriesId?: string | null
}

/** Рабочее окно педагога: из них вычитаются занятые уроки и получаются свободные слоты. */
export type Slot = {
  id: string
  weekday: number
  from: string
  to: string
  locationId: string
}

export type MoveStatus = 'pending' | 'accepted' | 'declined'

export type MoveRequest = {
  id: string
  lessonId: string
  studentId: string
  proposedAt: string
  comment: string
  status: MoveStatus
  createdAt: string
  decidedAt?: string | null
}

export type Place = {
  id: string
  name: string
  address: string
  howTo: string
  online?: boolean
}

export type DiaryEntry = {
  id: string
  studentId: string
  createdAt: string
  stars: number
  comment: string
}

export type Notice = {
  id: string
  title: string
  body: string
  createdAt: string
}

/** Переписка один на один: ученик и педагог. Общего чата студии нет. */
export type ChatMessage = {
  id: string
  studentId: string
  from: Role
  text: string
  createdAt: string
}

export type Plan = {
  id: string
  title: string
  lessons: number
  price: number
  perLesson: number
  hint: string
  featured?: boolean
}

export type Article = {
  id: string
  title: string
  category: string
  minutes: number
  lead: string
  body: string[]
}

export type Exercise = {
  id: string
  title: string
  minutes: number
  level: string
  description: string
  steps: string[]
  targetMidi: number
}

export type FeedbackItem = {
  id: string
  studentId: string
  createdAt: string
  rating: number
  energy: number
  clarity: string
  text: string
}

export type IconName =
  | 'home'
  | 'calendar'
  | 'mic'
  | 'chart'
  | 'more'
  | 'people'
  | 'chat'
  | 'bell'
  | 'pin'
  | 'book'
  | 'star'
  | 'card'
  | 'back'
  | 'check'

export type Tab = {
  id: Screen
  label: string
  icon: IconName
}

export type Toast = {
  id: string
  text: string
}

export type Seen = {
  chat: string
  notices: string
}
