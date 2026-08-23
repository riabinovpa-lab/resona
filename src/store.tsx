import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StoreContext, type Store } from './store-context'
import {
  ARTICLES,
  buildLessons,
  DIARY_SEED,
  EXERCISES,
  FEEDBACK_SEED,
  ME_STUDENT_ID,
  MESSAGES_SEED,
  MOVES_SEED,
  NOTICES_SEED,
  PLACES,
  PLANS,
  SLOTS,
  STUDENTS,
  STUDIO,
} from './data'
import { formatSlot, initials, uid } from './lib/format'
import {
  activeBusy,
  freeSlots as computeFreeSlots,
  hoursUntil,
  MOVE_DEADLINE_HOURS,
  overlaps,
  type Busy,
} from './lib/slots'
import { toast as notify } from 'sonner'
import { errorText, isCloud, supabase } from './lib/supabase'
import { loadProfile, loadSnapshot, makeApi, type Profile } from './cloud/api'
import { subscribe } from './cloud/live'
import { ClaimInvite, Fatal, Loading, SignIn } from './screens/Auth'
import type {
  ChatMessage,
  DiaryEntry,
  FeedbackItem,
  Lesson,
  LessonStatus,
  MoveRequest,
  Notice,
  Place,
  Role,
  Screen,
  Seen,
  Slot,
  Student,
  Toast,
} from './types'

const STORAGE = 'resona-studio-v6'
const VERSION = 6

type Persist = {
  version: number
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
}

const EPOCH = new Date(0).toISOString()

/** Загруженное состояние. busy приходит только с сервера, локально он выводится из уроков. */
type Boot = Omit<Persist, 'version'> & { busy?: Busy[] }

function seeds(): Omit<Persist, 'version'> {
  return {
    students: STUDENTS,
    lessons: buildLessons(),
    places: PLACES,
    slots: SLOTS,
    moves: MOVES_SEED,
    diary: DIARY_SEED,
    notices: NOTICES_SEED,
    messages: MESSAGES_SEED,
    feedback: FEEDBACK_SEED,
    seen: { chat: EPOCH, notices: EPOCH },
  }
}

/** На сервере данные придут после входа: до этого показывать демо-учеников нельзя. */
function blank(): Omit<Persist, 'version'> {
  return {
    students: [],
    lessons: [],
    places: [],
    slots: [],
    moves: [],
    diary: [],
    notices: [],
    messages: [],
    feedback: [],
    seen: { chat: EPOCH, notices: EPOCH },
  }
}

function load(): Omit<Persist, 'version'> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Persist
    if (parsed.version !== VERSION || !Array.isArray(parsed.lessons)) return null
    return parsed
  } catch {
    return null
  }
}

/** Пропущенный и состоявшийся урок одинаково списываются с абонемента. */
function burns(status: LessonStatus): boolean {
  return status === 'done' || status === 'missed'
}

/**
 * Педагог заходит без карточки ученика, и у новой студии учеников ещё нет.
 * Пустышка избавляет экраны от проверки на null в каждом обращении к me.
 */
const NOBODY: Student = {
  id: 'nobody',
  name: '—',
  short: '—',
  voice: '',
  city: '',
  since: '',
  planId: PLANS[0]?.id ?? 'p8',
  remaining: 0,
  used: 0,
  payment: 'due',
  nextGoal: '',
  rangeLow: 55,
  rangeHigh: 72,
  startLow: 55,
  startHigh: 72,
  skills: [],
  repertoire: [],
  streak: 0,
  practiceWeek: [0, 0, 0, 0, 0, 0, 0],
}

type Nav = {
  screen: Screen
  studentId?: string | null
  articleId?: string | null
  depth: number
}

type Phase = 'boot' | 'anon' | 'invite' | 'ready' | 'fail'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot] = useState(() => (isCloud ? blank() : (load() ?? seeds())))
  const [demoRole, setDemoRole] = useState<Role>('student')
  const [nav, setNav] = useState<Nav>({ screen: 'home', depth: 0 })
  const [students, setStudents] = useState<Student[]>(boot.students)
  const [lessons, setLessons] = useState<Lesson[]>(boot.lessons)
  const [places, setPlaces] = useState<Place[]>(boot.places)
  const [slots, setSlots] = useState<Slot[]>(boot.slots)
  const [moves, setMoves] = useState<MoveRequest[]>(boot.moves)
  const [diary, setDiary] = useState<DiaryEntry[]>(boot.diary)
  const [notices, setNotices] = useState<Notice[]>(boot.notices)
  const [messages, setMessages] = useState<ChatMessage[]>(boot.messages)
  const [feedback, setFeedback] = useState<FeedbackItem[]>(boot.feedback)
  const [seen, setSeen] = useState<Seen>(boot.seen)
  const [busy, setBusy] = useState<Busy[]>([])
  const [toasts] = useState<Toast[]>([])

  const [phase, setPhase] = useState<Phase>(isCloud ? 'boot' : 'ready')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [fatal, setFatal] = useState('')

  const api = useMemo(() => (supabase ? makeApi(supabase) : null), [])

  const toast = useCallback((text: string) => {
    notify(text)
  }, [])

  const apply = useCallback((snap: Boot) => {
    setBusy(snap.busy ?? activeBusy(snap.lessons))
    setStudents(snap.students)
    setLessons(snap.lessons)
    setPlaces(snap.places)
    setSlots(snap.slots)
    setMoves(snap.moves)
    setDiary(snap.diary)
    setNotices(snap.notices)
    setMessages(snap.messages)
    setFeedback(snap.feedback)
    setSeen(snap.seen)
  }, [])

  // Демо-режим держит всё в браузере; на сервере кэшировать нечего и незачем.
  useEffect(() => {
    if (isCloud) return
    const next: Persist = {
      version: VERSION,
      students,
      lessons,
      places,
      slots,
      moves,
      diary,
      notices,
      messages,
      feedback,
      seen,
    }
    localStorage.setItem(STORAGE, JSON.stringify(next))
  }, [students, lessons, places, slots, moves, diary, notices, messages, feedback, seen])

  useEffect(() => {
    if (!supabase) return
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUserId(data.session?.user.id ?? null)
        setUserEmail(data.session?.user.email ?? null)
        if (!data.session) setPhase('anon')
      })
      // Без этого любая осечка при проверке сессии оставляла экран в «Загружаем
      // студию» навсегда: показать вход честнее, оттуда есть куда двигаться.
      .catch(() => setPhase('anon'))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setUserEmail(session?.user.email ?? null)
      if (!session) {
        setProfile(null)
        apply(blank())
        setPhase('anon')
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [apply])

  const pull = useCallback(async () => {
    if (!supabase || !userId) return
    try {
      // Профиль создаёт триггер базы, и сразу после регистрации он может опоздать.
      let found = await loadProfile(supabase, userId)
      for (let attempt = 0; !found && attempt < 4; attempt++) {
        await new Promise((r) => setTimeout(r, 400))
        found = await loadProfile(supabase, userId)
      }
      if (!found) throw new Error('Профиль не завёлся. Попробуйте войти заново.')

      setProfile(found)
      if (found.role === 'student' && !found.studentId) {
        setPhase('invite')
        return
      }

      apply(await loadSnapshot(supabase, found.id))
      setPhase('ready')
    } catch (e) {
      setFatal(errorText(e))
      setPhase('fail')
    }
  }, [userId, apply])

  useEffect(() => {
    if (!isCloud || !userId) return
    // Загрузка с сервера — ровно тот случай, для которого эффект и нужен.
    // oxlint-disable-next-line react/set-state-in-effect
    void pull()
  }, [userId, pull])

  useEffect(() => {
    if (!supabase || phase !== 'ready') return
    return subscribe(supabase, () => void pull())
  }, [phase, pull])

  /** Записи на сервер идут вдогонку локальным: при отказе честно говорим и перечитываем. */
  const run = useCallback(
    (task: Promise<unknown> | undefined) => {
      if (!task) return
      task.catch((e: unknown) => {
        toast(errorText(e))
        void pull()
      })
    },
    [toast, pull],
  )

  const role: Role = isCloud ? (profile?.role ?? 'student') : demoRole

  const me =
    (isCloud
      ? students.find((s) => s.id === profile?.studentId)
      : (students.find((s) => s.id === ME_STUDENT_ID) ?? students[0])) ?? NOBODY

  const unreadChat = messages.filter((m) => {
    if (new Date(m.createdAt) <= new Date(seen.chat)) return false
    return role === 'teacher' ? m.from === 'student' : m.studentId === me.id && m.from === 'teacher'
  }).length
  const unreadNotices =
    role === 'teacher' ? 0 : notices.filter((n) => new Date(n.createdAt) > new Date(seen.notices)).length

  const pendingMoves = moves.filter((m) => m.status === 'pending').length

  /** Держит счётчик абонемента в согласии со статусами уроков. */
  const applyLessonDelta = useCallback((studentId: string, delta: number) => {
    if (!delta) return
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s
        return {
          ...s,
          used: Math.max(0, s.used + delta),
          remaining: Math.max(0, s.remaining - delta),
        }
      }),
    )
  }, [])

  useEffect(() => {
    history.replaceState({ resona: { screen: 'home', depth: 0 } satisfies Nav }, '')
    const onPop = (e: PopStateEvent) => {
      const state = (e.state as { resona?: Nav } | null)?.resona
      setNav(state ?? { screen: 'home', depth: 0 })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const value = useMemo<Store>(() => {
    // pushState нельзя вызывать внутри апдейтера setState: StrictMode вызовет его дважды.
    const go = (patch: Omit<Nav, 'depth'>) => {
      const next: Nav = { ...patch, depth: nav.depth + 1 }
      history.pushState({ resona: next }, '')
      setNav(next)
    }

    return {
      cloud: isCloud,
      accountEmail: userEmail,
      signOut: () => void supabase?.auth.signOut(),
      role,
      setRole: (next) => {
        if (isCloud) {
          toast('Роль задана аккаунтом')
          return
        }
        if (next === role) return
        setDemoRole(next)
        const home: Nav = { screen: 'home', depth: 0 }
        history.pushState({ resona: home }, '')
        setNav(home)
      },
      screen: nav.screen,
      selectedStudentId: nav.studentId ?? null,
      articleId: nav.articleId ?? null,
      canGoBack: nav.depth > 0,
      setScreen: (screen) => go({ screen }),
      openArticle: (id) => go({ screen: 'article', articleId: id }),
      openStudent: (id) => go({ screen: 'student', studentId: id }),
      openThread: (id) => go({ screen: 'thread', studentId: id }),
      goBack: () => {
        if (nav.depth > 0) history.back()
        else go({ screen: 'home' })
      },
      students,
      lessons,
      places,
      slots,
      moves,
      diary,
      notices,
      messages,
      feedback,
      toasts,
      me,
      studio: STUDIO,
      plans: PLANS,
      articles: ARTICLES,
      exercises: EXERCISES,
      unreadChat,
      unreadNotices,
      pendingMoves,
      seenChatAt: seen.chat,
      seenNoticesAt: seen.notices,
      placeOf: (id) => places.find((p) => p.id === id),
      studentOf: (id) => students.find((s) => s.id === id),
      planOf: (id) => PLANS.find((p) => p.id === id),
      toast,
      markSeen: (key) => {
        setSeen((prev) => ({ ...prev, [key]: new Date().toISOString() }))
        run(api?.markSeen(key))
      },
      setPayment: (studentId, payment) => {
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, payment } : s)))
        run(api?.setPayment(studentId, payment))
      },
      setLessonStatus: (lessonId, status) => {
        const lesson = lessons.find((l) => l.id === lessonId)
        if (!lesson || lesson.status === status) return
        setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, status } : l)))
        applyLessonDelta(lesson.studentId, (burns(status) ? 1 : 0) - (burns(lesson.status) ? 1 : 0))
        run(api?.setLessonStatus(lessonId, status))
      },
      upsertLesson: (lesson) => {
        const before = lessons.find((l) => l.id === lesson.id)
        setLessons((prev) => {
          const i = prev.findIndex((l) => l.id === lesson.id)
          if (i < 0) return [...prev, lesson]
          const next = [...prev]
          next[i] = lesson
          return next
        })
        if (before && before.studentId === lesson.studentId) {
          applyLessonDelta(lesson.studentId, (burns(lesson.status) ? 1 : 0) - (burns(before.status) ? 1 : 0))
        } else if (before) {
          if (burns(before.status)) applyLessonDelta(before.studentId, -1)
          if (burns(lesson.status)) applyLessonDelta(lesson.studentId, 1)
        } else if (burns(lesson.status)) {
          applyLessonDelta(lesson.studentId, 1)
        }
        run(api?.upsertLesson(lesson))
      },
      removeLesson: (lessonId) => {
        const lesson = lessons.find((l) => l.id === lessonId)
        setLessons((prev) => prev.filter((l) => l.id !== lessonId))
        if (lesson && burns(lesson.status)) applyLessonDelta(lesson.studentId, -1)
        run(api?.removeLesson(lessonId))
      },
      conflictFor: (lesson) => {
        const start = new Date(lesson.startsAt).getTime()
        const end = start + lesson.duration * 60000
        return lessons.find((l) => {
          if (l.id === lesson.id || l.status === 'cancelled') return false
          const s = new Date(l.startsAt).getTime()
          return start < s + l.duration * 60000 && s < end
        })
      },
      toggleHomework: (lessonId) => {
        setLessons((prev) =>
          prev.map((l) =>
            l.id === lessonId ? { ...l, homeworkDoneAt: l.homeworkDoneAt ? null : new Date().toISOString() } : l,
          ),
        )
        run(api?.toggleHomework(lessonId))
      },
      addSeries: (base, weeks) => {
        const seriesId = uid('series')
        const created: Lesson[] = []
        const taken = [...lessons]
        for (let i = 0; i < weeks; i++) {
          const at = new Date(base.startsAt)
          at.setDate(at.getDate() + i * 7)
          const startsAt = at.toISOString()
          if (overlaps(startsAt, base.duration, taken)) continue
          const lesson: Lesson = { ...base, id: uid('l'), startsAt, seriesId }
          created.push(lesson)
          taken.push(lesson)
        }
        if (created.length) {
          setLessons((prev) => [...prev, ...created])
          run(api?.insertLessons(created))
        }
        return created.length
      },
      removeSeries: (seriesId) => {
        const now = Date.now()
        const doomed = lessons.filter(
          (l) => l.seriesId === seriesId && l.status === 'upcoming' && +new Date(l.startsAt) > now,
        )
        if (!doomed.length) {
          toast('Будущих уроков в серии не осталось')
          return
        }
        const ids = new Set(doomed.map((l) => l.id))
        setLessons((prev) => prev.filter((l) => !ids.has(l.id)))
        run(api?.removeLessons([...ids]))
        toast(`Серия снята: ${doomed.length} уроков`)
      },
      addSlot: (slot) => {
        const fresh: Slot = { ...slot, id: uid('w') }
        setSlots((prev) => [...prev, fresh])
        run(api?.addSlot(fresh))
        toast('Рабочее окно добавлено')
      },
      removeSlot: (id) => {
        setSlots((prev) => prev.filter((s) => s.id !== id))
        run(api?.removeSlot(id))
      },
      // Педагог видит все уроки, ученик — только свои, поэтому занятость ему нужна отдельно.
      freeSlots: (duration, days) =>
        computeFreeSlots(slots, isCloud && role === 'student' ? busy : activeBusy(lessons), duration, days),
      canMove: (lesson) => lesson.status === 'upcoming' && hoursUntil(lesson.startsAt) >= MOVE_DEADLINE_HOURS,
      moveFor: (lessonId) => moves.find((m) => m.lessonId === lessonId && m.status === 'pending'),
      requestMove: (lessonId, proposedAt, comment) => {
        const lesson = lessons.find((l) => l.id === lessonId)
        if (!lesson) return
        setMoves((prev) => [
          ...prev.filter((m) => !(m.lessonId === lessonId && m.status === 'pending')),
          {
            id: uid('mv'),
            lessonId,
            studentId: lesson.studentId,
            proposedAt,
            comment,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ])
        run(api?.requestMove(lessonId, proposedAt, comment))
        toast(`Заявка ушла: ${STUDIO.teacher}`)
      },
      resolveMove: (id, accept) => {
        const request = moves.find((m) => m.id === id)
        if (!request) return
        const lesson = lessons.find((l) => l.id === request.lessonId)
        if (accept && lesson) {
          if (overlaps(request.proposedAt, lesson.duration, lessons, lesson.id)) {
            toast('Это время уже занято')
            return
          }
          setLessons((prev) =>
            prev.map((l) => (l.id === lesson.id ? { ...l, startsAt: request.proposedAt, seriesId: null } : l)),
          )
        }
        setMoves((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, status: accept ? 'accepted' : 'declined', decidedAt: new Date().toISOString() }
              : m,
          ),
        )
        run(api?.resolveMove(id, accept))
        toast(accept ? `Перенесено на ${formatSlot(request.proposedAt)}` : 'Заявка отклонена')
      },
      addStudent: (input) => {
        const plan = PLANS.find((p) => p.id === input.planId)
        const student: Student = {
          id: uid('st'),
          name: input.name,
          short: initials(input.name) || 'У',
          voice: input.voice,
          city: input.city,
          since: new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
          planId: input.planId,
          remaining: plan?.lessons ?? 1,
          used: 0,
          payment: 'due',
          nextGoal: input.nextGoal,
          rangeLow: 55,
          rangeHigh: 72,
          startLow: 55,
          startHigh: 72,
          skills: [
            { id: 'breath', label: 'Опора', value: 15 },
            { id: 'res', label: 'Резонанс', value: 15 },
            { id: 'legato', label: 'Легато', value: 15 },
            { id: 'mix', label: 'Микст', value: 10 },
            { id: 'dict', label: 'Дикция', value: 30 },
          ],
          repertoire: [],
          streak: 0,
          practiceWeek: [0, 0, 0, 0, 0, 0, 0],
        }
        setStudents((prev) => [...prev, student])

        if (!api) {
          toast(`${input.name} в списке учеников`)
          return
        }
        // Код входа придумывает база: без него ученик не заберёт свою карточку.
        api
          .addStudent(student)
          .then((saved) => {
            setStudents((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
            toast(saved.inviteCode ? `${input.name}: код входа ${saved.inviteCode}` : `${input.name} в списке`)
          })
          .catch((e: unknown) => {
            toast(errorText(e))
            void pull()
          })
      },
      updateStudent: (studentId, patch) => {
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, ...patch } : s)))
        run(api?.updateStudent(studentId, patch))
      },
      renewPlan: (studentId, planId) => {
        const plan = PLANS.find((p) => p.id === planId)
        const student = students.find((s) => s.id === studentId)
        if (!plan || !student) return
        const patch = { planId, remaining: student.remaining + plan.lessons, used: 0, payment: 'due' as const }
        setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, ...patch } : s)))
        run(api?.updateStudent(studentId, patch))
        toast(`${plan.title}: +${plan.lessons} занятий, ждёт оплаты`)
      },
      addPlace: (place) => {
        const fresh: Place = { ...place, id: uid('pl') }
        setPlaces((prev) => [...prev, fresh])
        run(api?.addPlace(fresh))
        toast('Кабинет добавлен')
      },
      updatePlace: (id, patch) => {
        setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
        run(api?.updatePlace(id, patch))
      },
      removePlace: (id) => {
        if (lessons.some((l) => l.locationId === id)) {
          toast('Сначала перенесите уроки из этого кабинета')
          return
        }
        setPlaces((prev) => prev.filter((p) => p.id !== id))
        run(api?.removePlace(id))
        toast('Кабинет удалён')
      },
      addDiary: (studentId, stars, comment) => {
        const entry: DiaryEntry = { id: uid('d'), studentId, createdAt: new Date().toISOString(), stars, comment }
        setDiary((prev) => [entry, ...prev])
        run(api?.addDiary(entry))
        toast('Запись в дневнике')
      },
      sendNotice: (title, body) => {
        const notice: Notice = { id: uid('n'), title, body, createdAt: new Date().toISOString() }
        setNotices((prev) => [notice, ...prev])
        run(api?.sendNotice(notice))
        toast(`Разослано ${students.length} ученикам`)
      },
      addMessage: (studentId, text) => {
        const message: ChatMessage = {
          id: uid('m'),
          studentId,
          from: role,
          text,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, message])
        run(api?.addMessage(message))
      },
      addFeedback: (item) => {
        const entry: FeedbackItem = { ...item, id: uid('f'), studentId: me.id, createdAt: new Date().toISOString() }
        setFeedback((prev) => [entry, ...prev])
        run(api?.addFeedback(entry))
        toast(`Отправлено: ${STUDIO.teacher}`)
      },
      addPractice: (minutes) => {
        setStudents((prev) =>
          prev.map((s) => {
            if (s.id !== me.id) return s
            const week = [...s.practiceWeek]
            const day = new Date().getDay()
            const idx = day === 0 ? 6 : day - 1
            week[idx] = (week[idx] ?? 0) + minutes
            return { ...s, practiceWeek: week, streak: Math.max(s.streak, 1) }
          }),
        )
        run(api?.logPractice(minutes))
        toast(`+${minutes} минут практики`)
      },
      resetDemo: () => {
        if (isCloud) {
          toast('На сервере демо-данные не сбрасываются')
          return
        }
        apply(seeds())
        toast('Демо-данные восстановлены')
      },
    }
  }, [
    role,
    nav,
    students,
    lessons,
    places,
    slots,
    moves,
    diary,
    notices,
    messages,
    feedback,
    toasts,
    seen,
    busy,
    me,
    unreadChat,
    unreadNotices,
    pendingMoves,
    applyLessonDelta,
    toast,
    apply,
    api,
    run,
    pull,
    userEmail,
  ])

  if (isCloud) {
    if (phase === 'boot') return <Loading />
    if (phase === 'anon') return <SignIn />
    if (phase === 'fail') {
      return (
        <Fatal
          text={fatal}
          email={userEmail}
          onRetry={() => {
            setFatal('')
            setPhase('boot')
            void pull()
          }}
          // Выходим только локально: сессия здесь может быть уже нерабочей, и
          // обращение к серверу за выходом отказало бы, оставив человека тут же.
          onSignOut={() => void supabase?.auth.signOut({ scope: 'local' })}
        />
      )
    }
    if (phase === 'invite') {
      return (
        <ClaimInvite
          email={userEmail}
          onClaimed={async (code) => {
            if (!api) return
            await api.claimInvite(code)
            setPhase('boot')
            await pull()
          }}
          onSignOut={() => void supabase?.auth.signOut()}
        />
      )
    }
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
